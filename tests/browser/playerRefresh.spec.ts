import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
  "base64",
);
const item = (id: string, duration: number) => ({
  id,
  playlistId: "playlist",
  assetId: id,
  kind: "image",
  url: `http://127.0.0.1:5173/${id}.png`,
  imageDurationMs: duration,
  videoMode: null,
  repeatDurationMs: null,
});
const manifest = (version: string, mediaId: string, duration = 1200) => ({
  display: { id: "fixture", name: "Fixture" },
  version,
  serverTime: new Date().toISOString(),
  normalQueue: [item(mediaId, duration)],
  activeQueue: [item(mediaId, duration)],
  override: null,
  transitions: [],
});

test("player observes reassignment at a queue boundary", async ({ page }) => {
  let current = manifest("v1", "first");
  await page.route("**/api/player/refresh/manifest", (route) =>
    route.fulfill({ json: current }),
  );
  await page.route("**/api/player/refresh/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.route("**/first.png", (route) =>
    route.fulfill({ body: png, contentType: "image/png" }),
  );
  await page.route("**/second.png", (route) =>
    route.fulfill({ body: png, contentType: "image/png" }),
  );
  await page.goto("/player/refresh");
  await expect(page.locator('img[src$="first.png"]')).toBeVisible();
  current = manifest("v2", "second");
  await page.waitForTimeout(500);
  await expect(page.locator('img[src$="first.png"]')).toBeVisible();
  await expect(page.locator('img[src$="second.png"]')).toBeVisible({
    timeout: 5000,
  });
});

test("cached manifest and media survive API and media outage on reload", async ({
  page,
}) => {
  const url = "http://127.0.0.1:5173/offline-fixture.png";
  let online = true;
  await page.route("**/api/player/offline-fixture/manifest", (route) =>
    online
      ? route.fulfill({ json: manifest("v1", "offline-fixture", 5000) })
      : route.abort(),
  );
  await page.route("**/api/player/offline-fixture/heartbeat", (route) =>
    online ? route.fulfill({ json: { received: true } }) : route.abort(),
  );
  await page.route("**/offline-fixture.png", (route) =>
    online
      ? route.fulfill({ body: png, contentType: "image/png" })
      : route.abort(),
  );
  await page.goto("/player/offline-fixture");
  await expect(page.locator("img")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        async (key) =>
          !!(await (
            await caches.open("pixelpushr-player-media-v1")
          ).match(key)),
        url,
      ),
    )
    .toBe(true);
  online = false;
  await page.reload();
  await expect(page.locator('img[src^="blob:"]')).toBeVisible();
  expect(
    await page
      .locator("img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
});
