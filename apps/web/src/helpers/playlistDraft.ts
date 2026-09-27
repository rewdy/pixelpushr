import type { MediaAsset, PlaylistItem } from "../models/media.models";

export type DraftItem = {
  clientId: string;
  mediaAssetId: string;
  imageDurationMs?: number;
  videoMode?: "once" | "repeat";
  repeatDurationMs?: number;
};

/** Gives a persisted item a distinct client identity, even for duplicate media. */
export const draftFromItem = (item: PlaylistItem): DraftItem => ({
  clientId: crypto.randomUUID(),
  mediaAssetId: item.mediaAssetId,
  ...(item.imageDurationMs ? { imageDurationMs: item.imageDurationMs } : {}),
  ...(item.videoMode ? { videoMode: item.videoMode } : {}),
  ...(item.repeatDurationMs ? { repeatDurationMs: item.repeatDurationMs } : {}),
});

/** Appends a ready image or video with its default playback mode. */
export const draftFromAsset = (asset: MediaAsset): DraftItem =>
  asset.kind === "image"
    ? {
        clientId: crypto.randomUUID(),
        mediaAssetId: asset.id,
        imageDurationMs: 8000,
      }
    : {
        clientId: crypto.randomUUID(),
        mediaAssetId: asset.id,
        videoMode: "once",
      };

/** Removes client-only identity from the atomic playlist save payload. */
export const publishedItems = (draft: DraftItem[]) =>
  draft.map(({ clientId: _clientId, ...item }) => item);

/** Returns the number of selected items eligible for a duration change. */
export const eligibleDurationCount = (
  draft: DraftItem[],
  selected: ReadonlySet<string>,
  assets: ReadonlyMap<string, MediaAsset>,
): number =>
  draft.filter((item) => {
    if (!selected.has(item.clientId)) return false;
    const asset = assets.get(item.mediaAssetId);
    return (
      asset?.kind === "image" ||
      (asset?.kind === "video" && item.videoMode === "repeat")
    );
  }).length;

/** Applies seconds only to selected images and repeating videos. */
export const applyBulkDuration = (
  draft: DraftItem[],
  selected: ReadonlySet<string>,
  assets: ReadonlyMap<string, MediaAsset>,
  seconds: number,
): DraftItem[] => {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400)
    throw new Error("Duration must be 1–86,400 seconds");
  return draft.map((item) => {
    if (!selected.has(item.clientId)) return item;
    const asset = assets.get(item.mediaAssetId);
    if (asset?.kind === "image")
      return { ...item, imageDurationMs: seconds * 1000 };
    if (asset?.kind === "video" && item.videoMode === "repeat")
      return { ...item, repeatDurationMs: seconds * 1000 };
    return item;
  });
};
