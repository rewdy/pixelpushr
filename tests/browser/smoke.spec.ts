import { expect, test } from "@playwright/test";

test("unauthenticated console redirects to owned sign-in", async ({ page }) => {
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: { code: "session_required", message: "Sign in to continue." },
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("public player route loads", async ({ page }) => {
  const imageUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==";
  await page.route("**/api/player/fixture-token/manifest", (route) =>
    route.fulfill({
      json: {
        display: { id: "fixture", name: "Fixture" },
        version: "fixture-v1",
        serverTime: new Date().toISOString(),
        normalQueue: [
          {
            id: "item",
            playlistId: "playlist",
            assetId: "asset",
            kind: "image",
            url: imageUrl,
            imageDurationMs: 5000,
            videoMode: null,
            repeatDurationMs: null,
          },
        ],
        activeQueue: [
          {
            id: "item",
            playlistId: "playlist",
            assetId: "asset",
            kind: "image",
            url: imageUrl,
            imageDurationMs: 5000,
            videoMode: null,
            repeatDurationMs: null,
          },
        ],
        override: null,
        transitions: [],
      },
    }),
  );
  await page.route("**/api/player/fixture-token/heartbeat", (route) =>
    route.fulfill({ json: { received: true } }),
  );
  await page.goto("/player/fixture-token");
  await expect(page.locator('img[data-player-layer="current"]')).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("owner can create a shareable invitation through the console", async ({
  page,
}) => {
  await page.route("**/api/admin/**", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      json: {
        user: { email: "owner@example.com" },
        membership: { role: "owner" },
        organization: { name: "First Community", timezone: "America/Chicago" },
      },
    }),
  );
  await page.route("**/api/admin/members", (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: "owner",
            email: "owner@example.com",
            role: "owner",
            joinedAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  let invitedEmail = "";
  await page.route("**/api/admin/invitations", (route) => {
    if (route.request().method() === "POST") {
      invitedEmail = (route.request().postDataJSON() as { email: string })
        .email;
      return route.fulfill({
        status: 201,
        json: {
          invitation: {
            id: "invite",
            email: invitedEmail,
            status: "pending",
            expiresAt: new Date().toISOString(),
          },
          url: "http://localhost/invite/test-token",
        },
      });
    }
    return route.fulfill({ json: { invitations: [] } });
  });
  await page.goto("/people");
  await expect(
    page.getByRole("heading", { name: "People & access" }),
  ).toBeVisible();
  await expect(page.getByText("No invitations pending.")).toBeVisible();
  await page.getByRole("button", { name: "Create invitation" }).click();
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("new-admin@example.com");
  await page
    .getByRole("dialog", { name: "Create invitation" })
    .getByRole("button", { name: "Create invitation" })
    .click();
  await expect(
    page.getByText("Invitation created for new-admin@example.com."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  expect(invitedEmail).toBe("new-admin@example.com");
});

test("admin can upload media and save a playable playlist", async ({
  page,
}) => {
  await page.route("**/api/admin/**", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      json: {
        user: { email: "owner@example.com" },
        membership: { role: "owner" },
        organization: { name: "First Community", timezone: "America/Chicago" },
      },
    }),
  );
  const readyAsset = {
    id: "asset-one",
    name: "logo.png",
    kind: "image",
    status: "ready",
    mimeType: "image/png",
    sizeBytes: 12,
    width: 1,
    height: 1,
    durationMs: null,
    failureReason: null,
    url: "/logo.png",
    previewUrl: null,
    contentVersion: "asset-one",
    tags: [],
  };
  let assets: (typeof readyAsset)[] = [];
  let savedItems: { mediaAssetId: string; imageDurationMs: number }[] = [];
  await page.route("**/api/admin/media", (route) =>
    route.fulfill({ json: { assets } }),
  );
  await page.route("**/api/admin/media/uploads", (route) =>
    route.fulfill({
      status: 201,
      json: {
        asset: { ...readyAsset, status: "pending" },
        uploadUrl: "http://127.0.0.1:5173/fake-upload",
      },
    }),
  );
  await page.route("**/fake-upload", (route) => route.fulfill({ status: 200 }));
  await page.route("**/api/admin/media/asset-one/complete", (route) => {
    assets = [readyAsset];
    return route.fulfill({ json: { asset: readyAsset } });
  });
  await page.route("**/api/admin/playlists", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 201,
          json: {
            playlist: {
              id: "playlist-one",
              name: "Brand loop",
              updatedAt: new Date().toISOString(),
            },
          },
        })
      : route.fulfill({ json: { playlists: [] } }),
  );
  await page.route("**/api/admin/playlists/playlist-one", (route) =>
    route.fulfill({
      json: { playlist: { id: "playlist-one", name: "Brand loop" }, items: [] },
    }),
  );
  await page.route("**/api/admin/playlists/playlist-one/items", (route) => {
    savedItems = (
      route.request().postDataJSON() as { items: typeof savedItems }
    ).items;
    return route.fulfill({
      json: { updated: true, itemCount: savedItems.length },
    });
  });
  await page.goto("/media");
  await expect(
    page.getByRole("heading", { name: "Media library" }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]),
  });
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
  await page.getByRole("button", { name: "Add logo.png" }).click();
  await page.getByRole("button", { name: "Save playlist" }).click();
  await expect(page.getByText("Playlist saved.")).toBeVisible();
  expect(savedItems).toEqual([
    { mediaAssetId: "asset-one", imageDurationMs: 8000 },
  ]);
});
