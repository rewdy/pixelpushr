import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../../apps/api/src/db/client";
import { mediaAssets } from "../../apps/api/src/db/schema";
import { createS3Storage } from "../../apps/api/src/media/storage";

test.skip(!process.env.TEST_DATABASE_ADMIN_URL || !process.env.TEST_S3_ENDPOINT, "Run with local PostgreSQL and Floci");
test.describe.configure({ mode: "serial" });

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL!;
const s3Endpoint = process.env.TEST_S3_ENDPOINT!;
const databaseName = `pixelpushr_browser_${crypto.randomUUID().replaceAll("-", "")}`;
const apiPort = 43722;
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
  await migrate(connection.db, { migrationsFolder: new URL("../../apps/api/drizzle", import.meta.url).pathname });
  api = spawn("bun", ["apps/api/src/local.ts"], { cwd: new URL("../../", import.meta.url).pathname, env: { ...process.env, PORT: String(apiPort), DATABASE_URL: url.toString(), AUTH_MODE: "local", APP_ENV: "local", LOCAL_AUTH_SECRET: secret, PUBLIC_WEB_URL: "http://127.0.0.1:5173", SMTP_URL: "smtp://127.0.0.1:1025", MAIL_FROM: "invites@example.com", MEDIA_STORAGE: "s3", MEDIA_BUCKET: "pixelpushr-media", MEDIA_PUBLIC_URL: `${s3Endpoint}/pixelpushr-media`, S3_ENDPOINT: s3Endpoint, S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test", AWS_REGION: "us-east-1" }, stdio: "ignore" });
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${apiPort}/health`); if (response.ok) { ready = true; break; } }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  if (!ready) throw new Error("Browser-test API did not start");
});

test("owner sets up the workspace and invites an administrator in the browser", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create the first account or accept an invitation" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("browser-owner@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("owner-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill("browser-owner@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("owner-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
  await page.getByRole("textbox", { name: "Organization name" }).fill("Browser Test");
  await page.getByRole("textbox", { name: "Timezone" }).fill("America/Chicago");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  token = await page.evaluate(() => sessionStorage.getItem("pixelpushr-admin-session") ?? "");
  expect(token).toBeTruthy();
  await page.goto("/people");
  await page.getByRole("textbox", { name: "Email address" }).fill("browser-admin@example.com");
  const inviteResponse = page.waitForResponse((response) => response.url().includes("/api/admin/invitations") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send invitation" }).click();
  const invitation = await inviteResponse;
  expect(invitation.status()).toBe(201);
  const inviteUrl = (await invitation.json() as { url: string }).url;
  const invitedContext = await browser.newContext();
  const invited = await invitedContext.newPage();
  await invited.goto(inviteUrl);
  await invited.getByRole("link", { name: "Create an account" }).click();
  await invited.getByRole("textbox", { name: "Email" }).fill("browser-admin@example.com");
  await invited.getByRole("textbox", { name: "Password" }).fill("admin-password-123");
  await invited.getByRole("button", { name: "Create account" }).click();
  await expect(invited.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await invited.getByRole("textbox", { name: "Email" }).fill("browser-admin@example.com");
  await invited.getByRole("textbox", { name: "Password" }).fill("admin-password-123");
  await invited.getByRole("button", { name: "Sign in" }).click();
  await expect(invited.getByRole("heading", { name: "Accept invitation" })).toBeVisible();
  await invited.getByRole("button", { name: "Accept invitation" }).click();
  await expect(invited.getByRole("heading", { name: "Overview" })).toBeVisible();
  await invitedContext.close();
  await page.reload();
  await expect(page.getByText("browser-admin@example.com").first()).toBeVisible();
});

test.afterAll(async () => {
  if (api) api.kill("SIGTERM");
  if (connection) {
    const storage = createS3Storage({ region: "us-east-1", bucket: "pixelpushr-media", publicBaseUrl: `${s3Endpoint}/pixelpushr-media`, endpoint: s3Endpoint, accessKeyId: "test", secretAccessKey: "test" });
    for (const asset of await connection.db.select({ objectKey: mediaAssets.objectKey }).from(mediaAssets)) await storage.remove(asset.objectKey);
  }
  if (connection) await connection.close();
  if (admin) { await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`; await admin.end(); }
});

test("upload media and publish an ordered playlist through the real API", async ({ page }) => {
  await page.addInitScript((accessToken) => sessionStorage.setItem("pixelpushr-admin-session", accessToken), token);
  await page.goto("/media");
  await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "brand.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Media is ready for playlists.")).toBeVisible();
  await page.goto("/playlists");
  await page.getByRole("textbox", { name: "New playlist" }).fill("Brand loop");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await expect(page.getByRole("heading", { name: "Brand loop" })).toBeVisible();
  await page.getByRole("textbox", { name: "Ready asset" }).click();
  await page.getByRole("option", { name: "brand.png (image)" }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("button", { name: "Save playlist" }).click();
  await expect(page.getByText("Playlist saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("brand.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Display seconds" })).toHaveValue("8");
  await page.goto("/displays");
  await page.getByRole("textbox", { name: "Display name" }).fill("Lobby TV");
  await page.getByRole("button", { name: "Register display" }).click();
  await expect(page.getByText("Lobby TV")).toBeVisible();
  await page.getByRole("link", { name: "Assign playlists" }).click();
  await page.getByRole("button", { name: "Add Brand loop" }).click();
  await page.getByRole("button", { name: "Save assignments" }).click();
  await expect(page.getByText("Assignments saved. The player will pick them up shortly.")).toBeVisible();
  const playerUrl = await page.getByRole("link", { name: "Open player" }).getAttribute("href");
  expect(playerUrl).toBeTruthy();
  const player = await page.context().newPage();
  await player.goto(playerUrl!);
  await expect(player.locator("img")).toBeVisible();
  expect(await player.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await player.close();
  await page.goto("/playlists");
  await page.getByRole("textbox", { name: "New playlist" }).fill("Weekly campaign");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("textbox", { name: "Ready asset" }).click();
  await page.getByRole("option", { name: "brand.png (image)" }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("button", { name: "Save playlist" }).click();
  await page.goto("/displays");
  await page.getByRole("link", { name: "Assign playlists" }).click();
  await page.getByRole("textbox", { name: "Playlist", exact: true }).click();
  await page.getByRole("option", { name: "Weekly campaign" }).click();
  await page.getByRole("textbox", { name: "Start", exact: true }).fill("2026-09-07T00:00");
  await page.getByRole("textbox", { name: "End", exact: true }).fill("2026-09-14T00:00");
  await page.getByRole("textbox", { name: "Repeat", exact: true }).click();
  await page.getByRole("option", { name: "Every N weeks" }).click();
  await page.getByRole("textbox", { name: "Repeat every (weeks)" }).fill("3");
  await page.getByRole("button", { name: "Add schedule" }).click();
  await expect(page.getByText("Schedule saved.")).toBeVisible();
  await page.getByRole("textbox", { name: "Preview at" }).fill("2026-09-08T12:00");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText("Brand loop → Weekly campaign")).toBeVisible();
  await page.getByRole("textbox", { name: "Override playlist" }).click();
  await page.getByRole("option", { name: "Weekly campaign" }).click();
  await page.getByRole("checkbox", { name: "Activate now" }).check();
  await page.getByRole("textbox", { name: "Override expiration" }).fill("2099-01-01T00:00");
  await page.getByRole("button", { name: "Save override" }).click();
  await expect(page.getByText("Override saved. Players will pick it up on their next refresh.")).toBeVisible();
});
