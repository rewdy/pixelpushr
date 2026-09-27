import type { MediaAsset } from "../models/media.models";

/** Combines name search with OR-matched selected tags. */
export const filterMediaAssets = (
  assets: MediaAsset[],
  search: string,
  tagIds: string[],
): MediaAsset[] => {
  const needle = search.trim().toLocaleLowerCase();
  return assets.filter(
    (asset) =>
      (!needle || asset.name.toLocaleLowerCase().includes(needle)) &&
      (!tagIds.length || asset.tags.some((tag) => tagIds.includes(tag.id))),
  );
};
