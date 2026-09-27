import type {
  ManifestItem,
  PlayerManifest,
} from "@pixelpushr/contracts/manifest";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import {
  cacheManifest,
  readCachedManifest,
  readClockOffset,
} from "../../helpers/playerCache";
import {
  advanceQueue,
  applyTimedOverride,
  initialQueue,
  planItemOverlap,
  playerCrossfadeMs,
  type QueueState,
  receiveManifest,
} from "../../helpers/playerQueue";
import { PlayerMediaLayer } from "./PlayerMediaLayer";
import classes from "./PlayerPage.module.css";

const pollMs = Math.max(
  100,
  Number(import.meta.env.VITE_PLAYER_POLL_MS ?? 15000),
);
const heartbeatMs = 30000;

type Preload = {
  sourceKey: string;
  targetKey: string;
  signature: string;
  item: ManifestItem;
  ready: boolean;
  failed: boolean;
  started: boolean;
  fadeMs: number;
};

const queueItemKey = (state: QueueState): string | null => {
  const item = state.queue[state.index];
  return item
    ? `${state.overrideId ?? "normal"}:${item.id}:${state.cycle}:${item.url}:${item.imageDurationMs}:${item.videoMode}:${item.repeatDurationMs}`
    : null;
};

/** Runs public, control-free playback for a display token. */
export const PlayerPage = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<QueueState | null>(null);
  const [offline, setOffline] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [preload, setPreload] = useState<Preload | null>(null);
  const [diagnostics, setDiagnostics] = useState(false);
  const stateRef = useRef<QueueState | null>(null);
  const videoAdvanced = useRef(false);
  const videoFallbackTimer = useRef<number | null>(null);
  const videoFadeTimer = useRef<number | null>(null);
  const boundary = useRef<{ key: string; at: number } | null>(null);
  const failedUrls = useRef(new Set<string>());
  const clockOffsetMs = useRef(0);
  const item = state?.queue[state.index];
  const itemKey = state ? queueItemKey(state) : null;
  const itemKind = item?.kind;
  const imageDurationMs = item?.imageDurationMs;
  const videoMode = item?.videoMode;
  const repeatDurationMs = item?.repeatDurationMs;
  const nextState = state ? advanceQueue(state) : null;
  const nextItem = nextState?.queue[nextState.index];
  const nextKey = nextState ? queueItemKey(nextState) : null;
  const nextSignature = nextItem
    ? JSON.stringify([
        nextItem.id,
        nextItem.url,
        nextItem.kind,
        nextItem.imageDurationMs,
        nextItem.videoMode,
        nextItem.repeatDurationMs,
      ])
    : null;
  const timedDurationMs =
    itemKind === "image"
      ? imageDurationMs
      : videoMode === "repeat"
        ? repeatDurationMs
        : null;
  const overlapStartMs =
    state && timedDurationMs
      ? planItemOverlap(state, timedDurationMs)?.startMs
      : null;
  const visiblePreload =
    preload?.sourceKey === itemKey &&
    preload.targetKey === nextKey &&
    preload.signature === nextSignature &&
    !preload.failed
      ? preload
      : null;

  const updateState = useCallback(
    (update: (current: QueueState | null) => QueueState | null) => {
      setState((current) => {
        const next = update(current);
        stateRef.current = next;
        return next;
      });
    },
    [],
  );
  const advance = useCallback(
    (expectedKey?: string) =>
      updateState((current) => {
        if (!current || (expectedKey && queueItemKey(current) !== expectedKey))
          return current;
        let next = advanceQueue(current);
        for (let count = 0; count < next.queue.length; count++) {
          const target = next.queue[next.index];
          if (!target || !failedUrls.current.has(target.url)) break;
          next = advanceQueue(next);
        }
        const target = next.queue[next.index];
        return target && failedUrls.current.has(target.url) ? current : next;
      }),
    [updateState],
  );

  const tryStartFade = useCallback(() => {
    const currentBoundary = boundary.current;
    if (!currentBoundary) return;
    setPreload((current) => {
      if (
        !current ||
        current.sourceKey !== currentBoundary.key ||
        !current.ready ||
        current.failed ||
        current.started
      )
        return current;
      const remaining = currentBoundary.at - performance.now();
      if (remaining <= 0 || remaining > playerCrossfadeMs) return current;
      return { ...current, started: true, fadeMs: remaining };
    });
  }, []);

  useEffect(() => {
    setPreload(
      itemKey && nextKey && nextItem && nextSignature
        ? {
            sourceKey: itemKey,
            targetKey: nextKey,
            signature: nextSignature,
            item: nextItem,
            ready: false,
            failed: false,
            started: false,
            fadeMs: 0,
          }
        : null,
    );
  }, [itemKey, nextKey, nextSignature, nextItem]);

  useEffect(() => {
    if (itemKey === null) return;
    videoAdvanced.current = false;
    return () => {
      if (videoFallbackTimer.current !== null)
        window.clearTimeout(videoFallbackTimer.current);
      videoFallbackTimer.current = null;
      if (videoFadeTimer.current !== null)
        window.clearTimeout(videoFadeTimer.current);
      videoFadeTimer.current = null;
      boundary.current = null;
    };
  }, [itemKey]);

  useEffect(() => {
    const cached = readCachedManifest(token);
    clockOffsetMs.current = readClockOffset(token);
    if (cached) {
      updateState(() =>
        applyTimedOverride(
          initialQueue(cached),
          Date.now() + clockOffsetMs.current,
        ),
      );
      setOffline(true);
    }
    let active = true;
    const refresh = async () => {
      try {
        const sentAt = Date.now();
        const response = await fetch(
          `/api/player/${encodeURIComponent(token)}/manifest`,
          { cache: "no-store" },
        );
        if (response.status === 404) {
          if (active) setUnavailable(true);
          return;
        }
        if (!response.ok)
          throw new Error(`Manifest returned ${response.status}`);
        const manifest = (await response.json()) as PlayerManifest;
        if (!active) return;
        clockOffsetMs.current =
          Date.parse(manifest.serverTime) - (sentAt + Date.now()) / 2;
        setUnavailable(false);
        setOffline(false);
        updateState((current) =>
          current ? receiveManifest(current, manifest) : initialQueue(manifest),
        );
        void cacheManifest(token, manifest, clockOffsetMs.current).catch(
          () => undefined,
        );
      } catch {
        if (active) setOffline(true);
      }
    };
    void refresh();
    const poller = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => {
      active = false;
      window.clearInterval(poller);
    };
  }, [token, updateState]);

  useEffect(() => {
    if (!state) return;
    const next = state.manifest.transitions.find(
      (transition) =>
        Date.parse(transition.at) > Date.now() + clockOffsetMs.current,
    );
    if (!next) return;
    const delay = Math.max(
      0,
      Date.parse(next.at) - (Date.now() + clockOffsetMs.current) + 10,
    );
    const timer = window.setTimeout(
      () =>
        updateState((current) =>
          current
            ? applyTimedOverride(current, Date.now() + clockOffsetMs.current)
            : current,
        ),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [state, updateState]);

  useEffect(() => {
    const report = () => {
      const current = stateRef.current;
      void fetch(`/api/player/${encodeURIComponent(token)}/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          health: current?.queue.length ? "playing" : "empty",
          itemId: current?.queue[current.index]?.id ?? null,
        }),
      }).catch(() => undefined);
    };
    report();
    const timer = window.setInterval(report, heartbeatMs);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "d") setDiagnostics((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!itemKey || !timedDurationMs) return;
    const at =
      boundary.current?.key === itemKey
        ? boundary.current.at
        : performance.now() + timedDurationMs;
    boundary.current = { key: itemKey, at };
    const remaining = Math.max(0, at - performance.now());
    const fadeTimer =
      overlapStartMs !== null
        ? window.setTimeout(
            tryStartFade,
            Math.max(0, remaining - playerCrossfadeMs),
          )
        : null;
    const timer = window.setTimeout(() => advance(itemKey), remaining);
    return () => {
      window.clearTimeout(timer);
      if (fadeTimer !== null) window.clearTimeout(fadeTimer);
    };
  }, [itemKey, timedDurationMs, overlapStartMs, advance, tryStartFade]);

  const onMediaError = useCallback(
    (url: string, key: string) => {
      failedUrls.current.add(url);
      advance(key);
    },
    [advance],
  );
  const finishVideoOnce = () => {
    if (videoAdvanced.current) return;
    videoAdvanced.current = true;
    if (videoFallbackTimer.current !== null)
      window.clearTimeout(videoFallbackTimer.current);
    advance(itemKey ?? undefined);
  };
  const onVideoTimeUpdate = (video: HTMLVideoElement) => {
    if (
      item?.videoMode === "once" &&
      Number.isFinite(video.duration) &&
      !videoAdvanced.current
    ) {
      const remaining = (video.duration - video.currentTime) * 1000;
      if (itemKey && remaining > 0)
        boundary.current = { key: itemKey, at: performance.now() + remaining };
      if (remaining <= playerCrossfadeMs && remaining > 0) tryStartFade();
      if (remaining <= 50) finishVideoOnce();
    }
  };

  const onVideoPlaying = (video: HTMLVideoElement) => {
    if (
      item?.videoMode !== "once" ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    )
      return;
    if (videoFallbackTimer.current !== null)
      window.clearTimeout(videoFallbackTimer.current);
    if (videoFadeTimer.current !== null)
      window.clearTimeout(videoFadeTimer.current);
    const remaining = (video.duration - video.currentTime) * 1000;
    if (itemKey)
      boundary.current = { key: itemKey, at: performance.now() + remaining };
    videoFadeTimer.current = window.setTimeout(
      tryStartFade,
      Math.max(0, remaining - playerCrossfadeMs),
    );
    videoFallbackTimer.current = window.setTimeout(
      finishVideoOnce,
      Math.max(100, remaining + 250),
    );
  };

  const onIncomingReady = () => {
    setPreload((current) => {
      if (!current || current !== visiblePreload || current.ready)
        return current;
      const currentBoundary = boundary.current;
      const remaining =
        currentBoundary?.key === current.sourceKey
          ? currentBoundary.at - performance.now()
          : 0;
      return {
        ...current,
        ready: true,
        started: remaining > 0 && remaining <= playerCrossfadeMs,
        fadeMs: Math.max(0, Math.min(playerCrossfadeMs, remaining)),
      };
    });
  };

  const onIncomingFailed = () => {
    if (!visiblePreload) return;
    failedUrls.current.add(visiblePreload.item.url);
    setPreload((current) =>
      current === visiblePreload ? { ...current, failed: true } : current,
    );
  };

  return (
    <div className={classes.stage}>
      {unavailable ? (
        <div className={classes.empty}>Display unavailable</div>
      ) : !item ? (
        <div className={classes.empty}>
          {offline ? "Waiting for cached content" : "Waiting for a playlist"}
        </div>
      ) : (
        <>
          <PlayerMediaLayer
            key={itemKey}
            item={item}
            offline={offline}
            active
            fadingIn={false}
            fadingOut={!!visiblePreload?.started}
            fadeMs={visiblePreload?.fadeMs ?? 0}
            onReady={() => undefined}
            onFailed={() => onMediaError(item.url, itemKey ?? "")}
            onVideoEnded={finishVideoOnce}
            onVideoTimeUpdate={onVideoTimeUpdate}
            onVideoPlaying={onVideoPlaying}
          />
          {visiblePreload && (
            <PlayerMediaLayer
              key={visiblePreload.targetKey}
              item={visiblePreload.item}
              offline={offline}
              active={false}
              fadingIn={visiblePreload.started}
              fadingOut={false}
              fadeMs={visiblePreload.fadeMs}
              onReady={onIncomingReady}
              onFailed={onIncomingFailed}
              onVideoEnded={() => undefined}
              onVideoTimeUpdate={() => undefined}
              onVideoPlaying={() => undefined}
            />
          )}
        </>
      )}
      {diagnostics && (
        <div className={classes.diagnostic}>
          {offline ? "offline" : "online"} · {item?.id ?? "empty"} ·{" "}
          {state?.version.slice(0, 8) ?? "none"}
        </div>
      )}
    </div>
  );
};
