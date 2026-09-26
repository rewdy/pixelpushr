export type ManifestItem = {
  id: string;
  playlistId: string;
  assetId: string;
  kind: "image" | "video";
  url: string;
  imageDurationMs: number | null;
  videoMode: "once" | "repeat" | null;
  repeatDurationMs: number | null;
};

export type OverrideWindow = {
  assignmentId: string;
  priority: number;
  startAt: string;
  endAt: string;
  queue: ManifestItem[];
};

export type ManifestTransition = { at: string; overrideId: string | null };

export type PlayerManifest = {
  display: { id: string; name: string };
  version: string;
  serverTime: string;
  normalQueue: ManifestItem[];
  activeQueue: ManifestItem[];
  override: OverrideWindow | null;
  overrideWindows: OverrideWindow[];
  transitions: ManifestTransition[];
};
