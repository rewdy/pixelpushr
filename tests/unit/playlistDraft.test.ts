import { expect, test } from "bun:test";
import {
  applyBulkDuration,
  draftFromAsset,
  eligibleDurationCount,
  publishedItems,
} from "../../apps/web/src/helpers/playlistDraft";
import type { MediaAsset } from "../../apps/web/src/models/media.models";

const asset = (id: string, kind: "image" | "video"): MediaAsset => ({
  id,
  name: id,
  kind,
  status: "ready",
  mimeType: kind === "image" ? "image/png" : "video/mp4",
  sizeBytes: 10,
  width: 1,
  height: 1,
  durationMs: null,
  failureReason: null,
  url: `/media/${id}`,
  previewUrl: null,
});

test("duplicate assets receive independent client IDs and publish without IDs", () => {
  const image = asset("image", "image");
  const first = draftFromAsset(image);
  const second = draftFromAsset(image);
  expect(first.clientId).not.toBe(second.clientId);
  expect(publishedItems([first, second])).toEqual([
    { mediaAssetId: "image", imageDurationMs: 8000 },
    { mediaAssetId: "image", imageDurationMs: 8000 },
  ]);
});

test("bulk duration changes only selected images and repeat videos", () => {
  const image = asset("image", "image");
  const video = asset("video", "video");
  const first = draftFromAsset(image);
  const duplicate = draftFromAsset(image);
  const repeat = {
    ...draftFromAsset(video),
    videoMode: "repeat" as const,
    repeatDurationMs: 30000,
  };
  const once = draftFromAsset(video);
  const items = [first, duplicate, repeat, once];
  const selected = new Set([
    duplicate.clientId,
    repeat.clientId,
    once.clientId,
  ]);
  const assets = new Map([
    [image.id, image],
    [video.id, video],
  ]);
  expect(eligibleDurationCount(items, selected, assets)).toBe(2);
  const updated = applyBulkDuration(items, selected, assets, 12);
  expect(updated.map((item) => item.clientId)).toEqual(
    items.map((item) => item.clientId),
  );
  expect(updated[0]?.imageDurationMs).toBe(8000);
  expect(updated[1]?.imageDurationMs).toBe(12000);
  expect(updated[2]?.repeatDurationMs).toBe(12000);
  expect(updated[3]).toEqual(once);
  expect(
    updated
      .filter((item) => !selected.has(item.clientId))
      .map((item) => item.clientId),
  ).toEqual([first.clientId]);
  expect(() => applyBulkDuration(items, selected, assets, 0)).toThrow();
});
