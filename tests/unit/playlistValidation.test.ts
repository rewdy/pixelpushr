import { expect, test } from "bun:test";
import { validatePlaylistItem } from "../../apps/api/src/playlists/routes";

const mediaAssetId = crypto.randomUUID();

test("image and video playback settings are exclusive and duration-bound", () => {
  expect(() => validatePlaylistItem("image", { mediaAssetId, imageDurationMs: 5000 })).not.toThrow();
  expect(() => validatePlaylistItem("image", { mediaAssetId, imageDurationMs: 5000, videoMode: "once" })).toThrow();
  expect(() => validatePlaylistItem("video", { mediaAssetId, videoMode: "once" })).not.toThrow();
  expect(() => validatePlaylistItem("video", { mediaAssetId, videoMode: "repeat", repeatDurationMs: 30000 })).not.toThrow();
  expect(() => validatePlaylistItem("video", { mediaAssetId, videoMode: "repeat" })).toThrow();
  expect(() => validatePlaylistItem("video", { mediaAssetId, videoMode: "once", repeatDurationMs: 30000 })).toThrow();
});
