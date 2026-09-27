import {
  AspectRatio,
  Box,
  Group,
  RingProgress,
  Stack,
  Text,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import classes from "./CompactPlaybackPreview.module.css";

export type PreviewItem = {
  id: string;
  name: string;
  kind: "image" | "video";
  url: string;
  imageDurationMs: number | null;
  videoMode: "once" | "repeat" | null;
  repeatDurationMs: number | null;
};

type Props = {
  items: PreviewItem[];
  structureKey: string;
};

/** Plays a local, compact queue without manifest, heartbeat, or device sync. */
export const CompactPlaybackPreview = ({ items, structureKey }: Props) => {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const startedAt = useRef(performance.now());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastStructureKey = useRef(structureKey);
  const item = items[index];
  const itemKey = `${structureKey}:${item?.id ?? "empty"}:${index}:${cycle}`;
  const duration =
    item?.kind === "image"
      ? item.imageDurationMs
      : item?.videoMode === "repeat"
        ? item.repeatDurationMs
        : null;
  const advance = useCallback(() => {
    setIndex((current) => (items.length ? (current + 1) % items.length : 0));
    setCycle((current) => current + 1);
    setVideoProgress(null);
  }, [items.length]);

  useEffect(() => {
    if (lastStructureKey.current === structureKey) return;
    lastStructureKey.current = structureKey;
    setIndex(0);
    setCycle((current) => current + 1);
    setVideoProgress(null);
  }, [structureKey]);
  useEffect(() => {
    if (!itemKey) return;
    startedAt.current = performance.now();
    setElapsedMs(0);
    const video = videoRef.current;
    return () => video?.pause();
  }, [itemKey]);
  useEffect(() => {
    if (!itemKey || !duration || duration < 1) return;
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      setElapsedMs(elapsed);
      if (elapsed >= duration) advance();
    }, 50);
    return () => window.clearInterval(timer);
  }, [duration, advance, itemKey]);

  if (!item) {
    return (
      <AspectRatio
        ratio={16 / 9}
        className={classes.stage}
        data-testid="compact-preview"
      >
        <Text c="gray.3" ta="center">
          No items in this preview
        </Text>
      </AspectRatio>
    );
  }
  const progress = duration
    ? Math.min(100, (elapsedMs / duration) * 100)
    : videoProgress;
  return (
    <Stack gap="xs">
      <AspectRatio
        ratio={16 / 9}
        className={classes.stage}
        data-testid="compact-preview"
      >
        <Box>
          {item.kind === "image" ? (
            <img
              key={`${item.id}:${cycle}`}
              src={item.url}
              alt=""
              className={classes.media}
              data-testid="preview-media"
              onError={advance}
            />
          ) : (
            <video
              key={`${item.id}:${cycle}`}
              ref={videoRef}
              src={item.url}
              autoPlay
              muted
              playsInline
              className={classes.media}
              data-testid="preview-media"
              onError={advance}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (item.videoMode === "once")
                  setVideoProgress(
                    Number.isFinite(video.duration) && video.duration > 0
                      ? Math.min(
                          100,
                          (video.currentTime / video.duration) * 100,
                        )
                      : null,
                  );
              }}
              onEnded={(event) => {
                if (item.videoMode === "repeat") {
                  event.currentTarget.currentTime = 0;
                  void event.currentTarget.play().catch(advance);
                } else advance();
              }}
            />
          )}
        </Box>
      </AspectRatio>
      <Group gap="sm" wrap="nowrap">
        <RingProgress
          size={50}
          thickness={5}
          roundCaps
          sections={[
            {
              value: progress ?? 100,
              color: progress === null ? "gray" : "brand",
            },
          ]}
          label={
            <Text size="xs" ta="center">
              {progress === null ? "…" : `${Math.round(progress)}%`}
            </Text>
          }
        />
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>
            {item.name}
          </Text>
          <Text size="xs" c="dimmed">
            {item.kind === "video" &&
            item.videoMode === "once" &&
            progress === null
              ? "Playing until video ends"
              : `Item ${index + 1} of ${items.length}`}
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
};
