import type { PlayerManifest } from "@pixelpushr/contracts/manifest";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import {
  cacheManifest,
  offlineMediaUrl,
  readCachedManifest,
  readClockOffset,
} from "../../helpers/playerCache";
import {
  advanceQueue,
  applyTimedOverride,
  initialQueue,
  type QueueState,
  receiveManifest,
} from "../../helpers/playerQueue";
import classes from "./PlayerPage.module.css";

const pollMs = Math.max(
  100,
  Number(import.meta.env.VITE_PLAYER_POLL_MS ?? 15000),
);
const heartbeatMs = 30000;

/** Runs public, control-free playback for a display token. */
export const PlayerPage = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<QueueState | null>(null);
  const [offline, setOffline] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState(false);
  const stateRef = useRef<QueueState | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoAdvanced = useRef(false);
  const videoFallbackTimer = useRef<number | null>(null);
  const clockOffsetMs = useRef(0);
  const item = state?.queue[state.index];
  const itemKey = item ? `${item.id}:${state?.cycle}` : null;
  const itemUrl = item?.url;
  const itemKind = item?.kind;
  const imageDurationMs = item?.imageDurationMs;
  const videoMode = item?.videoMode;
  const repeatDurationMs = item?.repeatDurationMs;

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
    () => updateState((current) => (current ? advanceQueue(current) : current)),
    [updateState],
  );

  useEffect(() => {
    if (itemKey === null) return;
    videoAdvanced.current = false;
    return () => {
      if (videoFallbackTimer.current !== null)
        window.clearTimeout(videoFallbackTimer.current);
      videoFallbackTimer.current = null;
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
    if (!itemKey || !itemUrl) {
      setMediaUrl(null);
      return;
    }
    if (!offline) {
      setMediaUrl(itemUrl);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    void offlineMediaUrl(itemUrl).then((url) => {
      if (active) {
        objectUrl = url;
        setMediaUrl(url ?? itemUrl);
      } else if (url) URL.revokeObjectURL(url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemKey, itemUrl, offline]);

  useEffect(() => {
    if (!itemKey) return;
    const duration =
      itemKind === "image"
        ? imageDurationMs
        : videoMode === "repeat"
          ? repeatDurationMs
          : null;
    if (!duration) return;
    const timer = window.setTimeout(advance, duration);
    return () => window.clearTimeout(timer);
  }, [
    itemKey,
    itemKind,
    imageDurationMs,
    videoMode,
    repeatDurationMs,
    advance,
  ]);

  const onMediaError = () => {
    if (item && !offline && !mediaUrl?.startsWith("blob:")) {
      void offlineMediaUrl(item.url).then((url) => {
        if (url) setMediaUrl(url);
        else advance();
      });
    } else advance();
  };
  const finishVideoOnce = () => {
    if (videoAdvanced.current) return;
    videoAdvanced.current = true;
    if (videoFallbackTimer.current !== null)
      window.clearTimeout(videoFallbackTimer.current);
    advance();
  };
  const onVideoEnded = () => {
    if (item?.videoMode === "repeat") {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        void videoRef.current.play().catch(onMediaError);
      }
    } else finishVideoOnce();
  };

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (
      item?.videoMode === "once" &&
      video &&
      Number.isFinite(video.duration) &&
      video.currentTime >= video.duration - 0.05 &&
      !videoAdvanced.current
    ) {
      finishVideoOnce();
    }
  };

  const onVideoPlaying = () => {
    const video = videoRef.current;
    if (
      item?.videoMode !== "once" ||
      !video ||
      !Number.isFinite(video.duration)
    )
      return;
    if (videoFallbackTimer.current !== null)
      window.clearTimeout(videoFallbackTimer.current);
    videoFallbackTimer.current = window.setTimeout(
      finishVideoOnce,
      Math.max(100, (video.duration - video.currentTime) * 1000 + 250),
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
      ) : !mediaUrl ? null : item.kind === "image" ? (
        <img
          key={itemKey}
          src={mediaUrl}
          alt=""
          className={classes.media}
          onError={onMediaError}
        />
      ) : (
        <video
          key={itemKey}
          ref={videoRef}
          src={mediaUrl}
          autoPlay
          muted
          playsInline
          className={classes.media}
          onEnded={onVideoEnded}
          onTimeUpdate={onVideoTimeUpdate}
          onPlaying={onVideoPlaying}
          onError={onMediaError}
        />
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
