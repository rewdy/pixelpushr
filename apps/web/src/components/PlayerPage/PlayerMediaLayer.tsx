import type { ManifestItem } from "@pixelpushr/contracts/manifest";
import { useEffect, useRef, useState } from "react";
import { offlineMediaUrl } from "../../helpers/playerCache";
import classes from "./PlayerPage.module.css";

type Props = {
  item: ManifestItem;
  offline: boolean;
  active: boolean;
  preparing?: boolean;
  fadingIn: boolean;
  fadingOut: boolean;
  fadeMs: number;
  onReady: () => void;
  onFailed: () => void;
  onVideoEnded: () => void;
  onVideoTimeUpdate: (video: HTMLVideoElement) => void;
  onVideoPlaying: (video: HTMLVideoElement) => void;
};

/** Owns one player's media URL, cached fallback, and decoder lifecycle. */
export const PlayerMediaLayer = ({
  item,
  offline,
  active,
  preparing = false,
  fadingIn,
  fadingOut,
  fadeMs,
  onReady,
  onFailed,
  onVideoEnded,
  onVideoTimeUpdate,
  onVideoPlaying,
}: Props) => {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackTried = useRef(false);
  const objectUrl = useRef<string | null>(null);
  const requestGeneration = useRef(0);
  const onFailedRef = useRef(onFailed);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;

  useEffect(() => {
    const generation = ++requestGeneration.current;
    fallbackTried.current = false;
    setSourceUrl(offline ? null : item.url);
    if (offline) {
      void offlineMediaUrl(item.url)
        .catch(() => null)
        .then((url) => {
          if (requestGeneration.current !== generation) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          if (url) objectUrl.current = url;
          setSourceUrl(url ?? item.url);
        });
    }
    return () => {
      requestGeneration.current++;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
  }, [item.url, offline]);

  useEffect(() => {
    if (
      item.kind !== "video" ||
      !sourceUrl ||
      preparing ||
      (!active && !fadingIn)
    )
      return;
    void videoRef.current?.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onFailedRef.current();
    });
  }, [item.kind, sourceUrl, active, fadingIn, preparing]);

  const handleError = () => {
    if (fallbackTried.current || sourceUrl?.startsWith("blob:")) {
      onFailed();
      return;
    }
    fallbackTried.current = true;
    const generation = requestGeneration.current;
    void offlineMediaUrl(item.url)
      .catch(() => null)
      .then((url) => {
        if (requestGeneration.current !== generation) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          onFailed();
          return;
        }
        requestGeneration.current++;
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = url;
        setSourceUrl(url);
      });
  };

  const handleEnded = () => {
    if (item.videoMode === "repeat") {
      if (active || fadingIn) {
        const video = videoRef.current;
        if (video) {
          video.currentTime = 0;
          void video.play().catch(onFailed);
        }
      }
    } else if (active) onVideoEnded();
  };

  const style = {
    opacity: preparing || fadingOut ? 0 : active || fadingIn ? 1 : 0,
    visibility: preparing ? ("hidden" as const) : undefined,
    transition: fadingIn || fadingOut ? `opacity ${fadeMs}ms linear` : "none",
  };

  return item.kind === "image" ? (
    <img
      src={sourceUrl ?? undefined}
      alt=""
      className={classes.media}
      style={style}
      data-player-layer={active ? "current" : "incoming"}
      data-player-item={item.id}
      onLoad={({ currentTarget }) => {
        if (!preparing) {
          onReady();
          return;
        }
        const generation = requestGeneration.current;
        void currentTarget.decode().then(
          () => {
            if (generation === requestGeneration.current) onReadyRef.current();
          },
          () => {
            if (generation === requestGeneration.current) handleError();
          },
        );
      }}
      onError={handleError}
    />
  ) : (
    <video
      ref={videoRef}
      src={sourceUrl ?? undefined}
      preload="auto"
      muted
      playsInline
      className={classes.media}
      style={style}
      data-player-layer={active ? "current" : "incoming"}
      data-player-item={item.id}
      onCanPlay={onReady}
      onEnded={handleEnded}
      onTimeUpdate={(event) => {
        if (active) onVideoTimeUpdate(event.currentTarget);
      }}
      onPlaying={(event) => {
        if (active) onVideoPlaying(event.currentTarget);
      }}
      onError={handleError}
    />
  );
};
