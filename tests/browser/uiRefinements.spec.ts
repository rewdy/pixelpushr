import { expect, type Page, test } from "@playwright/test";
import { videoBase64 } from "../fixtures/videoBase64";

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==";
const longName = `${"very-long-unbroken-media-name-".repeat(12)}.png`;

const mockAdmin = async (page: Page) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("pixelpushr-admin-session", "test-token"),
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

for (const width of [1280, 390]) {
  test(`ready-media picker contains a long name at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockAdmin(page);
    await page.route("**/api/admin/media", (route) =>
      route.fulfill({
        json: {
          assets: [
            {
              id: "asset-1",
              name: longName,
              kind: "image",
              status: "ready",
              mimeType: "image/png",
              sizeBytes: 100,
              width: 1,
              height: 1,
              durationMs: null,
              failureReason: null,
              url: image,
              previewUrl: image,
              contentVersion: "v1",
              tags: [],
            },
          ],
        },
      }),
    );
    await page.route("**/api/admin/playlists/fixture", (route) =>
      route.fulfill({
        json: {
          playlist: { id: "fixture", name: "Fixture playlist" },
          items: [],
        },
      }),
    );
    await page.goto("/playlists/fixture");
    await page.getByRole("button", { name: "Add media" }).click();
    const picker = page.getByTestId("media-picker");
    const row = picker.getByTestId("media-picker-row");
    await expect(row).toBeVisible();
    const name = row.locator(`[title="${longName}"]`);
    await expect(name).toHaveText(longName);
    await expect(row.locator("img")).toBeVisible();
    await expect(
      row.getByRole("button", { name: `Add ${longName}` }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(false);
    const overflow = await picker.evaluate((node) => {
      const viewport = node.querySelector(".mantine-ScrollArea-viewport");
      const row = node.querySelector('[data-testid="media-picker-row"]');
      if (!viewport || !row) throw new Error("Picker elements missing");
      const viewportBounds = viewport.getBoundingClientRect();
      const rowBounds = row.getBoundingClientRect();
      return {
        picker: viewport.scrollWidth > viewport.clientWidth + 1,
        row: rowBounds.right > viewportBounds.right + 1,
        page:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
        widths: {
          viewport: viewport.clientWidth,
          scroll: viewport.scrollWidth,
          row: rowBounds.width,
          page: document.documentElement.scrollWidth,
          pageClient: document.documentElement.clientWidth,
        },
      };
    });
    expect(overflow.picker, JSON.stringify(overflow.widths)).toBe(false);
    expect(overflow.row, JSON.stringify(overflow.widths)).toBe(false);
    expect(overflow.page, JSON.stringify(overflow.widths)).toBe(false);
    await row.getByRole("button", { name: `Add ${longName}` }).click();
    await expect(
      page.getByRole("checkbox", { name: "Select item 1" }),
    ).toBeVisible();
  });
}

test("unknown play-once duration uses a nonnumeric dial and still advances", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      configurable: true,
      get: () => Number.NaN,
    });
  });
  const assets = [
    {
      id: "video",
      name: "clip.mp4",
      kind: "video",
      status: "ready",
      mimeType: "video/mp4",
      sizeBytes: 100,
      width: 1,
      height: 1,
      durationMs: null,
      failureReason: null,
      url: `data:video/mp4;base64,${videoBase64}`,
      previewUrl: null,
      contentVersion: "v1",
      tags: [],
    },
    {
      id: "image",
      name: "still.png",
      kind: "image",
      status: "ready",
      mimeType: "image/png",
      sizeBytes: 100,
      width: 1,
      height: 1,
      durationMs: null,
      failureReason: null,
      url: image,
      previewUrl: image,
      contentVersion: "v1",
      tags: [],
    },
  ];
  await page.route("**/api/admin/media", (route) =>
    route.fulfill({ json: { assets } }),
  );
  await page.route("**/api/admin/playlists/fixture", (route) =>
    route.fulfill({
      json: {
        playlist: { id: "fixture", name: "Fixture playlist" },
        items: assets.map((asset, position) => ({
          id: `item-${position}`,
          position,
          mediaAssetId: asset.id,
          imageDurationMs: asset.kind === "image" ? 8000 : null,
          videoMode: asset.kind === "video" ? "once" : null,
          repeatDurationMs: null,
          asset,
        })),
      },
    }),
  );
  await page.goto("/playlists/fixture");
  await page.getByRole("button", { name: "Show preview" }).click();
  const preview = page.getByTestId("compact-preview");
  await expect(preview.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "VIDEO",
  );
  const progress = page.getByTestId("compact-preview-progress");
  await preview.getByTestId("preview-media").dispatchEvent("timeupdate");
  await expect(progress).toHaveAttribute(
    "aria-label",
    "Playback progress unavailable",
  );
  await expect(progress).not.toHaveAttribute("aria-valuenow", /\d+/);
  await expect(progress).not.toContainText("%");
  await preview.getByTestId("preview-media").dispatchEvent("ended");
  await expect(preview.getByTestId("preview-media")).toHaveJSProperty(
    "tagName",
    "IMG",
  );
});

test("detail return links work from direct entry with the keyboard", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.route("**/api/admin/media", (route) =>
    route.fulfill({ json: { assets: [] } }),
  );
  await page.route("**/api/admin/playlists/fixture", (route) =>
    route.fulfill({
      json: {
        playlist: { id: "fixture", name: "Fixture playlist" },
        items: [],
      },
    }),
  );
  await page.route("**/api/admin/playlists", (route) =>
    route.fulfill({ json: { playlists: [] } }),
  );
  await page.route("**/api/admin/displays/fixture/assignments", (route) =>
    route.fulfill({ json: { assignments: [] } }),
  );
  await page.route("**/api/admin/displays", (route) =>
    route.fulfill({
      json: {
        displays: [
          {
            id: "fixture",
            name: "Lobby",
            playerUrl: "http://127.0.0.1:5173/player/fixture-token",
            lastSeenAt: null,
            lastHealth: null,
          },
        ],
      },
    }),
  );
  await page.goto("/playlists/fixture");
  const playlistsReturn = page.getByRole("link", { name: "Back to Playlists" });
  await expect(playlistsReturn).toBeVisible();
  await playlistsReturn.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/playlists$/);

  await page.goto("/displays/fixture");
  const displaysReturn = page.getByRole("link", { name: "Back to Displays" });
  await expect(displaysReturn).toBeVisible();
  await displaysReturn.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/displays$/);
});
