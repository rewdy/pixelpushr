export const mediaKinds = {
  image: "image",
  video: "video",
} as const;

export type MediaKind = (typeof mediaKinds)[keyof typeof mediaKinds];

export type MediaAsset = {
  id: string;
  name: string;
  kind: MediaKind;
  size: string;
  duration: string;
  state: "Ready" | "Processing" | "Failed";
  color: string;
  updated: string;
};

export type Playlist = {
  id: string;
  name: string;
  description: string;
  items: number;
  displays: number;
  mode: "Always active" | "Scheduled" | "Override";
  color: string;
};
