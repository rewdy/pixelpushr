export type MediaKind = "image" | "video";

export type MediaTag = {
  id: string;
  name: string;
};

export type MediaAsset = {
  id: string;
  name: string;
  kind: MediaKind;
  status: "pending" | "ready" | "failed";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  failureReason: string | null;
  url: string | null;
  previewUrl: string | null;
  contentVersion: string;
  tags: MediaTag[];
};

export type MediaDeleteImpact = {
  assetId: string;
  snapshotToken: string;
  totalItems: number;
  playlists: Array<{
    id: string;
    name: string;
    itemIds: string[];
  }>;
};

export type BulkMediaTagsRequest = { assetIds: string[]; tags: string[] };

export type BulkMediaDeleteImpact = {
  assetIds: string[];
  assets: Array<{ id: string; name: string; itemCount: number }>;
  snapshotToken: string;
  totalItems: number;
  playlists: Array<{ id: string; name: string; itemIds: string[] }>;
};

export type BulkMediaDeleteRequest = {
  assetIds: string[];
  snapshotToken: string;
};

export type MediaReplacementStart = {
  mimeType: string;
  sizeBytes: number;
};

export type MediaReplacementUpload = {
  replacementId: string;
  uploadUrl: string;
};

export type MediaReplacementComplete = {
  width?: number;
  height?: number;
  durationMs?: number;
};

export type MediaReplacementResult = { asset: MediaAsset };
