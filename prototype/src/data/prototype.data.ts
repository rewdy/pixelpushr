import type { MediaAsset, Playlist } from "../models/prototype.models";

export const mediaAssets: MediaAsset[] = [
  { id: "media-1", name: "Sunday Service — Welcome", kind: "image", size: "2.4 MB", duration: "10 sec", state: "Ready", color: "#d8defd", updated: "12 minutes ago" },
  { id: "media-2", name: "Community Night Promo", kind: "video", size: "28.6 MB", duration: "00:30", state: "Ready", color: "#cce8e1", updated: "1 hour ago" },
  { id: "media-3", name: "Fall Gathering — Title", kind: "image", size: "1.8 MB", duration: "8 sec", state: "Ready", color: "#f5dfbd", updated: "Yesterday" },
  { id: "media-4", name: "Volunteer Spotlight", kind: "video", size: "42.1 MB", duration: "01:12", state: "Processing", color: "#e1d6f5", updated: "Yesterday" },
  { id: "media-5", name: "Lobby Loop Background", kind: "image", size: "3.1 MB", duration: "12 sec", state: "Failed", color: "#f0d6d4", updated: "Sep 20, 2026" },
];

export const playlists: Playlist[] = [
  { id: "playlist-1", name: "Lobby essentials", description: "Branding and evergreen information", items: 8, displays: 3, mode: "Always active", color: "#506DFF" },
  { id: "playlist-2", name: "October events", description: "Upcoming events and announcements", items: 5, displays: 2, mode: "Scheduled", color: "#43b991" },
  { id: "playlist-3", name: "Holiday campaign", description: "Seasonal campaign creative", items: 12, displays: 0, mode: "Scheduled", color: "#e29a48" },
  { id: "playlist-4", name: "Five minute countdown", description: "Pre-event room countdown", items: 1, displays: 1, mode: "Override", color: "#d66868" },
];

export const navSections = [
  { label: "Overview", items: [{ label: "Dashboard", path: "/", icon: "dashboard" }] },
  { label: "Manage", items: [
    { label: "Media library", path: "/media", icon: "photo" },
    { label: "Playlists", path: "/playlists", icon: "list" },
    { label: "Displays", path: "/displays", icon: "screen" },
  ] },
  { label: "Plan", items: [
    { label: "Schedules", path: "/schedules", icon: "calendar" },
    { label: "Overrides", path: "/overrides", icon: "bolt" },
  ] },
  { label: "Workspace", items: [{ label: "Administrators", path: "/settings", icon: "users" }] },
] as const;
