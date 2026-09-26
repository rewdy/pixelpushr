export type MediaAsset = {
  id: string;
  name: string;
  kind: "image" | "video";
  status: "pending" | "ready" | "failed";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  failureReason: string | null;
  url: string | null;
  previewUrl: string | null;
};

export type Playlist = { id: string; name: string; description: string | null; createdAt: string; updatedAt: string };
export type PlaylistItem = { id: string; position: number; mediaAssetId: string; imageDurationMs: number | null; videoMode: "once" | "repeat" | null; repeatDurationMs: number | null; asset: MediaAsset };
