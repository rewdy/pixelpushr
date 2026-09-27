export type Assignment = {
  id: string;
  playlistId: string;
  playlistName: string;
  mode: "always" | "scheduled" | "override";
  position: number;
  priority: number;
  schedule: {
    recurrence: "none" | "weekly";
    startAt: string;
    endAt: string;
    timezone: string;
    weekInterval: number | null;
  } | null;
};

export type Display = {
  id: string;
  name: string;
  playerUrl: string;
  lastSeenAt: string | null;
  lastHealth: string | null;
};
