import type { MediaAsset } from "@pixelpushr/contracts/media";

export type { MediaAsset } from "@pixelpushr/contracts/media";

export type Playlist = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PlaylistItem = {
  id: string;
  position: number;
  mediaAssetId: string;
  imageDurationMs: number | null;
  videoMode: "once" | "repeat" | null;
  repeatDurationMs: number | null;
  asset: MediaAsset;
};
