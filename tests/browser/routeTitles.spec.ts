import { expect, type Page, test } from "@playwright/test";

const expectTitle = async (page: Page, name: string) => {
  await expect(page).toHaveTitle(`${name} | pixelpushr`);
  await expect(page.locator("head title")).toHaveCount(1);
};

const mockAdmin = async (page: Page) => {
  await page.route("**/api/admin/**", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      json: {
        user: { email: "owner@example.com" },
        membership: { role: "owner" },
        organization: { name: "Fixture", timezone: "America/Chicago" },
      },
    }),
  );
};

test("auth, player, and not-found routes own a token-free title", async ({
  page,
}) => {
  for (const [path, name] of [
    ["/login", "Sign in"],
    ["/register", "Create account"],
    ["/confirm", "Confirm account"],
    ["/setup", "Set up workspace"],
    ["/invite/private-invite-token", "Accept invitation"],
    ["/player/private-display-token", "Player"],
  ]) {
    await page.goto(path);
    await expectTitle(page, name);
    expect(await page.title()).not.toContain("private-");
  }

  await mockAdmin(page);
  await page.goto("/missing-route");
  await expectTitle(page, "Page not found");
});

test("in-app admin navigation replaces the title without duplicates", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.goto("/");
  await expectTitle(page, "Overview");
  for (const [link, name] of [
    ["Media library", "Media library"],
    ["Playlists", "Playlists"],
    ["Displays", "Displays"],
    ["People & access", "People & access"],
    ["Settings", "Workspace settings"],
    ["Overview", "Overview"],
  ]) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expectTitle(page, name);
  }
});

test("admin gate loading and denial states each own a title", async ({
  page,
}) => {
  let releaseMe: (() => void) | undefined;
  const meGate = new Promise<void>((resolve) => {
    releaseMe = resolve;
  });
  await page.route("**/api/admin/me", async (route) => {
    await meGate;
    await route.fulfill({
      status: 403,
      json: {
        error: {
          code: "membership_required",
          message: "Administrator membership required",
        },
      },
    });
  });
  await page.route("**/api/setup/status", (route) =>
    route.fulfill({ json: { setupRequired: false } }),
  );
  await page.goto("/");
  await expectTitle(page, "Loading");
  releaseMe?.();
  await expectTitle(page, "Access denied");
});

test("detail titles use a fallback until data loads, then update", async ({
  page,
}) => {
  await mockAdmin(page);
  let releasePlaylist: (() => void) | undefined;
  const playlistGate = new Promise<void>((resolve) => {
    releasePlaylist = resolve;
  });
  await page.route("**/api/admin/playlists/title-fixture", async (route) => {
    await playlistGate;
    await route.fulfill({
      json: {
        playlist: { id: "title-fixture", name: "Weekend Rotation" },
        items: [],
      },
    });
  });
  await page.route("**/api/admin/media", (route) =>
    route.fulfill({ json: { assets: [] } }),
  );
  await page.goto("/playlists/title-fixture");
  await expectTitle(page, "Playlist editor");
  releasePlaylist?.();
  await expectTitle(page, "Weekend Rotation");

  let releaseDisplays: (() => void) | undefined;
  const displayGate = new Promise<void>((resolve) => {
    releaseDisplays = resolve;
  });
  await page.route("**/api/admin/displays", async (route) => {
    await displayGate;
    await route.fulfill({
      json: {
        displays: [
          {
            id: "title-fixture",
            name: "Main Lobby",
            playerUrl: "http://127.0.0.1:5173/player/private-display-token",
            lastSeenAt: null,
            lastHealth: null,
          },
        ],
      },
    });
  });
  await page.route("**/api/admin/displays/title-fixture/assignments", (route) =>
    route.fulfill({ json: { assignments: [] } }),
  );
  await page.getByRole("link", { name: "Back to Playlists" }).click();
  await expectTitle(page, "Playlists");
  await page.goto("/displays/title-fixture");
  await expectTitle(page, "Display");
  releaseDisplays?.();
  await expectTitle(page, "Main Lobby");
  expect(await page.title()).not.toContain("private-display-token");
});
