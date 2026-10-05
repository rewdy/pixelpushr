import { type ChildProcess, spawn } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDatabase } from "../../apps/api/src/db/client";
import {
  displays,
  mediaAssets,
  mediaReplacements,
  playlistItems,
  playlists,
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
let administratorToken: string;

const chooseCalendarDate = async (
  page: Page,
  control: Locator,
  date: string,
) => {
  await control.click();
  const dropdownId = await control.getAttribute("aria-controls");
  if (!dropdownId) throw new Error("Date control has no popup reference");
  const dropdown = page.locator(`[data-dates-dropdown][id="${dropdownId}"]`);
  await expect(dropdown.locator('th[class*="weekday"]').first()).toHaveText(
    "Su",
  );
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day)
    throw new Error(`Invalid calendar date: ${date}`);
  const monthLevel = dropdown.locator("[data-month-level]");
  for (let attempt = 0; attempt < 24; attempt++) {
    const shown = await monthLevel
      .locator('[class*="calendarHeaderLevel"]')
      .textContent();
    const current = new Date(`${shown} 1`);
    const delta =
      year * 12 + month - (current.getFullYear() * 12 + current.getMonth() + 1);
    if (delta === 0) break;
    await monthLevel
      .locator(`button[data-direction="${delta > 0 ? "next" : "previous"}"]`)
      .click();
    if (attempt === 23) throw new Error(`Calendar could not reach ${date}`);
  }
  const longMonth = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const dayName = `${day} ${longMonth} ${year}`;
  const dayControl = dropdown.getByRole("button", {
    name: dayName,
    exact: true,
  });
  await dayControl.focus();
  await dayControl.press("Enter");
  return dropdown;
};

const chooseDateTime = async (
  page: Page,
  scope: Locator,
  label: string,
  local: string,
) => {
  const [date, time] = local.split("T");
  if (!date || !time) throw new Error(`Invalid local datetime: ${local}`);
  const dropdown = await chooseCalendarDate(
    page,
    scope.getByRole("button", { name: label, exact: true }),
    date,
  );
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === undefined || minutes === undefined)
    throw new Error(`Invalid time: ${time}`);
  await dropdown
    .getByRole("spinbutton", { name: "Hours" })
    .fill(String(hours % 12 || 12));
  await dropdown
    .getByRole("spinbutton", { name: "Minutes" })
    .fill(String(minutes));
  await dropdown
    .getByRole("textbox", { name: "AM/PM" })
    .press(hours < 12 ? "a" : "p");
  await dropdown.locator('button[class*="submitButton"]').click();
};

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
  await page.getByRole("button", { name: "Send invitation" }).click();
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("browser-admin@example.com");
  const inviteResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/invitations") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name: "Send invitation" })
    .getByRole("button", { name: "Send invitation" })
    .click();
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
  administratorToken = await invited.evaluate(
    () => sessionStorage.getItem("pixelpushr-admin-session") ?? "",
  );
  expect(administratorToken).toBeTruthy();
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
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("textbox", { name: "New playlist" }).fill("Brand loop");
  await page
    .getByRole("dialog", { name: "Create playlist" })
    .getByRole("button", { name: "Create playlist" })
    .click();
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
  await page.getByRole("button", { name: "Register display" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill("Lobby TV");
  await page
    .getByRole("dialog", { name: "Register display" })
    .getByRole("button", { name: "Register display" })
    .click();
  await expect(page.getByText("Lobby TV")).toBeVisible();
  await page.getByRole("link", { name: "Assign playlists" }).click();
  await page.getByRole("button", { name: "Add playlist" }).click();
  const drawer = page.getByRole("dialog", { name: "Add playlist" });
  await expect(drawer.getByRole("radio", { name: "Always-on" })).toBeChecked();
  await expect(drawer.getByRole("button", { name: "Start" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Weekly campaign");
  await page
    .getByRole("dialog", { name: "Create playlist" })
    .getByRole("button", { name: "Create playlist" })
    .click();
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
  await chooseDateTime(page, scheduledDrawer, "Start", "2026-09-07T00:00");
  await chooseDateTime(page, scheduledDrawer, "End", "2026-09-06T00:00");
  await scheduledDrawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(
    scheduledDrawer.getByText("Schedule end must be after start."),
  ).toBeVisible();
  await chooseDateTime(page, scheduledDrawer, "End", "2026-09-14T00:00");
  await scheduledDrawer
    .getByRole("textbox", { name: "Repeat", exact: true })
    .click();
  await page.getByRole("option", { name: "Weekly" }).click();
  await scheduledDrawer
    .getByRole("textbox", { name: "Repeat every (weeks)" })
    .fill("3");
  await scheduledDrawer.locator(".mantine-MultiSelect-input").click();
  await expect(page.getByRole("option").first()).toHaveText("Sunday");
  await page.getByRole("option", { name: "Sunday" }).click();
  await page.getByRole("option", { name: "Monday" }).click();
  const sundayRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes("/schedules"),
  );
  await scheduledDrawer.getByRole("button", { name: "Add playlist" }).click();
  expect((await sundayRequest).postDataJSON()).toMatchObject({
    recurrence: "weekly",
    weekdays: [7, 1],
  });
  await expect(scheduledDrawer).toBeHidden();
  await expect(page.getByText("Append", { exact: true })).toBeVisible();
  await chooseDateTime(
    page,
    page.locator("body"),
    "Preview at",
    "2026-09-08T12:00",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText("Brand loop → Weekly campaign")).toBeVisible();
  await page.getByRole("button", { name: "Add playlist" }).click();
  const overrideDrawer = page.getByRole("dialog", { name: "Add playlist" });
  await overrideDrawer.getByRole("radio", { name: "Scheduled" }).check();
  await overrideDrawer.getByRole("radio", { name: "Override" }).check();
  await expect(
    overrideDrawer.getByRole("textbox", { name: "Repeat", exact: true }),
  ).toBeVisible();
  await overrideDrawer.getByRole("textbox", { name: "Playlist" }).click();
  await page.getByRole("option", { name: "Weekly campaign" }).click();
  await overrideDrawer.getByRole("checkbox", { name: "Activate now" }).check();
  await expect(
    overrideDrawer.getByRole("button", { name: "Start" }),
  ).toHaveCount(0);
  await chooseDateTime(page, overrideDrawer, "Expiration", "2027-01-01T00:00");
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

test("listing links and creation dialogs preserve input and permissions", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/playlists");
  const playlistLink = page.getByRole("link", { name: "Brand loop" });
  await playlistLink.focus();
  await playlistLink.press("Enter");
  await expect(page).toHaveURL(/\/playlists\/[a-f0-9-]+$/);
  await page.goto("/playlists");
  await page.getByRole("button", { name: "Create playlist" }).click();
  const playlistDialog = page.getByRole("dialog", { name: "Create playlist" });
  await playlistDialog
    .getByRole("textbox", { name: "New playlist" })
    .fill("Cancel me");
  await playlistDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(playlistDialog).toBeHidden();
  await page.getByRole("button", { name: "Create playlist" }).click();
  await expect(
    playlistDialog.getByRole("textbox", { name: "New playlist" }),
  ).toBeEmpty();
  await playlistDialog.getByRole("button", { name: "Create playlist" }).click();
  await expect(
    playlistDialog.getByText("Enter a playlist name."),
  ).toBeVisible();
  await playlistDialog
    .getByRole("textbox", { name: "New playlist" })
    .fill("Retry playlist");
  await page.route(
    "**/api/admin/playlists",
    (route) =>
      route.fulfill({
        status: 500,
        json: { error: { code: "internal", message: "Playlist unavailable" } },
      }),
    { times: 1 },
  );
  await playlistDialog.getByRole("button", { name: "Create playlist" }).click();
  await expect(playlistDialog.getByText("Playlist unavailable")).toBeVisible();
  await expect(
    playlistDialog.getByRole("textbox", { name: "New playlist" }),
  ).toHaveValue("Retry playlist");

  await page.goto("/displays");
  const displayLink = page.getByRole("link", { name: "Lobby TV", exact: true });
  await displayLink.focus();
  await displayLink.press("Enter");
  await expect(page).toHaveURL(/\/displays\/[a-f0-9-]+$/);
  await page.goto("/displays");
  await page.getByRole("button", { name: "Register display" }).click();
  const displayDialog = page.getByRole("dialog", { name: "Register display" });
  await displayDialog
    .getByRole("textbox", { name: "Display name" })
    .fill("Cancel screen");
  await displayDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(displayDialog).toBeHidden();
  await page.getByRole("button", { name: "Register display" }).click();
  await displayDialog.getByRole("button", { name: "Register display" }).click();
  await expect(displayDialog.getByText("Enter a display name.")).toBeVisible();
  await displayDialog
    .getByRole("textbox", { name: "Display name" })
    .fill("Retry display");
  await page.route(
    "**/api/admin/displays",
    (route) =>
      route.fulfill({
        status: 500,
        json: { error: { code: "internal", message: "Display unavailable" } },
      }),
    { times: 1 },
  );
  await displayDialog.getByRole("button", { name: "Register display" }).click();
  await expect(displayDialog.getByText("Display unavailable")).toBeVisible();
  await expect(
    displayDialog.getByRole("textbox", { name: "Display name" }),
  ).toHaveValue("Retry display");
  await displayDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(displayDialog).toBeHidden();

  await page.goto("/people");
  await page.getByRole("button", { name: "Send invitation" }).click();
  const inviteDialog = page.getByRole("dialog", { name: "Send invitation" });
  await inviteDialog
    .getByRole("textbox", { name: "Email address" })
    .fill("cancel@example.com");
  await inviteDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(inviteDialog).toBeHidden();
  await page.getByRole("button", { name: "Send invitation" }).click();
  await inviteDialog
    .getByRole("textbox", { name: "Email address" })
    .fill("invalid");
  await inviteDialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    inviteDialog.getByText("Enter a valid email address."),
  ).toBeVisible();
  await inviteDialog
    .getByRole("textbox", { name: "Email address" })
    .fill("retry@example.com");
  await page.route(
    "**/api/admin/invitations",
    (route) =>
      route.fulfill({
        status: 500,
        json: {
          error: { code: "internal", message: "Invitation unavailable" },
        },
      }),
    { times: 1 },
  );
  await inviteDialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(inviteDialog.getByText("Invitation unavailable")).toBeVisible();
  await expect(
    inviteDialog.getByRole("textbox", { name: "Email address" }),
  ).toHaveValue("retry@example.com");
  await inviteDialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(inviteDialog).toBeHidden();
  await expect(page.getByText("Invitation sent.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();

  await page.evaluate(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    administratorToken,
  );
  await page.goto("/people");
  await expect(
    page.getByRole("button", { name: "Send invitation" }),
  ).toHaveCount(0);
});

test("recurring Override creation and settings edits use the shared schedule controls", async ({
  page,
}) => {
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/displays");
  await page.getByRole("link", { name: "Assign playlists" }).click();
  await page.getByRole("button", { name: "Add playlist" }).click();
  const drawer = page.getByRole("dialog", { name: "Add playlist" });
  await drawer.getByRole("radio", { name: "Scheduled" }).check();
  await drawer.getByRole("radio", { name: "Override" }).check();
  await drawer.getByRole("textbox", { name: "Playlist" }).click();
  await page.getByRole("option", { name: "Weekly campaign" }).click();
  await chooseDateTime(page, drawer, "Start", "2026-01-31T09:00");
  await chooseDateTime(page, drawer, "Expiration", "2026-01-31T10:00");
  await drawer.getByRole("textbox", { name: "Repeat", exact: true }).click();
  await page.getByRole("option", { name: "Monthly" }).click();
  const repeatBox = await drawer
    .getByRole("textbox", { name: "Repeat", exact: true })
    .boundingBox();
  const intervalBox = await drawer
    .getByRole("textbox", { name: "Repeat every (months)" })
    .boundingBox();
  const priorityBox = await drawer
    .getByRole("textbox", { name: "Priority" })
    .boundingBox();
  const drawerBox = await drawer.boundingBox();
  if (!repeatBox || !intervalBox || !priorityBox || !drawerBox)
    throw new Error("Schedule layout controls were not rendered");
  expect(Math.abs(repeatBox.y - intervalBox.y)).toBeLessThan(8);
  expect(priorityBox.width).toBeLessThan(drawerBox.width / 2);
  await expect(
    drawer.getByRole("checkbox", { name: "Activate now" }),
  ).toBeDisabled();
  await drawer.getByRole("textbox", { name: "Day of month" }).fill("31");
  await drawer
    .getByRole("checkbox", { name: "Set last occurrence date" })
    .check();
  await chooseCalendarDate(
    page,
    drawer.getByRole("button", { name: "Last occurrence date" }),
    "2026-12-31",
  );
  await drawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(drawer).toBeHidden();
  await expect(
    page.getByText(
      /Every month on day 31 \(missing dates skipped\).*Last start 2026-12-31/,
    ),
  ).toBeVisible();
  await chooseDateTime(
    page,
    page.locator("body"),
    "Preview at",
    "2026-02-28T09:30",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText("No content at this time")).toBeVisible();
  await chooseDateTime(
    page,
    page.locator("body"),
    "Preview at",
    "2026-03-31T09:30",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByText(/Winning override: Weekly campaign/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Weekly campaign override settings" })
    .click();
  const edit = page.getByRole("dialog", {
    name: "Edit Weekly campaign settings",
  });
  await expect(edit.getByRole("button", { name: /Start/ })).toContainText(
    "Jan 31, 2026 9:00 AM",
  );
  await expect(
    edit.getByRole("button", { name: "Save settings" }),
  ).toBeDisabled();
  let unchangedWrites = 0;
  const countEditWrites = (request: import("@playwright/test").Request) => {
    if (request.method() === "PATCH" && request.url().includes("/assignments/"))
      unchangedWrites += 1;
  };
  page.on("request", countEditWrites);
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeHidden();
  expect(unchangedWrites).toBe(0);
  page.off("request", countEditWrites);
  await page
    .getByRole("button", { name: "Edit Weekly campaign override settings" })
    .click();
  await edit.getByRole("textbox", { name: "Repeat", exact: true }).click();
  await page.getByRole("option", { name: "Daily" }).click();
  await edit.getByRole("textbox", { name: "Repeat every (days)" }).fill("2");
  const overrideRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" && request.url().includes("/assignments/"),
  );
  await edit.getByRole("button", { name: "Save settings" }).click();
  const overrideBody = (await overrideRequest).postDataJSON() as Record<
    string,
    unknown
  >;
  expect(overrideBody).toMatchObject({
    recurrence: "daily",
    repeatInterval: 2,
    monthDay: null,
  });
  expect(overrideBody).not.toHaveProperty("startLocal");
  expect(overrideBody).not.toHaveProperty("endLocal");
  await expect(edit).toBeHidden();
  await expect(
    page.getByText(/Every 2 days.*Last start 2026-12-31/),
  ).toBeVisible();
  await chooseDateTime(
    page,
    page.locator("body"),
    "Preview at",
    "2026-02-02T09:30",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText(/Winning override/)).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Weekly campaign override settings" })
    .click();
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeHidden();
  await page
    .getByRole("button", { name: "Edit Weekly campaign override settings" })
    .click();
  await page.evaluate(async (accessToken) => {
    const displayId = window.location.pathname.split("/").at(-1);
    const path = `/api/admin/displays/${displayId}/assignments`;
    const headers = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    };
    const list = await fetch(path, { headers });
    const data = (await list.json()) as {
      assignments: { id: string; mode: string; version: string }[];
    };
    const assignment = data.assignments.find(
      (item) => item.mode === "override",
    );
    if (!assignment) throw new Error("Override assignment missing");
    const changed = await fetch(`${path}/${assignment.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        expectedVersion: assignment.version,
        priority: 8,
      }),
    });
    if (!changed.ok)
      throw new Error(`Concurrent edit returned ${changed.status}`);
  }, token);
  await edit.getByRole("textbox", { name: "Priority" }).fill("4");
  await edit.getByRole("button", { name: "Save settings" }).click();
  await expect(
    edit.getByText(/Assignment changed; reload its settings/),
  ).toBeVisible();
  await edit.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Add playlist" }).click();
  await drawer.getByRole("radio", { name: "Scheduled" }).check();
  await drawer.getByRole("textbox", { name: "Playlist" }).click();
  await page.getByRole("option", { name: "Brand loop" }).click();
  await chooseDateTime(page, drawer, "Start", "2026-01-30T09:00");
  await chooseDateTime(page, drawer, "End", "2026-01-30T10:00");
  await drawer.getByRole("textbox", { name: "Repeat", exact: true }).click();
  await page.getByRole("option", { name: "Monthly" }).click();
  await drawer.getByRole("radio", { name: "Ordinal weekday" }).check();
  await drawer.getByRole("textbox", { name: "Which" }).click();
  await page.getByRole("option", { name: "Last" }).click();
  await drawer.getByRole("textbox", { name: "Weekday" }).click();
  await page.getByRole("option", { name: "Friday" }).click();
  await drawer.getByRole("button", { name: "Add playlist" }).click();
  await expect(page.getByText(/Every month on the last Fri/)).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Brand loop scheduled settings" })
    .click();
  const appendEdit = page.getByRole("dialog", {
    name: "Edit Brand loop settings",
  });
  await expect(appendEdit).toBeVisible();
  await appendEdit
    .getByRole("textbox", { name: "Repeat every (months)" })
    .fill("2");
  const appendRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" && request.url().includes("/assignments/"),
  );
  await appendEdit.getByRole("button", { name: "Save settings" }).click();
  const appendBody = (await appendRequest).postDataJSON() as Record<
    string,
    unknown
  >;
  expect(appendBody).toMatchObject({ repeatInterval: 2 });
  expect(appendBody).not.toHaveProperty("startLocal");
  expect(appendBody).not.toHaveProperty("endLocal");
  expect(appendBody).not.toHaveProperty("recurrence");
  await expect(page.getByText(/Every 2 months on the last Fri/)).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Weekly campaign override settings" })
    .click();
  await chooseDateTime(page, edit, "End", "2026-01-30T10:00");
  await edit.getByRole("button", { name: "Save settings" }).click();
  await expect(edit.getByText("End must be after start.")).toBeVisible();
  await chooseDateTime(page, edit, "End", "2026-01-31T10:00");
  await edit.getByRole("textbox", { name: "Priority" }).fill("6");
  const priorityRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" && request.url().includes("/assignments/"),
  );
  await edit.getByRole("button", { name: "Save settings" }).click();
  const priorityBody = (await priorityRequest).postDataJSON() as Record<
    string,
    unknown
  >;
  expect(priorityBody).toEqual({
    expectedVersion: expect.any(String),
    priority: 6,
  });
  await expect(edit).toBeHidden();
  const refreshedSimulation = page.waitForResponse(
    (response) =>
      response.url().includes("/manifest") && response.status() === 200,
  );
  await page.getByRole("link", { name: "Overview" }).click();
  const manifest = (await refreshedSimulation).json() as Promise<{
    overrideWindows: { priority: number }[];
  }>;
  expect(
    (await manifest).overrideWindows.some((window) => window.priority === 6),
  ).toBe(true);
  await expect(page.getByText("Simulated preview")).toBeVisible();
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
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Bulk editor test");
  await page
    .getByRole("dialog", { name: "Create playlist" })
    .getByRole("button", { name: "Create playlist" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bulk editor test" }),
  ).toBeVisible();
  const bulkPanel = page.getByTestId("playlist-bulk-panel");
  await expect(bulkPanel).toBeVisible();
  await expect(
    bulkPanel.getByRole("button", { name: "Select all", exact: true }),
  ).toBeDisabled();
  await expect(
    bulkPanel.getByRole("button", { name: "Apply duration" }),
  ).toBeDisabled();
  await expect(
    bulkPanel.getByRole("button", { name: "Delete selected" }),
  ).toBeDisabled();
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
  const firstRowTop = (
    await page.getByRole("checkbox", { name: "Select item 1" }).boundingBox()
  )?.y;
  await bulkPanel
    .getByRole("button", { name: "Select all", exact: true })
    .click();
  await expect(
    bulkPanel.getByText("4 selected", { exact: false }),
  ).toBeVisible();
  for (const position of [1, 2, 3, 4])
    await expect(
      page.getByRole("checkbox", { name: `Select item ${position}` }),
    ).toBeChecked();
  expect(
    (await page.getByRole("checkbox", { name: "Select item 1" }).boundingBox())
      ?.y,
  ).toBe(firstRowTop);
  await bulkPanel.getByRole("button", { name: "Deselect all" }).click();
  await expect(
    bulkPanel.getByText("0 selected", { exact: false }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "Deselect all" }),
  ).toBeDisabled();
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
  await page
    .getByRole("button", { name: "Delete selected", exact: true })
    .click();
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
  const workspaceAsset = await connection.db.query.mediaAssets.findFirst();
  if (!workspaceAsset) throw new Error("Missing workspace media");
  const longName = `Long draft media ${"name ".repeat(28)}`;
  await connection.db.insert(mediaAssets).values({
    organizationId: workspaceAsset.organizationId,
    name: longName,
    kind: "image",
    status: "ready",
    mimeType: "image/png",
    objectKey: `${workspaceAsset.organizationId}/${crypto.randomUUID()}`,
    sizeBytes: 10,
  });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.reload();
  await page.getByRole("button", { name: "Add media" }).click();
  await page
    .getByRole("textbox", { name: "Search ready media" })
    .fill("Long draft media");
  await page.getByRole("button", { name: `Add ${longName}` }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ready media" })).toBeHidden();
  await expect(page.getByText(longName, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Display seconds" }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove item 5" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Move item 5 up" }).click();
  await expect(
    page
      .getByRole("button", { name: "Remove item 4" })
      .locator("..")
      .locator(".."),
  ).toContainText(longName);
  await page.getByRole("button", { name: "Remove item 4" }).click();
  await expect(page.getByRole("checkbox", { name: /Select item/ })).toHaveCount(
    4,
  );
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
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Preview test");
  await page
    .getByRole("dialog", { name: "Create playlist" })
    .getByRole("button", { name: "Create playlist" })
    .click();
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
  const progress = page.getByTestId("compact-preview-progress");
  await expect(progress).toHaveCSS("width", "16px");
  await expect(progress).not.toContainText("%");
  await expect(progress).toHaveAttribute("aria-valuenow", /\d+/);
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
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Repeat preview test");
  await page
    .getByRole("dialog", { name: "Create playlist" })
    .getByRole("button", { name: "Create playlist" })
    .click();
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
  await row().getByRole("button", { name: "brand.png" }).click();
  const rename = page.getByRole("dialog", { name: "Edit brand.png" });
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(
    rename.getByRole("textbox", { name: "Asset name" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await rename
    .getByRole("textbox", { name: "Asset name" })
    .fill("brand refreshed.png");
  await rename.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "brand refreshed.png" }),
  ).toBeVisible();
  const tagsDialog = rename;
  await tagsDialog.getByRole("textbox", { name: "Tags" }).fill("Weekly");
  await tagsDialog.getByRole("textbox", { name: "Tags" }).press("Enter");
  await tagsDialog.getByRole("button", { name: "Save tags" }).click();
  await expect(row()).toContainText("Weekly");
  await rename.press("Escape");
  await expect(rename).toBeHidden();
  await page.getByRole("textbox", { name: "Filter by tags" }).click();
  await page.getByRole("option", { name: "Weekly" }).click();
  await expect(row()).toBeVisible();
  await page.getByRole("textbox", { name: "Search media" }).fill("not-a-match");
  await expect(row()).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search media" }).fill("");
  await row().getByRole("button", { name: "Edit" }).click();
  const replace = page.getByRole("dialog", {
    name: "Edit brand refreshed.png",
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
  await row().getByRole("button", { name: "Delete", exact: true }).click();
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
  await unusedRow.getByRole("button", { name: "Delete", exact: true }).click();
  const unusedDialog = page.getByRole("dialog", {
    name: "Delete unused-for-delete.png",
  });
  await expect(unusedDialog).toContainText("not used by any saved playlist");
  await unusedDialog.getByRole("button", { name: "Delete asset" }).click();
  await expect(unusedRow).toHaveCount(0);
});

test("media selection adds tags and reviews combined deletion", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/media");
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "bulk-a.png", mimeType: "image/png", buffer },
      { name: "bulk-b.png", mimeType: "image/png", buffer },
      { name: "bulk-keep.png", mimeType: "image/png", buffer },
    ]);
  const a = page.getByRole("row").filter({ hasText: "bulk-a.png" });
  const b = page.getByRole("row").filter({ hasText: "bulk-b.png" });
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add tags", exact: true }),
  ).toBeDisabled();
  await a.getByRole("checkbox", { name: "Select bulk-a.png" }).check();
  await expect(page.getByText("1 selected")).toBeVisible();
  await page.getByRole("button", { name: "Deselect all" }).click();
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search media" }).fill("bulk-");
  await page.getByRole("button", { name: "Select all visible" }).click();
  await expect(page.getByText("3 selected")).toBeVisible();
  await page.getByRole("textbox", { name: "Search media" }).fill("bulk-a");
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search media" }).fill("bulk-");
  await a.getByRole("checkbox", { name: "Select bulk-a.png" }).check();
  await b.getByRole("checkbox", { name: "Select bulk-b.png" }).check();
  await page.getByRole("button", { name: "Add tags", exact: true }).click();
  const tagDialog = page.getByRole("dialog", { name: "Add tags to 2 assets" });
  await tagDialog
    .getByRole("textbox", { name: "Tags to add" })
    .fill("Bulk campaign");
  await tagDialog.getByRole("textbox", { name: "Tags to add" }).press("Enter");
  await tagDialog.getByRole("textbox", { name: "Tags to add" }).press("Tab");
  await tagDialog.getByRole("button", { name: "Add tags" }).click();
  await expect(tagDialog).toBeHidden();
  await expect(a).toContainText("Bulk campaign");
  await expect(b).toContainText("Bulk campaign");
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Filter by tags" }).click();
  await page.getByRole("option", { name: "Bulk campaign" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "bulk-keep.png" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Select all visible" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("textbox", { name: "Filter by tags" }).click();
  await page.getByRole("option", { name: "Bulk campaign" }).click();
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await a.getByRole("checkbox", { name: "Select bulk-a.png" }).check();
  await b.getByRole("checkbox", { name: "Select bulk-b.png" }).check();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  const bulkPlaylistId = await page.evaluate(async () => {
    const headers = {
      authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
      "content-type": "application/json",
    };
    const listed = await fetch("/api/admin/media", { headers });
    const assets = (await listed.json()) as {
      assets: Array<{ id: string; name: string }>;
    };
    const used = assets.assets.find((asset) => asset.name === "bulk-a.png");
    const keep = assets.assets.find((asset) => asset.name === "bulk-keep.png");
    if (!used || !keep) throw new Error("Missing bulk test media");
    const created = await fetch("/api/admin/playlists", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Bulk browser playlist" }),
    });
    const { playlist } = (await created.json()) as { playlist: { id: string } };
    const saved = await fetch(`/api/admin/playlists/${playlist.id}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [
          { mediaAssetId: used.id, imageDurationMs: 3000 },
          { mediaAssetId: keep.id, imageDurationMs: 4000 },
        ],
      }),
    });
    if (!saved.ok) throw new Error("Could not save bulk test playlist");
    return playlist.id;
  });
  await page.getByRole("button", { name: "Delete selected" }).click();
  const remove = page.getByRole("dialog", { name: "Delete 2 selected assets" });
  await expect(remove).toContainText("bulk-a.png");
  await expect(remove).toContainText("bulk-b.png");
  await expect(remove).toContainText("Bulk browser playlist: 1 item");
  await remove.press("Escape");
  await expect(remove).toBeHidden();
  await expect(a).toBeVisible();
  await page
    .getByRole("button", { name: "Delete selected", exact: true })
    .click();
  await page.evaluate(async (playlistId) => {
    const headers = {
      authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
      "content-type": "application/json",
    };
    const listed = await fetch("/api/admin/media", { headers });
    const assets = (await listed.json()) as {
      assets: Array<{ id: string; name: string }>;
    };
    const used = assets.assets.find((asset) => asset.name === "bulk-a.png");
    const keep = assets.assets.find((asset) => asset.name === "bulk-keep.png");
    if (!used || !keep) throw new Error("Missing bulk test media");
    const saved = await fetch(`/api/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [
          { mediaAssetId: used.id, imageDurationMs: 3000 },
          { mediaAssetId: keep.id, imageDurationMs: 4000 },
          { mediaAssetId: used.id, imageDurationMs: 5000 },
        ],
      }),
    });
    if (!saved.ok) throw new Error("Could not change bulk test playlist");
  }, bulkPlaylistId);
  await remove
    .getByRole("button", { name: "Delete selected assets and playlist uses" })
    .click();
  await expect(remove).toContainText("review deletion impact again");
  await expect(remove).toContainText("Bulk browser playlist: 2 items");
  await remove
    .getByRole("button", { name: "Delete selected assets and playlist uses" })
    .click();
  await expect(remove).toBeHidden();
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await expect(a).toHaveCount(0);
  await expect(b).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "bulk-keep.png" }),
  ).toBeVisible();
  const keptItems = await page.evaluate(async (playlistId) => {
    const response = await fetch(`/api/admin/playlists/${playlistId}`, {
      headers: {
        authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
      },
    });
    return response.json() as Promise<{
      items: Array<{ asset: { name: string } }>;
    }>;
  }, bulkPlaylistId);
  expect(keptItems.items.map((item) => item.asset.name)).toEqual([
    "bulk-keep.png",
  ]);
  const pendingStatus = await page.evaluate(async () => {
    const response = await fetch("/api/admin/media/uploads", {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionStorage.getItem("pixelpushr-admin-session")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "pending-only.png",
        mimeType: "image/png",
        sizeBytes: 100,
      }),
    });
    return response.status;
  });
  expect(pendingStatus).toBe(201);
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search media" })
    .fill("pending-only");
  const pending = page.getByRole("row").filter({ hasText: "pending-only.png" });
  await pending.getByRole("button", { name: "Edit" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Edit pending-only.png" })
      .getByRole("button", { name: "Replace file" }),
  ).toBeDisabled();
});

test("top-level pages keep filters, selection, and ordered editors in scope", async ({
  page,
}) => {
  test.setTimeout(120000);
  const existing = await connection.db.query.mediaAssets.findFirst();
  if (!existing) throw new Error("Missing browser workspace media");
  const organizationId = existing.organizationId;
  const mediaRows = await connection.db
    .insert(mediaAssets)
    .values(
      Array.from({ length: 30 }, (_, index) => ({
        organizationId,
        name: `Paging asset ${String(index + 1).padStart(2, "0")}`,
        kind: "image" as const,
        status: "ready" as const,
        mimeType: "image/png",
        objectKey: `${organizationId}/${crypto.randomUUID()}`,
        sizeBytes: 10,
      })),
    )
    .returning();
  const playlistRows = await connection.db
    .insert(playlists)
    .values(
      Array.from({ length: 30 }, (_, index) => ({
        organizationId,
        name: `Paging playlist ${String(index + 1).padStart(2, "0")}`,
      })),
    )
    .returning();
  const [orderedPlaylist] = await connection.db
    .insert(playlists)
    .values({
      organizationId,
      name: "Paging ordered playlist",
    })
    .returning();
  if (!orderedPlaylist) throw new Error("Missing ordered playlist");
  await connection.db.insert(playlistItems).values(
    mediaRows.map((asset, position) => ({
      playlistId: orderedPlaylist.id,
      mediaAssetId: asset.id,
      position,
      imageDurationMs: 3000,
    })),
  );
  const displayRows = await connection.db
    .insert(displays)
    .values(
      Array.from({ length: 30 }, (_, index) => ({
        organizationId,
        name: `Paging display ${String(index + 1).padStart(2, "0")}`,
        playerToken: crypto.randomUUID(),
        playerTokenHash: crypto.randomUUID(),
      })),
    )
    .returning();
  const assignedDisplay = displayRows[0];
  if (!assignedDisplay) throw new Error("Missing paging display");
  const savedAssignments = await fetch(
    `http://127.0.0.1:${apiPort}/admin/displays/${assignedDisplay.id}/always`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        playlistIds: playlistRows.map((item) => item.id),
      }),
    },
  );
  expect(savedAssignments.status).toBe(200);

  await page.addInitScript(
    (accessToken) =>
      sessionStorage.setItem("pixelpushr-admin-session", accessToken),
    token,
  );
  await page.goto("/media?page=2&search=Paging%20asset");
  await expect(page.getByText("Showing 26–30 of 30 results")).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Paging asset 30" }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page.getByRole("row").filter({ hasText: "Paging asset 30" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select all visible" }).click();
  await expect(page.getByText("5 selected")).toBeVisible();
  await page.getByRole("button", { name: "Add tags", exact: true }).click();
  const bulkTags = page.getByRole("dialog", { name: "Add tags to 5 assets" });
  await bulkTags
    .getByRole("textbox", { name: "Tags to add" })
    .fill("Second page");
  await bulkTags.getByRole("textbox", { name: "Tags to add" }).press("Enter");
  await bulkTags.getByRole("textbox", { name: "Tags to add" }).press("Tab");
  await bulkTags.getByRole("button", { name: "Add tags" }).click();
  await expect(bulkTags).toBeHidden();
  await page
    .getByRole("row")
    .filter({ hasText: "Paging asset 30" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete selected", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("row").filter({ hasText: "Paging asset 01" }),
  ).not.toContainText("Second page");
  await page.getByRole("button", { name: "Next" }).click();
  await page
    .getByRole("textbox", { name: "Search media" })
    .fill("Paging asset 30");
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByText("Showing 1–1 of 1 results")).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Paging asset 30" }),
  ).toBeVisible();

  await page.goto("/playlists?page=2");
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Paging playlist 30" }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page
    .getByRole("textbox", { name: "New playlist" })
    .fill("Paging new playlist");
  await page
    .getByRole("dialog", { name: "Create playlist" })
    .getByRole("button", { name: "Create playlist" })
    .click();
  await expect(page).toHaveURL(/\/playlists\/[a-f0-9-]+$/);
  await page.goto("/playlists?page=999");
  await expect(page).not.toHaveURL(/page=999/);
  await page.goto(`/playlists/${orderedPlaylist.id}`);
  await expect(page.getByRole("checkbox", { name: /Select item/ })).toHaveCount(
    30,
  );
  await page.getByRole("button", { name: "Add media" }).click();
  await page
    .getByRole("textbox", { name: "Search ready media" })
    .fill("Paging asset 30");
  await expect(
    page.getByRole("button", { name: "Add Paging asset 30" }),
  ).toBeVisible();

  await page.goto("/displays?page=2");
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Paging display 30" }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Register display" }).click();
  await page
    .getByRole("textbox", { name: "Display name" })
    .fill("Paging added display");
  await page
    .getByRole("dialog", { name: "Register display" })
    .getByRole("button", { name: "Register display" })
    .click();
  await expect(page.getByText(/Showing .* of .* results/)).toBeVisible();
  await page.goto("/displays?page=999");
  await expect(page).not.toHaveURL(/page=999/);
  await page.goto(`/displays/${assignedDisplay.id}`);
  await expect(
    page.getByRole("heading", { name: "Assigned playlists" }),
  ).toBeVisible();
  await expect(
    page.getByText("Paging playlist 30", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add playlist" }).click();
  await page
    .getByRole("textbox", { name: "Playlist", exact: true })
    .fill("Paging playlist 30");
  await expect(
    page.getByRole("option", { name: "Paging playlist 30" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByTestId(`display-card-${displayRows[29]?.id}`),
  ).toBeVisible();
});
