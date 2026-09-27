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
  const endAt = new Date(Date.now() + serverSkewMs + 6000).toISOString();
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
  await expect(
    page.locator('img[data-player-layer="current"][src$="brand.png"]'),
  ).toBeVisible();
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
  await expect(
    page.locator('img[data-player-layer="current"][src$="countdown.png"]'),
  ).toBeVisible({
    timeout: 2500,
  });
  online = false;
  await page.reload();
  await expect(
    page.locator('img[data-player-layer="current"][src^="blob:"]'),
  ).toBeVisible();
  await page.keyboard.press("d");
  await expect(page.getByText(/offline · countdown ·/)).toBeVisible();
  await expect(page.getByText(/offline · brand ·/)).toBeVisible({
    timeout: 7000,
  });
  await expect(page.locator('img[data-player-layer="current"]')).toBeVisible();
});

test("cached recurring occurrence honors priority, expiry, and later online renewal", async ({
  page,
}) => {
  const skew = 30_000;
  const now = Date.now() + skew;
  const window = (
    assignmentId: string,
    priority: number,
    startMs: number,
    endMs: number,
  ) => ({
    assignmentId,
    priority,
    startAt: new Date(now + startMs).toISOString(),
    endAt: new Date(now + endMs).toISOString(),
    queue: [item(assignmentId)],
  });
  const low = window("recurring-low", 1, 900, 3300);
  const high = window("recurring-high", 9, 1700, 2500);
  const later = window("renewed", 3, 5500, 7000);
  let online = true;
  let renewed = false;
  await page.route("**/api/player/recurring-fixture/manifest", (route) => {
    if (!online) return route.abort();
    const windows = renewed ? [low, high, later] : [low, high];
    const serverNow = Date.now() + skew;
    const winner =
      [...windows]
        .filter(
          (candidate) =>
            serverNow >= Date.parse(candidate.startAt) &&
            serverNow < Date.parse(candidate.endAt),
        )
        .sort((a, b) => b.priority - a.priority)[0] ?? null;
    return route.fulfill({
      json: {
        display: { id: "fixture", name: "Fixture" },
        version: renewed ? "renewed" : "cached",
        serverTime: new Date(serverNow).toISOString(),
        normalQueue: [item("brand")],
        activeQueue: winner?.queue ?? [item("brand")],
        override: winner,
        overrideWindows: windows,
        transitions: [
          { at: low.startAt, overrideId: low.assignmentId },
          { at: high.startAt, overrideId: high.assignmentId },
          { at: high.endAt, overrideId: low.assignmentId },
          { at: low.endAt, overrideId: null },
          ...(renewed
            ? [
                { at: later.startAt, overrideId: later.assignmentId },
                { at: later.endAt, overrideId: null },
              ]
            : []),
        ],
      },
    });
  });
  await page.route("**/api/player/recurring-fixture/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  for (const name of ["brand", "recurring-low", "recurring-high", "renewed"])
    await page.route(`**/${name}.png`, (route) =>
      route.fulfill({ body: png, contentType: "image/png" }),
    );
  await page.goto("/player/recurring-fixture");
  await expect(
    page.locator('img[data-player-layer="current"][src$="recurring-low.png"]'),
  ).toBeVisible({ timeout: 2500 });
  await expect(
    page.locator('img[data-player-layer="current"][src$="recurring-high.png"]'),
  ).toBeVisible({ timeout: 2000 });
  online = false;
  await page.reload();
  await expect(page.locator('img[data-player-layer="current"]')).toBeVisible();
  await page.keyboard.press("d");
  await expect(page.getByText(/offline · recurring-low ·/)).toBeVisible({
    timeout: 2500,
  });
  await expect(page.getByText(/offline · brand ·/)).toBeVisible({
    timeout: 3000,
  });
  renewed = true;
  online = true;
  await expect(
    page.locator('img[data-player-layer="current"][src$="renewed.png"]'),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    page.locator('img[data-player-layer="current"][src$="brand.png"]'),
  ).toBeVisible({ timeout: 3000 });
});
