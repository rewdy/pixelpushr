import type { PlayerManifest } from "@pixelpushr/contracts/manifest";
import { expect, test } from "@playwright/test";

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==";
const item = (id: string): PlayerManifest["activeQueue"][number] => ({
  id,
  playlistId: id,
  assetId: id,
  kind: "image",
  url: image,
  imageDurationMs: 8000,
  videoMode: null,
  repeatDurationMs: null,
});

test("Overview distinguishes simulations from device health and follows override boundaries", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("pixelpushr-admin-session", "test-token"),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      json: {
        user: { email: "owner@example.com" },
        membership: { role: "owner" },
        organization: { name: "Workspace", timezone: "America/Chicago" },
      },
    }),
  );
  const displays = [
    {
      id: "populated",
      name: "Lobby",
      playerUrl: "http://127.0.0.1:5173/player/lobby-token",
      lastSeenAt: null,
      lastHealth: null,
    },
    {
      id: "empty",
      name: "Hall",
      playerUrl: "http://127.0.0.1:5173/player/hall-token",
      lastSeenAt: null,
      lastHealth: "empty",
    },
    {
      id: "failed",
      name: "Side room",
      playerUrl: "http://127.0.0.1:5173/player/failed-token",
      lastSeenAt: null,
      lastHealth: "playing",
    },
  ];
  await page.route("**/api/admin/displays", (route) =>
    route.fulfill({ json: { displays } }),
  );
  const start = Date.now() + 1800;
  const end = start + 1800;
  let heartbeatRequests = 0;
  await page.route("**/api/player/**/heartbeat", (route) => {
    heartbeatRequests += 1;
    return route.fulfill({ json: { received: true } });
  });
  await page.route("**/api/player/**/manifest", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("failed-token"))
      return route.fulfill({
        status: 503,
        json: { error: { message: "Service unavailable" } },
      });
    const now = Date.now();
    const active = path.includes("lobby-token") && now >= start && now < end;
    const normalQueue = path.includes("hall-token") ? [] : [item("normal")];
    const overrideQueue = [item("override")];
    const window = {
      assignmentId: "override",
      priority: 1,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      queue: overrideQueue,
    };
    const manifest: PlayerManifest = {
      display: {
        id: path.includes("hall-token") ? "empty" : "populated",
        name: "Fixture",
      },
      version: active ? "override" : "normal",
      serverTime: new Date(now).toISOString(),
      normalQueue,
      activeQueue: active ? overrideQueue : normalQueue,
      override: active ? window : null,
      overrideWindows:
        path.includes("hall-token") || now >= end ? [] : [window],
      transitions: path.includes("hall-token")
        ? []
        : [
            ...(now < start
              ? [{ at: new Date(start).toISOString(), overrideId: "override" }]
              : []),
            ...(now < end
              ? [{ at: new Date(end).toISOString(), overrideId: null }]
              : []),
          ],
    };
    return route.fulfill({ json: manifest });
  });
  await page.goto("/");
  const lobby = page.getByTestId("display-card-populated");
  await expect(lobby.getByText("Simulated preview")).toBeVisible();
  await expect(lobby.getByTestId("compact-preview")).toBeVisible();
  await expect(lobby.getByTestId("compact-preview-progress")).toHaveCSS(
    "width",
    "16px",
  );
  await expect(lobby.getByTestId("compact-preview-progress")).not.toContainText(
    "%",
  );
  await expect(lobby).toHaveAttribute("data-simulation-mode", "normal");
  await expect(
    page
      .getByTestId("display-card-empty")
      .getByText("No playable items right now."),
  ).toBeVisible();
  await expect(
    page.getByTestId("display-card-failed").getByText(/Preview unavailable/),
  ).toBeVisible();
  await expect(lobby.getByText("Device last seen: Never")).toBeVisible();
  await expect(lobby).toHaveAttribute("data-simulation-mode", "override", {
    timeout: 5000,
  });
  await expect(lobby).toHaveAttribute("data-simulation-mode", "normal", {
    timeout: 5000,
  });
  expect(heartbeatRequests).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(lobby).toBeVisible();
  await lobby.getByRole("link", { name: "Manage display" }).click();
  await expect(page).toHaveURL(/\/displays\/populated$/);
  await expect(page.getByRole("link", { name: "Schedules" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Overrides" })).toHaveCount(0);
});
