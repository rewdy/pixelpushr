import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { videoBase64 } from "../fixtures/videoBase64";

const imageUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==";
const videoUrl = `data:video/mp4;base64,${videoBase64}`;
const longVideoUrl = `data:video/mp4;base64,${readFileSync(new URL("../fixtures/crossfade.mp4", import.meta.url)).toString("base64")}`;

const manifest = (mode: "once" | "repeat", repeatDurationMs: number | null) => {
  const video = {
    id: "video",
    playlistId: "playlist",
    assetId: "video",
    kind: "video",
    url: mode === "once" ? longVideoUrl : videoUrl,
    imageDurationMs: null,
    videoMode: mode,
    repeatDurationMs,
  };
  const image = {
    id: "image",
    playlistId: "playlist",
    assetId: "image",
    kind: "image",
    url: imageUrl,
    imageDurationMs: 5000,
    videoMode: null,
    repeatDurationMs: null,
  };
  return {
    display: { id: "fixture", name: "Fixture" },
    version: `${mode}-${repeatDurationMs}`,
    serverTime: new Date().toISOString(),
    normalQueue: [video, image],
    activeQueue: [video, image],
    override: null,
    transitions: [],
  };
};

test("video play-once advances after the file ends", async ({ page }) => {
  await page.route("**/api/player/once/manifest", (route) =>
    route.fulfill({ json: manifest("once", null) }),
  );
  await page.route("**/api/player/once/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.goto("/player/once");
  await expect(
    page.locator('video[data-player-layer="current"]'),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const video = document.querySelector(
            'video[data-player-layer="current"]',
          );
          const image = document.querySelector(
            'img[data-player-layer="incoming"]',
          );
          if (!video || !image) return false;
          const opacity = Number(getComputedStyle(image).opacity);
          return opacity > 0.05 && opacity < 0.95;
        }),
      { intervals: [25], timeout: 4500 },
    )
    .toBe(true);
  await expect(page.locator('img[data-player-layer="current"]')).toBeVisible({
    timeout: 5000,
  });
  expect(await page.locator('video[data-player-layer="current"]').count()).toBe(
    0,
  );
});

test("video repeat remains active until its duration expires", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tracked = window as Window & { sawRepeatFade?: boolean };
    const observe = () => {
      const video = document.querySelector(
        'video[data-player-layer="current"]',
      );
      const image = document.querySelector('img[data-player-layer="incoming"]');
      if (video && image) {
        const opacity = Number(getComputedStyle(image).opacity);
        if (opacity > 0.05 && opacity < 0.95) tracked.sawRepeatFade = true;
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  await page.route("**/api/player/repeat/manifest", (route) =>
    route.fulfill({ json: manifest("repeat", 2400) }),
  );
  await page.route("**/api/player/repeat/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  const started = Date.now();
  await page.goto("/player/repeat");
  const video = page.locator('video[data-player-layer="current"]');
  await expect(video).toBeVisible();
  await video.evaluate((element) => {
    element.addEventListener("ended", () => {
      element.dataset.loopCount = String(
        Number(element.dataset.loopCount ?? 0) + 1,
      );
    });
  });
  await page.waitForTimeout(700);
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.getAttribute("data-loop-count"), { timeout: 1800 })
    .not.toBeNull();
  await expect(page.locator('img[data-player-layer="current"]')).toBeVisible({
    timeout: 10000,
  });
  expect(Date.now() - started).toBeGreaterThanOrEqual(2200);
  expect(
    await page.evaluate(
      () => !!(window as Window & { sawRepeatFade?: boolean }).sawRepeatFade,
    ),
  ).toBe(true);
});

test("play-once video cuts at ended when duration is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      get: () => Number.NaN,
      configurable: true,
    });
    const tracked = window as Window & { sawFade?: boolean };
    const observe = () => {
      const incoming = document.querySelector(
        '[data-player-layer="incoming"][data-player-item="image"]',
      );
      if (incoming && Number(getComputedStyle(incoming).opacity) > 0.05)
        tracked.sawFade = true;
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  await page.route("**/api/player/unknown-duration/manifest", (route) =>
    route.fulfill({ json: manifest("once", null) }),
  );
  await page.route("**/api/player/unknown-duration/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.goto("/player/unknown-duration");
  await expect(
    page.locator('video[data-player-layer="current"]'),
  ).toBeVisible();
  await expect(page.locator('img[data-player-layer="current"]')).toBeVisible({
    timeout: 5000,
  });
  expect(
    await page.evaluate(
      () => !!(window as Window & { sawFade?: boolean }).sawFade,
    ),
  ).toBe(false);
});
