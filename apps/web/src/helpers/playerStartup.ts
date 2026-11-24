import type { ManifestItem } from "@pixelpushr/contracts/manifest";
import { offlineMediaUrl } from "./playerCache";

const preparationConcurrency = 4;

/** Identifies a distinct media source in the startup queue. */
export const startupAssetKey = ({ kind, url }: ManifestItem) =>
  JSON.stringify([kind, url]);

const probe = (
  kind: ManifestItem["kind"],
  url: string,
  signal: AbortSignal,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const image = kind === "image" ? new Image() : null;
    const video = image ? null : document.createElement("video");
    const media = image ?? video;
    if (!media) {
      resolve(false);
      return;
    }

    const finish = (ready: boolean) => {
      signal.removeEventListener("abort", cancel);
      media.onerror = null;
      if (video) video.oncanplay = null;
      media.removeAttribute("src");
      video?.load();
      resolve(ready && !signal.aborted);
    };
    const cancel = () => finish(false);
    signal.addEventListener("abort", cancel, { once: true });
    media.onerror = cancel;
    if (image) {
      image.src = url;
      void image.decode().then(
        () => {
          if (!signal.aborted && media.onerror) finish(true);
        },
        () => {
          if (media.onerror) cancel();
        },
      );
    }
    if (video) {
      video.preload = "auto";
      video.oncanplay = () => finish(true);
      video.src = url;
    }
  });

const probeCached = async (item: ManifestItem, signal: AbortSignal) => {
  if (signal.aborted) return false;
  const url = await offlineMediaUrl(item.url).catch(() => null);
  if (!url) return false;
  try {
    return await probe(item.kind, url, signal);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Prepares distinct startup assets and returns successful keys by the deadline. */
export const preparePlayerAssets = async (
  queue: ManifestItem[],
  offline: boolean,
  signal: AbortSignal,
  timeoutMs: number,
) => {
  const ready = new Set<string>();
  if (signal.aborted || !queue.length) return ready;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });

  const deadline = new Promise<void>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve(), {
      once: true,
    });
  });
  const timer = window.setTimeout(cancel, timeoutMs);
  const assets = [
    ...new Map(queue.map((item) => [startupAssetKey(item), item])),
  ];
  // Give queued assets a chance to start even when an entire batch stalls.
  const assetTimeoutMs = Math.ceil(
    timeoutMs / Math.ceil(assets.length / preparationConcurrency),
  );
  const worker = async () => {
    while (assets.length && !controller.signal.aborted) {
      const asset = assets.shift();
      if (!asset) return;
      const [key, item] = asset;
      const attempt = new AbortController();
      const abortAttempt = () => attempt.abort();
      controller.signal.addEventListener("abort", abortAttempt, { once: true });
      let timer: number | undefined;
      const deadline = new Promise<boolean>((resolve) => {
        attempt.signal.addEventListener("abort", () => resolve(false), {
          once: true,
        });
        timer = window.setTimeout(abortAttempt, assetTimeoutMs);
      });
      try {
        const cached = () => probeCached(item, attempt.signal);
        const remote = () => probe(item.kind, item.url, attempt.signal);
        const check = async () =>
          offline
            ? (await cached()) || (await remote())
            : (await remote()) || (await cached());
        if (
          (await Promise.race([deadline, check()])) &&
          !attempt.signal.aborted
        )
          ready.add(key);
      } finally {
        window.clearTimeout(timer);
        controller.signal.removeEventListener("abort", abortAttempt);
      }
    }
  };

  try {
    await Promise.race([
      deadline,
      Promise.all(Array.from({ length: preparationConcurrency }, worker)),
    ]);
    return ready;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    cancel();
  }
};
