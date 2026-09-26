import { expect, test } from "@playwright/test";
import { videoBase64 } from "../fixtures/videoBase64";

const imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==";
const videoUrl = `data:video/mp4;base64,${videoBase64}`;

const manifest = (mode: "once" | "repeat", repeatDurationMs: number | null) => {
  const video = { id: "video", playlistId: "playlist", assetId: "video", kind: "video", url: videoUrl, imageDurationMs: null, videoMode: mode, repeatDurationMs };
  const image = { id: "image", playlistId: "playlist", assetId: "image", kind: "image", url: imageUrl, imageDurationMs: 5000, videoMode: null, repeatDurationMs: null };
  return { display: { id: "fixture", name: "Fixture" }, version: `${mode}-${repeatDurationMs}`, serverTime: new Date().toISOString(), normalQueue: [video, image], activeQueue: [video, image], override: null, transitions: [] };
};

test("video play-once advances after the file ends", async ({ page }) => {
  await page.route("**/api/player/once/manifest", (route) => route.fulfill({ json: manifest("once", null) }));
  await page.route("**/api/player/once/heartbeat", (route) => route.fulfill({ json: { received: true } }));
  await page.goto("/player/once");
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("img")).toBeVisible({ timeout: 5000 });
});

test("video repeat remains active until its duration expires", async ({ page }) => {
  await page.route("**/api/player/repeat/manifest", (route) => route.fulfill({ json: manifest("repeat", 2400) }));
  await page.route("**/api/player/repeat/heartbeat", (route) => route.fulfill({ json: { received: true } }));
  await page.goto("/player/repeat");
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("img")).toBeVisible({ timeout: 5000 });
});
