import { expect, type Page, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
  "base64",
);
const image = (id: string, durationMs = 1600) => ({
  id,
  playlistId: "fixture",
  assetId: id,
  kind: "image" as const,
  url: `http://127.0.0.1:5173/${id}.png`,
  imageDurationMs: durationMs,
  videoMode: null,
  repeatDurationMs: null,
});
const manifest = (version: string, queue: ReturnType<typeof image>[]) => ({
  display: { id: "fixture", name: "Fixture" },
  version,
  serverTime: new Date().toISOString(),
  normalQueue: queue,
  activeQueue: queue,
  override: null,
  overrideWindows: [],
  transitions: [],
});

const routeImages = async (page: Page, ids: string[]) => {
  for (const id of ids) {
    await page.route(`**/${id}.png`, (route) =>
      route.fulfill({ body: png, contentType: "image/png" }),
    );
  }
};

const partialFade = async (page: Page, outgoing: string, incoming: string) => {
  const observed = await page.evaluate(
    ({ outgoing, incoming }) =>
      new Promise<boolean>((resolve) => {
        const fromSelector = `[data-player-layer="current"][data-player-item="${outgoing}"]`;
        const toSelector = `[data-player-layer="incoming"][data-player-item="${incoming}"]`;
        const isPartiallyVisible = (selector: string) => {
          const layer = document.querySelector(selector);
          if (!layer) return false;
          const opacity = Number(getComputedStyle(layer).opacity);
          return opacity > 0.05 && opacity < 0.95;
        };
        let frame: number;
        const timeout = window.setTimeout(() => {
          window.cancelAnimationFrame(frame);
          resolve(false);
        }, 4000);
        const sample = () => {
          if (
            isPartiallyVisible(fromSelector) &&
            isPartiallyVisible(toSelector)
          ) {
            window.clearTimeout(timeout);
            resolve(true);
          } else {
            frame = window.requestAnimationFrame(sample);
          }
        };
        sample();
      }),
    { outgoing, incoming },
  );
  expect(observed, `Expected ${outgoing} to crossfade into ${incoming}`).toBe(
    true,
  );
};

test("images overlap for 500 ms without extending the outgoing item", async ({
  page,
}) => {
  await routeImages(page, ["fade-a", "fade-b"]);
  await page.route("**/api/player/image-fade/manifest", (route) =>
    route.fulfill({
      json: manifest("one", [image("fade-a"), image("fade-b")]),
    }),
  );
  await page.route("**/api/player/image-fade/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  const started = Date.now();
  await page.goto("/player/image-fade");
  await expect(
    page.locator('[data-player-layer="current"][data-player-item="fade-a"]'),
  ).toBeVisible();
  await partialFade(page, "fade-a", "fade-b");
  expect(await page.locator("[data-player-layer]").count()).toBe(2);
  await expect(
    page.locator('[data-player-layer="current"][data-player-item="fade-b"]'),
  ).toBeVisible();
  expect(Date.now() - started).toBeGreaterThanOrEqual(1400);
  expect(Date.now() - started).toBeLessThan(2400);
  await expect(
    page.locator('[data-player-layer="incoming"][data-player-item="fade-a"]'),
  ).toHaveCSS("opacity", "0");
});

test("a changed normal manifest replaces the fading target at rollover", async ({
  page,
}) => {
  await routeImages(page, ["race-a", "race-b", "race-c"]);
  let current = manifest("one", [image("race-a", 2000), image("race-b")]);
  await page.route("**/api/player/race/manifest", (route) =>
    route.fulfill({ json: current }),
  );
  await page.route("**/api/player/race/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.goto("/player/race");
  await partialFade(page, "race-a", "race-b");
  current = manifest("two", [image("race-c")]);
  await expect(
    page.locator('[data-player-layer="current"][data-player-item="race-c"]'),
  ).toBeVisible({ timeout: 3000 });
  expect(await page.locator('[data-player-item="race-b"]').count()).toBe(0);
});

test("a missing incoming asset is skipped without a stale overlay", async ({
  page,
}) => {
  await routeImages(page, ["good-a", "good-b"]);
  await page.route("**/missing.png", (route) => route.abort());
  await page.route("**/api/player/missing-next/manifest", (route) =>
    route.fulfill({
      json: manifest("one", [
        image("good-a"),
        image("missing"),
        image("good-b"),
      ]),
    }),
  );
  await page.route("**/api/player/missing-next/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.goto("/player/missing-next");
  await expect(
    page.locator('[data-player-layer="current"][data-player-item="good-a"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-player-layer="current"][data-player-item="good-b"]'),
  ).toBeVisible({ timeout: 3500 });
  expect(await page.locator('[data-player-item="missing"]').count()).toBe(0);
});

test("cached image layers crossfade while offline", async ({ page }) => {
  const queue = [image("cached-a"), image("cached-b")];
  let online = true;
  await page.route("**/api/player/cached-fade/manifest", (route) =>
    online ? route.fulfill({ json: manifest("one", queue) }) : route.abort(),
  );
  await page.route("**/api/player/cached-fade/heartbeat", (route) =>
    online ? route.fulfill({ json: { received: true } }) : route.abort(),
  );
  for (const id of ["cached-a", "cached-b"]) {
    await page.route(`**/${id}.png`, (route) =>
      online
        ? route.fulfill({ body: png, contentType: "image/png" })
        : route.abort(),
    );
  }
  await page.goto("/player/cached-fade");
  await expect
    .poll(() =>
      page.evaluate(
        async (urls) => {
          const cache = await caches.open("pixelpushr-player-media-v1");
          return (await Promise.all(urls.map((url) => cache.match(url)))).every(
            Boolean,
          );
        },
        queue.map((entry) => entry.url),
      ),
    )
    .toBe(true);
  online = false;
  await page.reload();
  await partialFade(page, "cached-a", "cached-b");
  await expect(
    page.locator(
      '[data-player-layer="current"][data-player-item="cached-b"][src^="blob:"]',
    ),
  ).toBeVisible();
  expect(await page.locator("[data-player-layer]").count()).toBeLessThanOrEqual(
    2,
  );
});

test("server-timed override cuts through normal and offline override fades", async ({
  page,
}) => {
  const skewMs = 60_000;
  const startAt = new Date(Date.now() + skewMs + 3000).toISOString();
  const endAt = new Date(Date.now() + skewMs + 6000).toISOString();
  const normalQueue = [
    image("cut-normal-a", 3000),
    image("cut-normal-b", 3000),
  ];
  const overrideQueue = [
    image("cut-override-a", 3000),
    image("cut-override-b", 3000),
  ];
  const window = {
    assignmentId: "countdown",
    priority: 10,
    startAt,
    endAt,
    queue: overrideQueue,
  };
  let online = true;
  await page.route("**/api/player/cut-fade/manifest", (route) => {
    const now = Date.now() + skewMs;
    const active = now >= Date.parse(startAt) && now < Date.parse(endAt);
    return online
      ? route.fulfill({
          json: {
            ...manifest("cut", normalQueue),
            serverTime: new Date(now).toISOString(),
            activeQueue: active ? overrideQueue : normalQueue,
            override: active ? window : null,
            overrideWindows: [window],
            transitions: [
              { at: startAt, overrideId: "countdown" },
              { at: endAt, overrideId: null },
            ],
          },
        })
      : route.abort();
  });
  await page.route("**/api/player/cut-fade/heartbeat", (route) =>
    online ? route.fulfill({ json: { received: true } }) : route.abort(),
  );
  for (const item of [...normalQueue, ...overrideQueue]) {
    await page.route(`**/${item.id}.png`, (route) =>
      online
        ? route.fulfill({ body: png, contentType: "image/png" })
        : route.abort(),
    );
  }
  await page.goto("/player/cut-fade");
  await expect
    .poll(() =>
      page.evaluate(
        async (urls) => {
          const cache = await caches.open("pixelpushr-player-media-v1");
          return (await Promise.all(urls.map((url) => cache.match(url)))).every(
            Boolean,
          );
        },
        [...normalQueue, ...overrideQueue].map((item) => item.url),
      ),
    )
    .toBe(true);
  await partialFade(page, "cut-normal-a", "cut-normal-b");
  await expect(
    page.locator(
      '[data-player-layer="current"][data-player-item="cut-override-a"]',
    ),
  ).toBeVisible({ timeout: 2000 });
  expect(await page.locator('[data-player-item="cut-normal-b"]').count()).toBe(
    0,
  );
  online = false;
  await expect(
    page.locator(
      '[data-player-layer="current"][data-player-item="cut-override-a"][src^="blob:"]',
    ),
  ).toBeVisible({ timeout: 2000 });
  await partialFade(page, "cut-override-a", "cut-override-b");
  await expect(
    page.locator(
      '[data-player-layer="current"][data-player-item="cut-normal-a"]',
    ),
  ).toBeVisible({ timeout: 2000 });
  expect(
    await page.locator('[data-player-item="cut-override-b"]').count(),
  ).toBe(0);
  expect(await page.locator("[data-player-layer]").count()).toBeLessThanOrEqual(
    2,
  );
});

test("a higher-priority override from polling replaces an in-flight fade", async ({
  page,
}) => {
  await routeImages(page, [
    "winner-low-a",
    "winner-low-b",
    "winner-high",
    "winner-normal",
  ]);
  const lowQueue = [image("winner-low-a", 2000), image("winner-low-b")];
  const highQueue = [image("winner-high")];
  const normalQueue = [image("winner-normal")];
  const low = {
    assignmentId: "low",
    priority: 1,
    startAt: new Date(Date.now() - 1000).toISOString(),
    endAt: new Date(Date.now() + 10_000).toISOString(),
    queue: lowQueue,
  };
  const high = { ...low, assignmentId: "high", priority: 10, queue: highQueue };
  let winner = low;
  await page.route("**/api/player/winner-fade/manifest", (route) =>
    route.fulfill({
      json: {
        ...manifest(winner.assignmentId, normalQueue),
        activeQueue: winner.queue,
        override: winner,
        overrideWindows: [low, ...(winner === high ? [high] : [])],
      },
    }),
  );
  await page.route("**/api/player/winner-fade/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.goto("/player/winner-fade");
  await partialFade(page, "winner-low-a", "winner-low-b");
  winner = high;
  await expect(
    page.locator(
      '[data-player-layer="current"][data-player-item="winner-high"]',
    ),
  ).toBeVisible({ timeout: 1500 });
  expect(await page.locator('[data-player-item="winner-low-b"]').count()).toBe(
    0,
  );
});
