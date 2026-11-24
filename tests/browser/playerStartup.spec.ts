import type { ManifestItem } from "@pixelpushr/contracts/manifest";
import { expect, type Page, test } from "@playwright/test";
import { videoBase64 } from "../fixtures/videoBase64";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
  "base64",
);
const image = (id: string, imageDurationMs = 1500): ManifestItem => ({
  id,
  playlistId: "playlist",
  assetId: id,
  kind: "image",
  url: `/startup/${id}.png`,
  imageDurationMs,
  videoMode: null,
  repeatDurationMs: null,
});
const routeImage = (page: Page, id: string, wait?: Promise<void>) =>
  page.route(`**/startup/${id}.png`, async (route) => {
    await wait;
    await route.fulfill({ body: png, contentType: "image/png" });
  });
const manifest = (queue: ManifestItem[]) => ({
  display: { id: "display", name: "Startup fixture" },
  version: "startup",
  serverTime: new Date().toISOString(),
  normalQueue: queue,
  activeQueue: queue,
  override: null,
  transitions: [],
});
const loader = (page: Page) =>
  page.getByRole("status", { name: "Loading media" });
const playing = (page: Page, id: string) =>
  page.locator(`[data-player-layer="current"][data-player-item="${id}"]`);

test("waits for the entire startup queue and gives the first image its duration", async ({
  page,
}) => {
  const slow = Promise.withResolvers<void>();
  const heartbeats: string[] = [];
  await page.addInitScript(() => {
    const setInterval = window.setInterval.bind(window);
    window.setInterval = (handler, delay, ...args) =>
      setInterval(handler, delay === 30000 ? 200 : delay, ...args);
  });
  await page.route("**/api/player/startup/manifest", (route) =>
    route.fulfill({ json: manifest([image("first"), image("slow")]) }),
  );
  await page.route("**/api/player/startup/heartbeat", (route) => {
    heartbeats.push(route.request().postDataJSON().health);
    return route.fulfill({ json: {} });
  });
  await routeImage(page, "first");
  await routeImage(page, "slow", slow.promise);
  await page.goto("/player/startup", { waitUntil: "domcontentloaded" });

  try {
    await expect(loader(page)).toBeVisible();
    await expect(loader(page).locator("span")).toHaveCSS("width", "44px");
    expect(
      await loader(page).evaluate((element) =>
        element.parentElement
          ? getComputedStyle(element.parentElement).backgroundColor
          : null,
      ),
    ).toBe("rgb(11, 12, 15)");
    expect(
      await loader(page)
        .locator("span")
        .evaluate(
          (spinner) => getComputedStyle(spinner, "::after").borderTopColor,
        ),
    ).toBe("rgb(255, 255, 255)");
    await page.waitForTimeout(1600);
    await expect(loader(page)).toBeVisible();
    await expect(playing(page, "first")).toBeHidden();
    expect(heartbeats.length).toBeGreaterThan(1);
    expect(heartbeats).not.toContain("playing");
  } finally {
    slow.resolve();
  }

  await expect(playing(page, "first")).toBeVisible();
  await expect(loader(page)).toBeHidden();
  await expect.poll(() => heartbeats.includes("playing")).toBe(true);
  await page.waitForTimeout(700);
  await expect(playing(page, "first")).toBeVisible();
  await expect(playing(page, "slow")).toBeVisible();
});

test("waits for a queued video to become ready before autoplay", async ({
  page,
}) => {
  const slow = Promise.withResolvers<void>();
  const video: ManifestItem = {
    ...image("video"),
    kind: "video",
    url: "/startup/slow.mp4",
    imageDurationMs: null,
    videoMode: "once",
  };
  const queue = [video, image("next")];
  await page.route("**/api/player/startup-video/manifest", (route) =>
    route.fulfill({ json: manifest(queue) }),
  );
  await page.route("**/startup/slow.mp4", async (route) => {
    await slow.promise;
    await route.fulfill({
      body: Buffer.from(videoBase64, "base64"),
      contentType: "video/mp4",
    });
  });
  await routeImage(page, "next");
  await page.goto("/player/startup-video", { waitUntil: "domcontentloaded" });
  try {
    await expect(loader(page)).toBeVisible();
    await expect(playing(page, "video")).toBeHidden();
  } finally {
    slow.resolve();
  }
  await expect(playing(page, "video")).toBeVisible();
  await expect(playing(page, "next")).toBeVisible();
});

test("starts with a ready image when another request exceeds the startup deadline", async ({
  page,
}) => {
  const stalled = Promise.withResolvers<void>();
  await page.route("**/api/player/startup-timeout/manifest", (route) =>
    route.fulfill({ json: manifest([image("stalled"), image("ready", 5000)]) }),
  );
  await routeImage(page, "stalled", stalled.promise);
  await routeImage(page, "ready");
  await page.goto("/player/startup-timeout", { waitUntil: "domcontentloaded" });
  try {
    await expect(loader(page)).toBeVisible();
    await expect(playing(page, "ready")).toBeVisible({ timeout: 14000 });
    await expect(playing(page, "stalled")).toBeHidden();
  } finally {
    stalled.resolve();
  }
  await expect(loader(page)).toBeHidden();
  await expect(playing(page, "stalled")).toBeHidden();
});

test("retries when all startup assets fail", async ({ page }) => {
  let playable = false;
  await page.route("**/api/player/startup-retry/manifest", (route) =>
    route.fulfill({ json: manifest([image("retry")]) }),
  );
  await page.route("**/startup/retry.png", (route) =>
    playable
      ? route.fulfill({ body: png, contentType: "image/png" })
      : route.abort(),
  );
  await page.goto("/player/startup-retry", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Waiting for playable media")).toBeVisible();
  playable = true;
  await expect(playing(page, "retry")).toBeVisible();
});

test("a timed override supersedes startup and ignores late normal media", async ({
  page,
}) => {
  const slow = Promise.withResolvers<void>();
  const normal = [image("late", 5000)];
  const urgent = [image("urgent", 5000)];
  const startAt = new Date(Date.now() + 1600).toISOString();
  const endAt = new Date(Date.now() + 12000).toISOString();

  let served = false;
  await page.route("**/api/player/startup-override/manifest", (route) => {
    if (served) return route.abort();
    served = true;
    return route.fulfill({
      json: {
        ...manifest(normal),
        transitions: [{ at: startAt }, { at: endAt }],
        overrideWindows: [
          {
            assignmentId: "override",
            priority: 1,
            startAt,
            endAt,
            queue: urgent,
          },
        ],
      },
    });
  });
  await routeImage(page, "late", slow.promise);
  await routeImage(page, "urgent");
  await page.goto("/player/startup-override", {
    waitUntil: "domcontentloaded",
  });
  try {
    await expect(loader(page)).toBeVisible();
    await expect(playing(page, "urgent")).toBeVisible();
  } finally {
    slow.resolve();
  }
  await expect(loader(page)).toBeHidden();
  await expect(playing(page, "late")).toBeHidden();
});

test("a changed manifest replaces the startup queue immediately", async ({
  page,
}) => {
  const slow = Promise.withResolvers<void>();
  let queue = [image("old")];
  await page.route("**/api/player/startup-refresh/manifest", (route) =>
    route.fulfill({ json: manifest(queue) }),
  );
  await routeImage(page, "old", slow.promise);
  await routeImage(page, "replacement");
  await page.goto("/player/startup-refresh", { waitUntil: "domcontentloaded" });
  try {
    await expect(loader(page)).toBeVisible();
    queue = [image("replacement")];
    await expect(playing(page, "replacement")).toBeVisible();
  } finally {
    slow.resolve();
  }
  await expect(loader(page)).toBeHidden();
  await expect(playing(page, "old")).toHaveCount(0);
});
