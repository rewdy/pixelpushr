import { type ChildProcess, spawn } from "node:child_process";
import { expect, test } from "@playwright/test";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDatabase } from "../../apps/api/src/db/client";
import {
  mediaAssets,
  mediaReplacements,
  retiredMediaObjects,
} from "../../apps/api/src/db/schema";
import { createS3Storage } from "../../apps/api/src/media/storage";
import {
  browserTestApiPort,
  testDatabaseAdminUrl,
  testS3Endpoint,
} from "../config";
import { videoBase64 } from "../fixtures/videoBase64";

test.describe.configure({ mode: "serial" });

const adminUrl = testDatabaseAdminUrl;
const s3Endpoint = testS3Endpoint;
const databaseName = `pixelpushr_browser_${crypto.randomUUID().replaceAll("-", "")}`;
const apiPort = browserTestApiPort;
const secret = "browser-test-secret-longer-than-thirty-two-characters";
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof createDatabase>;
let api: ChildProcess;
let token: string;

test.beforeAll(async () => {
  admin = postgres(adminUrl, { max: 1 });
  await admin`CREATE DATABASE ${admin(databaseName)}`;
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  connection = createDatabase(url.toString());
  await migrate(connection.db, {
    migrationsFolder: new URL("../../apps/api/drizzle", import.meta.url)
      .pathname,
  });
  api = spawn("bun", ["apps/api/src/local.ts"], {
    cwd: new URL("../../", import.meta.url).pathname,
    env: {
      ...process.env,
      PORT: String(apiPort),
      DATABASE_URL: url.toString(),
      AUTH_MODE: "local",
      APP_ENV: "local",
      LOCAL_AUTH_SECRET: secret,
      PUBLIC_WEB_URL: "http://127.0.0.1:5173",
      SMTP_URL: "smtp://127.0.0.1:1025",
      MAIL_FROM: "invites@example.com",
      MEDIA_STORAGE: "s3",
      MEDIA_BUCKET: "pixelpushr-media",
      MEDIA_PUBLIC_URL: `${s3Endpoint}/pixelpushr-media`,
      S3_ENDPOINT: s3Endpoint,
      S3_ACCESS_KEY_ID: "test",
      S3_SECRET_ACCESS_KEY: "test",
      AWS_REGION: "us-east-1",
    },
    stdio: "ignore",
  });
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error("Browser-test API did not start");
});

test("owner sets up the workspace and invites an administrator in the browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", {
      name: "Create the first account or accept an invitation",
    })
    .click();
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("browser-owner@example.com");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("owner-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("browser-owner@example.com");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("owner-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Set up your workspace" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Organization name" })
    .fill("Browser Test");
  const timezoneInput = page.getByRole("textbox", { name: "Timezone" });
  const browserZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  await expect(timezoneInput).toHaveValue(new RegExp(browserZone));
  await timezoneInput.fill("Chicago");
  await timezoneInput.press("ArrowDown");
  await timezoneInput.press("Enter");
  await expect(timezoneInput).toHaveValue(
    /America\/Chicago · UTC[-+]\d{2}:\d{2}/,
  );
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const savedZone = await page.evaluate(async () => {
    const response = await fetch("/api/admin/me", {
      headers: {
        authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
      },
    });
    return (await response.json()) as { organization: { timezone: string } };
  });
  expect(savedZone.organization.timezone).toBe("America/Chicago");
  token = await page.evaluate(
    () => sessionStorage.getItem("pixelpushr-admin-session") ?? "",
  );
  expect(token).toBeTruthy();
  await page.goto("/people");
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("browser-admin@example.com");
  const inviteResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/invitations") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send invitation" }).click();
  const invitation = await inviteResponse;
  expect(invitation.status()).toBe(201);
  const inviteUrl = ((await invitation.json()) as { url: string }).url;
  const invitedContext = await browser.newContext();
  const invited = await invitedContext.newPage();
  await invited.goto(inviteUrl);
  await invited.getByRole("link", { name: "Create an account" }).click();
  await invited
    .getByRole("textbox", { name: "Email" })
    .fill("browser-admin@example.com");
  await invited
    .getByRole("textbox", { name: "Password" })
    .fill("admin-password-123");
  await invited.getByRole("button", { name: "Create account" }).click();
  await expect(invited.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await invited
    .getByRole("textbox", { name: "Email" })
    .fill("browser-admin@example.com");
  await invited
    .getByRole("textbox", { name: "Password" })
    .fill("admin-password-123");
  await invited.getByRole("button", { name: "Sign in" }).click();
  await expect(
    invited.getByRole("heading", { name: "Accept invitation" }),
  ).toBeVisible();
  await invited.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    invited.getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
  await invitedContext.close();
  await page.reload();
  await expect(
    page.getByText("browser-admin@example.com").first(),
  ).toBeVisible();
});

test.afterAll(async () => {
  if (api) api.kill("SIGTERM");
  if (connection) {
    const storage = createS3Storage({
      region: "us-east-1",
      bucket: "pixelpushr-media",
      publicBaseUrl: `${s3Endpoint}/pixelpushr-media`,
      endpoint: s3Endpoint,
      accessKeyId: "test",
      secretAccessKey: "test",
    });
    for (const asset of await connection.db
      .select({
        objectKey: mediaAssets.objectKey,
        thumbnailKey: mediaAssets.thumbnailKey,
      })
      .from(mediaAssets)) {
      await storage.remove(asset.objectKey);
      if (asset.thumbnailKey) await storage.remove(asset.thumbnailKey);
    }
    for (const candidate of await connection.db
      .select({ objectKey: mediaReplacements.objectKey })
      .from(mediaReplacements))
      await storage.remove(candidate.objectKey);
    for (const retired of await connection.db
      .select({ objectKey: retiredMediaObjects.objectKey })
      .from(retiredMediaObjects))
      await storage.remove(retired.objectKey);
  }
  if (connection) await connection.close();
  if (admin) {
    await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`;
    await admin.end();
  }
});

test("video uploads get a poster when possible and stay ready when poster upload fails", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/media");
  const video = Buffer.from(videoBase64, "base64");
  await page.locator('input[type="file"]').setInputFiles({
    name: "poster-video.mp4",
    mimeType: "video/mp4",
    buffer: video,
  });
  await expect(page.getByText("Media is ready for playlists.")).toBeVisible();
  const posters = await page.evaluate(async () => {
    const response = await fetch("/api/admin/media", {
      headers: {
        authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
      },
    });
    return (await response.json()) as {
      assets: { name: string; status: string; previewUrl: string | null }[];
    };
  });
  expect(
    posters.assets.find((asset) => asset.name === "poster-video.mp4"),
  ).toMatchObject({
    status: "ready",
    previewUrl: expect.stringContaining("pixelpushr-media"),
  });

  await page.route("**/api/admin/media/*/thumbnail", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "internal_error", message: "Fixture failure" } },
    }),
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "fallback-video.mp4",
    mimeType: "video/mp4",
    buffer: video,
  });
  await expect(
    page
      .getByTestId("upload-entry")
      .filter({ hasText: "fallback-video.mp4" })
      .getByText("ready"),
  ).toBeVisible();
  const fallback = await page.evaluate(async () => {
    const response = await fetch("/api/admin/media", {
      headers: {
        authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
      },
    });
    return (await response.json()) as {
      assets: { name: string; status: string; previewUrl: string | null }[];
    };
  });
  expect(
    fallback.assets.find((asset) => asset.name === "fallback-video.mp4"),
  ).toMatchObject({
    status: "ready",
    previewUrl: null,
  });
});

test("a mixed picker batch keeps successful image and video uploads when one file is rejected", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/media");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles([
    { name: "batch-image.png", mimeType: "image/png", buffer: png },
    {
      name: "batch-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from(videoBase64, "base64"),
    },
    {
      name: "unsupported.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not media"),
    },
  ]);
  const entry = (name: string) =>
    page.getByTestId("upload-entry").filter({ hasText: name });
  await expect(entry("batch-image.png").getByText("ready")).toBeVisible();
  await expect(entry("batch-video.mp4").getByText("ready")).toBeVisible();
  await expect(entry("unsupported.txt").getByText("failed")).toBeVisible();
  await expect(entry("unsupported.txt")).toContainText("Unsupported file type");
  await expect(
    page.getByRole("row").filter({ hasText: "batch-image.png" }),
  ).toContainText("ready");
  await expect(
    page.getByRole("row").filter({ hasText: "batch-video.mp4" }),
  ).toContainText("ready");
});

test("upload media and publish an ordered playlist through the real API", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/media");
  await expect(
    page.getByRole("heading", { name: "Media library" }),
  ).toBeVisible();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "brand.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Media is ready for playlists.")).toBeVisible();
  await page.goto("/playlists");
  await page.getByRole("textbox", { name: "New playlist" }).fill("Brand loop");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await expect(page.getByRole("heading", { name: "Brand loop" })).toBeVisible();
  await page.getByRole("button", { name: "Add media" }).click();
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await page.getByRole("button", { name: "Save playlist" }).click();
  await expect(page.getByText("Playlist saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("brand.png", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }),
  ).toHaveValue("8");
  await page.goto("/displays");
  await page.getByRole("textbox", { name: "Display name" }).fill("Lobby TV");
  await page.getByRole("button", { name: "Register display" }).click();
  await expect(page.getByText("Lobby TV")).toBeVisible();
  await page.getByRole("link", { name: "Assign playlists" }).click();
  await page.getByRole("button", { name: "Add playlist" }).click();
  const drawer = page.getByRole("dialog", { name: "Add playlist" });
  await expect(drawer.getByRole("radio", { name: "Always-on" })).toBeChecked();
  await expect(drawer.getByRole("textbox", { name: "Start" })).toHaveCount(0);
  await drawer.getByRole("textbox", { name: "Playlist" }).click();
  await page.getByRole("option", { name: "Brand loop" }).click();
  await drawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByText("Always active · Position 1")).toBeVisible();
  const playerUrl = await page
    .getByRole("link", { name: "Open player" })
    .getAttribute("href");
  if (!playerUrl) throw new Error("Player link has no URL");
  const player = await page.context().newPage();
  await player.goto(playerUrl);
  await expect(
    player.locator('img[data-player-layer="current"]'),
  ).toBeVisible();
  expect(
    await player
      .locator('img[data-player-layer="current"]')
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await player.close();
  await page.goto("/playlists");
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Weekly campaign");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("button", { name: "Add media" }).click();
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await page.getByRole("button", { name: "Save playlist" }).click();
  await page.goto("/displays");
  await page.getByRole("link", { name: "Assign playlists" }).click();
  await page.getByRole("button", { name: "Add playlist" }).click();
  const scheduledDrawer = page.getByRole("dialog", { name: "Add playlist" });
  await scheduledDrawer.getByRole("radio", { name: "Scheduled" }).check();
  await expect(
    scheduledDrawer.getByRole("radio", { name: "Append" }),
  ).toBeChecked();
  await expect(
    scheduledDrawer.getByRole("checkbox", { name: "Activate now" }),
  ).toHaveCount(0);
  await scheduledDrawer.getByRole("textbox", { name: "Playlist" }).click();
  await page.getByRole("option", { name: "Weekly campaign" }).click();
  await scheduledDrawer
    .getByRole("textbox", { name: "Start", exact: true })
    .fill("2026-09-07T00:00");
  await scheduledDrawer
    .getByRole("textbox", { name: "End", exact: true })
    .fill("2026-09-06T00:00");
  await scheduledDrawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(
    scheduledDrawer.getByText("Schedule end must be after start."),
  ).toBeVisible();
  await scheduledDrawer
    .getByRole("textbox", { name: "End", exact: true })
    .fill("2026-09-14T00:00");
  await scheduledDrawer
    .getByRole("textbox", { name: "Repeat", exact: true })
    .click();
  await page.getByRole("option", { name: "Every N weeks" }).click();
  await scheduledDrawer
    .getByRole("textbox", { name: "Repeat every (weeks)" })
    .fill("3");
  await scheduledDrawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(scheduledDrawer).toBeHidden();
  await expect(page.getByText("Append", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Preview at" })
    .fill("2026-09-08T12:00");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText("Brand loop → Weekly campaign")).toBeVisible();
  await page.getByRole("button", { name: "Add playlist" }).click();
  const overrideDrawer = page.getByRole("dialog", { name: "Add playlist" });
  await overrideDrawer.getByRole("radio", { name: "Scheduled" }).check();
  await overrideDrawer.getByRole("radio", { name: "Override" }).check();
  await expect(
    overrideDrawer.getByRole("textbox", { name: "Repeat" }),
  ).toHaveCount(0);
  await overrideDrawer.getByRole("textbox", { name: "Playlist" }).click();
  await page.getByRole("option", { name: "Weekly campaign" }).click();
  await overrideDrawer.getByRole("checkbox", { name: "Activate now" }).check();
  await expect(
    overrideDrawer.getByRole("textbox", { name: "Start" }),
  ).toHaveCount(0);
  await overrideDrawer
    .getByRole("textbox", { name: "Expiration" })
    .fill("2099-01-01T00:00");
  await overrideDrawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(page.getByText("Override", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Remove .* always/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Remove .* scheduled/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Remove .* override/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /Remove .* override/ }).click();
  await expect(
    page.getByRole("button", { name: /Remove .* override/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Remove .* scheduled/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Remove .* always/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /Remove .* scheduled/ }).click();
  await expect(
    page.getByRole("button", { name: /Remove .* scheduled/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Remove .* always/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /Remove .* always/ }).click();
  await expect(
    page.getByText("No playlists assigned. Add one to start playback."),
  ).toBeVisible();
});

test("visual picker and bulk draft edits preserve duplicate items and save boundary", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/playlists");
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Bulk editor test");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await expect(
    page.getByRole("heading", { name: "Bulk editor test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add media" }).click();
  const filter = page.getByRole("textbox", { name: "Search ready media" });
  await filter.fill("poster-video");
  await expect(
    page.getByRole("button", { name: "Add poster-video.mp4" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add brand.png" })).toHaveCount(
    0,
  );
  await filter.clear();
  await page.getByRole("button", { name: "Close media" }).click();
  await expect(
    page.getByRole("textbox", { name: "Search ready media" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add media" }).click();
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await page.getByRole("button", { name: "Add poster-video.mp4" }).click();
  await page.getByRole("button", { name: "Add fallback-video.mp4" }).click();
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }),
  ).toHaveCount(2);
  const refetch = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/playlists/") &&
      response.request().method() === "GET",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await refetch;
  await expect(page.getByRole("checkbox", { name: /Select item/ })).toHaveCount(
    4,
  );
  await expect(
    page.getByLabel("Video thumbnail unavailable").first(),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Video playback" }).first().click();
  await page.getByRole("option", { name: "Repeat for duration" }).click();
  await page.getByRole("checkbox", { name: "Select item 1" }).check();
  await page.getByRole("checkbox", { name: "Select item 3" }).check();
  await page.getByRole("checkbox", { name: "Select item 4" }).check();
  await expect(
    page.getByText("3 selected · 2 can receive a duration"),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Bulk duration (seconds)" })
    .fill("12");
  await page.getByRole("button", { name: "Apply duration" }).click();
  await expect(page.getByText("2 items updated.")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }).first(),
  ).toHaveValue("12");
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }).nth(1),
  ).toHaveValue("8");
  await expect(
    page.getByRole("textbox", { name: "Repeat seconds" }),
  ).toHaveValue("12");
  await page.getByRole("button", { name: "Deselect all" }).click();
  await expect(page.getByRole("button", { name: "Deselect all" })).toHaveCount(
    0,
  );
  for (const position of [1, 2, 3, 4])
    await expect(
      page.getByRole("checkbox", { name: `Select item ${position}` }),
    ).not.toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }).first(),
  ).toHaveValue("12");
  await expect(
    page.getByRole("textbox", { name: "Repeat seconds" }),
  ).toHaveValue("12");
  await page.getByRole("button", { name: "Save playlist" }).click();
  await expect(page.getByText("Playlist saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Select item/ })).toHaveCount(
    4,
  );
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }).first(),
  ).toHaveValue("12");
  await expect(
    page.getByRole("textbox", { name: "Repeat seconds" }),
  ).toHaveValue("12");
  await page.getByRole("checkbox", { name: "Select item 1" }).check();
  await page.getByRole("checkbox", { name: "Select item 3" }).check();
  await page.getByRole("checkbox", { name: "Select item 4" }).check();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(page.getByRole("checkbox", { name: /Select item/ })).toHaveCount(
    1,
  );
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Select item/ })).toHaveCount(
    4,
  );
  await page.setViewportSize({ width: 700, height: 800 });
  await page.getByRole("button", { name: "Add media" }).click();
  await expect(page.getByRole("dialog", { name: "Ready media" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search ready media" }),
  ).toBeVisible();
});

test("draft preview loops images and videos without publishing", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/playlists");
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Preview test");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(page.getByText("No items in this preview")).toBeVisible();
  await page.getByRole("button", { name: "Add media" }).click();
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await page.getByRole("button", { name: "Add poster-video.mp4" }).click();
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "IMG",
  );
  await page.getByRole("textbox", { name: "Display seconds" }).fill("1");
  await expect(page.getByText(/\d+%/)).toBeVisible();
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "VIDEO",
    { timeout: 4000 },
  );
  await page.getByRole("button", { name: "Hide preview" }).click();
  await expect(page.getByTestId("compact-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "IMG",
  );
  await page.getByRole("textbox", { name: "Display seconds" }).fill("3");
  await page.waitForTimeout(1300);
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "IMG",
  );
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "IMG",
  );
  await page.reload();
  await expect(page.getByText("This playlist is empty.")).toBeVisible();
});

test("draft preview repeats video until its configured duration", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/playlists");
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Repeat preview test");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("button", { name: "Add media" }).click();
  await page.getByRole("button", { name: "Add poster-video.mp4" }).click();
  await page.getByRole("button", { name: "Add brand.png" }).click();
  await page.getByRole("textbox", { name: "Video playback" }).click();
  await page.getByRole("option", { name: "Repeat for duration" }).click();
  await page.getByRole("textbox", { name: "Repeat seconds" }).fill("2");
  await page.getByRole("textbox", { name: "Display seconds" }).fill("1");
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "VIDEO",
  );
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "VIDEO",
  );
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "IMG",
    { timeout: 2500 },
  );
  await expect(page.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "VIDEO",
    { timeout: 2500 },
  );
});

test("media library manages rename, tags, replacement, and informed deletion", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/media");
  const row = () => page.getByRole("row").filter({ hasText: "brand" });
  await row().getByRole("button", { name: "Rename" }).click();
  const rename = page.getByRole("dialog", { name: "Rename brand.png" });
  await rename
    .getByRole("textbox", { name: "Asset name" })
    .fill("brand refreshed.png");
  await rename.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "brand refreshed.png" }),
  ).toBeVisible();
  await row().getByRole("button", { name: "Tags" }).click();
  const tagsDialog = page.getByRole("dialog", {
    name: "Edit tags for brand refreshed.png",
  });
  await tagsDialog.getByRole("textbox", { name: "Tags" }).fill("Weekly");
  await tagsDialog.getByRole("textbox", { name: "Tags" }).press("Enter");
  await tagsDialog.getByRole("button", { name: "Save tags" }).click();
  await expect(row()).toContainText("Weekly");
  await page.getByRole("textbox", { name: "Filter by tags" }).click();
  await page.getByRole("option", { name: "Weekly" }).click();
  await expect(row()).toBeVisible();
  await page.getByRole("textbox", { name: "Search media" }).fill("not-a-match");
  await expect(row()).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search media" }).fill("");
  await row().getByRole("button", { name: "Replace" }).click();
  const replace = page.getByRole("dialog", {
    name: "Replace brand refreshed.png",
  });
  await replace.locator('input[type="file"]').setInputFiles({
    name: "brand-new.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(replace).toBeHidden();
  await expect(row()).toContainText("brand refreshed.png");
  await expect(row()).toContainText("Weekly");
  await page.goto("/playlists");
  await page
    .getByRole("row")
    .filter({ hasText: "Brand loop" })
    .getByRole("link", { name: "Edit" })
    .click();
  const brandPlaylistId = page.url().split("/").at(-1);
  if (!brandPlaylistId) throw new Error("Missing Brand loop ID");
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }),
  ).toHaveValue("8");
  await page.getByRole("button", { name: "Add media" }).click();
  await page.getByRole("textbox", { name: "Filter by tags" }).click();
  await page.getByRole("option", { name: "Weekly" }).click();
  await expect(
    page.getByRole("button", { name: "Add brand refreshed.png" }),
  ).toBeVisible();
  await page.goto("/media");
  await row().getByRole("button", { name: "Delete" }).click();
  const remove = page.getByRole("dialog", {
    name: "Delete brand refreshed.png",
  });
  await expect(remove).toContainText("Brand loop: 1 item");
  await expect(remove).toContainText("from existing playlists");
  const staleSaveStatus = await page.evaluate(async (playlistId) => {
    const auth = {
      authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
    };
    const listed = await fetch("/api/admin/media", { headers: auth });
    const assets = (await listed.json()) as {
      assets: Array<{ id: string; name: string }>;
    };
    const asset = assets.assets.find(
      (item) => item.name === "brand refreshed.png",
    );
    if (!asset) throw new Error("Missing media asset");
    const saved = await fetch(`/api/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          { mediaAssetId: asset.id, imageDurationMs: 8000 },
          { mediaAssetId: asset.id, imageDurationMs: 3000 },
        ],
      }),
    });
    return saved.status;
  }, brandPlaylistId);
  expect(staleSaveStatus).toBe(200);
  await remove
    .getByRole("button", { name: "Delete asset and playlist uses" })
    .click();
  await expect(remove).toContainText(
    "Playlist uses changed; review deletion impact again",
  );
  await expect(remove).toContainText("Brand loop: 2 items");
  await remove
    .getByRole("button", { name: "Delete asset and playlist uses" })
    .click();
  await expect(remove).toBeHidden();
  await expect(row()).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({
    name: "unused-for-delete.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  const unusedRow = page
    .getByRole("row")
    .filter({ hasText: "unused-for-delete.png" });
  await expect(unusedRow).toBeVisible();
  await unusedRow.getByRole("button", { name: "Delete" }).click();
  const unusedDialog = page.getByRole("dialog", {
    name: "Delete unused-for-delete.png",
  });
  await expect(unusedDialog).toContainText("not used by any saved playlist");
  await unusedDialog.getByRole("button", { name: "Delete asset" }).click();
  await expect(unusedRow).toHaveCount(0);
});
