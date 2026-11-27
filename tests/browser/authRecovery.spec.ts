import { expect, type Page, test } from "@playwright/test";

const admin = {
  user: { email: "admin@example.test" },
  membership: { role: "admin" },
  organization: { name: "Fixture", timezone: "UTC" },
};

const signIn = async (page: Page) => {
  await page.getByRole("textbox", { name: "Email" }).fill("admin@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("long-password");
  await page.getByRole("button", { name: "Sign in" }).click();
};

test("lost session redirects with a banner and returns to the protected page without replaying a change", async ({
  page,
}) => {
  let signedIn = true;
  let saves = 0;
  let loginAttempts = 0;
  await page.route("**/api/admin/me", (route) =>
    signedIn
      ? route.fulfill({ json: admin })
      : route.fulfill({
          status: 401,
          json: {
            error: {
              code: "session_required",
              message: "Sign in to continue.",
            },
          },
        }),
  );
  await page.route(/\/api\/admin\/playlists(?:\?|$)/, (route) => {
    if (route.request().method() === "POST") {
      saves++;
      signedIn = false;
      return route.fulfill({
        status: 401,
        json: {
          error: { code: "session_ended", message: "Your session ended." },
        },
      });
    }
    return route.fulfill({
      json: { playlists: [], page: 1, pageSize: 25, total: 0 },
    });
  });
  await page.route("**/api/auth/login", (route) => {
    if (++loginAttempts === 1)
      return route.fulfill({
        status: 401,
        json: {
          error: { code: "unauthorized", message: "Invalid email or password" },
        },
      });
    signedIn = true;
    return route.fulfill({ json: { signedIn: true } });
  });
  await page.goto("/playlists");
  await page.getByRole("button", { name: "Create playlist" }).click();
  await page.getByRole("textbox", { name: "New playlist" }).fill("Draft");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create playlist" })
    .click();
  await expect(
    page.getByText("Your session ended. Sign in again to continue."),
  ).toBeVisible();
  await signIn(page);
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await signIn(page);
  await expect(page).toHaveURL(/\/playlists$/);
  await expect(page.getByRole("heading", { name: "Playlists" })).toBeVisible();
  expect(saves).toBe(1);
});

test("an outage offers retry and membership denial offers account switching", async ({
  page,
}) => {
  let current = 503;
  let setupChecks = 0;
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      status: current,
      json: {
        error:
          current === 503
            ? {
                code: "auth_unavailable",
                message:
                  "Sign-in service is temporarily unavailable. Try again.",
              }
            : {
                code: "membership_required",
                message: "Accept an invitation to continue.",
              },
      },
    }),
  );
  await page.route("**/api/setup/status", (route) => {
    setupChecks++;
    return route.fulfill({ json: { setupRequired: false } });
  });
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ json: { signedOut: true } }),
  );
  await page.goto("/media");
  await expect(page.getByText(/temporarily unavailable/)).toBeVisible();
  expect(setupChecks).toBe(0);
  current = 403;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText("Accept an invitation to continue."),
  ).toBeVisible();
  expect(setupChecks).toBe(1);
  await page.getByRole("button", { name: "Switch accounts" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/Your session ended/)).toHaveCount(0);
});

test("a stale legacy browser token is cleared and an external continuation is rejected", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (location.pathname === "/media")
      sessionStorage.setItem("pixelpushr-admin-session", "legacy");
  });
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: { code: "session_required", message: "Sign in to continue." },
      },
    }),
  );
  await page.goto("/media");
  await expect(page.getByText(/Your session ended/)).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("pixelpushr-admin-session"),
    ),
  ).toBeNull();
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ json: admin }),
  );
  await page.route("**/api/admin/displays", (route) =>
    route.fulfill({ json: { displays: [] } }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { signedIn: true } }),
  );
  await page.goto("/login?next=%2F%2Fevil.example");
  await signIn(page);
  await expect(page).toHaveURL("http://127.0.0.1:5173/");
});

test("an invitation for another account stays in context and can be resumed after switching accounts", async ({
  page,
}) => {
  const token = "fixture-invite-token-for-admin";
  const invitation = `/invite/${token}`;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { signedIn: true } }),
  );
  await page.route("**/api/invitations/accept", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: "forbidden",
          message: "Sign in with the invited email address",
        },
      },
    }),
  );
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ json: { signedOut: true } }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { signedIn: true } }),
  );

  await page.goto(invitation);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    page.getByText("Sign in with the invited email address"),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${invitation}$`));
  await page.getByRole("button", { name: "Switch accounts" }).click();
  await expect(page).toHaveURL(/\/login\?next=invite$/);
  expect(page.url()).not.toContain(token);
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`${invitation}$`));
});
