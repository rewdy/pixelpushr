import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
  "base64",
);
const item = (id: string) => ({
  id,
  playlistId: id,
  assetId: id,
  kind: "image",
  url: `http://127.0.0.1:5173/${id}.png`,
  imageDurationMs: 5000,
  videoMode: null,
  repeatDurationMs: null,
});

test("override cuts in and expires on server time, including an offline reload", async ({
  page,
}) => {
  const serverSkewMs = 60000;
  const startAt = new Date(Date.now() + serverSkewMs + 1300).toISOString();
  const endAt = new Date(Date.now() + serverSkewMs + 2600).toISOString();
  const window = {
    assignmentId: "countdown",
    priority: 10,
    startAt,
    endAt,
    queue: [item("countdown")],
  };
  let online = true;
  await page.route("**/api/player/timed-override/manifest", (route) =>
    online
      ? route.fulfill({
          json: {
            display: { id: "fixture", name: "Fixture" },
            version: "timed",
            serverTime: new Date(Date.now() + serverSkewMs).toISOString(),
            normalQueue: [item("brand")],
            activeQueue:
              Date.now() + serverSkewMs >= Date.parse(startAt) &&
              Date.now() + serverSkewMs < Date.parse(endAt)
                ? [item("countdown")]
                : [item("brand")],
            override:
              Date.now() + serverSkewMs >= Date.parse(startAt) &&
              Date.now() + serverSkewMs < Date.parse(endAt)
                ? window
                : null,
            overrideWindows: [window],
            transitions: [
              { at: startAt, overrideId: "countdown" },
              { at: endAt, overrideId: null },
            ],
          },
        })
      : route.abort(),
  );
  await page.route("**/api/player/timed-override/heartbeat", (route) =>
    online ? route.fulfill({ json: { received: true } }) : route.abort(),
  );
  await page.route("**/brand.png", (route) =>
    online
      ? route.fulfill({ body: png, contentType: "image/png" })
      : route.abort(),
  );
  await page.route("**/countdown.png", (route) =>
    online
      ? route.fulfill({ body: png, contentType: "image/png" })
      : route.abort(),
  );
  await page.goto("/player/timed-override");
  await expect(page.locator('img[src$="brand.png"]')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const cache = await caches.open("pixelpushr-player-media-v1");
        return (
          !!(await cache.match("http://127.0.0.1:5173/brand.png")) &&
          !!(await cache.match("http://127.0.0.1:5173/countdown.png"))
        );
      }),
    )
    .toBe(true);
  await expect(page.locator('img[src$="countdown.png"]')).toBeVisible({
    timeout: 2500,
  });
  online = false;
  await page.reload();
  await page.keyboard.press("d");
  await expect(page.locator('img[src^="blob:"]')).toBeVisible();
  await expect(page.getByText(/offline · countdown ·/)).toBeVisible();
  await expect(page.getByText(/offline · brand ·/)).toBeVisible({
    timeout: 3500,
  });
  await expect(page.locator("img")).toBeVisible();
});
