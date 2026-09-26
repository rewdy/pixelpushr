import type { PlayerManifest } from "@pixelpushr/contracts/manifest";

const mediaCacheName = "pixelpushr-player-media-v1";
const maxItemBytes = 500 * 1024 * 1024;

/** Reads the last valid manifest for this display when the API is unavailable. */
export const readCachedManifest = (token: string): PlayerManifest | null => {
  try {
    const stored = localStorage.getItem(`pixelpushr-manifest-${token}`);
    return stored ? (JSON.parse(stored) as PlayerManifest) : null;
  } catch {
    return null;
  }
};

/** Reuse the last server clock estimate if the player reloads while offline. */
export const readClockOffset = (token: string): number => {
  const value = Number(
    localStorage.getItem(`pixelpushr-clock-offset-${token}`) ?? 0,
  );
  return Number.isFinite(value) ? value : 0;
};

/** Persists a valid manifest and caches its playable files without blocking playback. */
export const cacheManifest = async (
  token: string,
  manifest: PlayerManifest,
  clockOffsetMs = 0,
) => {
  localStorage.setItem(
    `pixelpushr-manifest-${token}`,
    JSON.stringify(manifest),
  );
  localStorage.setItem(
    `pixelpushr-clock-offset-${token}`,
    String(clockOffsetMs),
  );
  if (!("caches" in window)) return;
  const cache = await caches.open(mediaCacheName);
  const urls = [
    ...new Set(
      [
        ...manifest.normalQueue,
        ...manifest.activeQueue,
        ...(manifest.overrideWindows ?? []).flatMap((window) => window.queue),
      ].map((item) => item.url),
    ),
  ];
  await Promise.allSettled(
    urls.map(async (url) => {
      if (await cache.match(url)) return;
      const response = await fetch(url);
      if (!response.ok) return;
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > maxItemBytes) return;
      await cache.put(url, response);
    }),
  );
};

/** Returns an offline object URL for a previously cached media file. */
export const offlineMediaUrl = async (url: string): Promise<string | null> => {
  if (!("caches" in window)) return null;
  const response = await (await caches.open(mediaCacheName)).match(url);
  return response ? URL.createObjectURL(await response.blob()) : null;
};
