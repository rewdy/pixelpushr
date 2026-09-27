import { expect, type Page, test } from "@playwright/test";

const openSettings = async (
  page: Page,
  role: "owner" | "admin",
  initialTimezone = "US/Eastern",
) => {
  let timezone = initialTimezone;
  const saved: string[] = [];
  await page.addInitScript(() =>
    sessionStorage.setItem("pixelpushr-admin-session", "test-token"),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      json: {
        user: { email: `${role}@example.com` },
        membership: { role },
        organization: { name: "Fixture", timezone },
      },
    }),
  );
  await page.route("**/api/admin/organization", (route) => {
    const body = route.request().postDataJSON() as {
      name: string;
      timezone: string;
    };
    timezone = body.timezone;
    saved.push(timezone);
    return route.fulfill({
      json: { organization: { name: body.name, timezone } },
    });
  });
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Workspace settings" }),
  ).toBeVisible();
  return { saved, getTimezone: () => timezone };
};

test("owner searches by offset and city, then saves the IANA zone only on Save", async ({
  page,
}) => {
  const state = await openSettings(page, "owner");
  const timezoneInput = page.getByRole("textbox", { name: "Timezone" });
  await expect(timezoneInput).toHaveValue(/US\/Eastern · UTC[-+]\d{2}:\d{2}/);
  await expect(
    page.getByText(/Current UTC offset; daylight saving time/),
  ).toBeVisible();
  await timezoneInput.fill("Not/AZone");
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await timezoneInput.fill("UTC+05:45");
  await expect(
    page.getByRole("option", { name: /Asia\/Katmandu/ }),
  ).toBeVisible();
  await timezoneInput.fill("Katmandu");
  await timezoneInput.press("ArrowDown");
  await timezoneInput.press("Enter");
  await expect(timezoneInput).toHaveValue("Asia/Katmandu · UTC+05:45");
  expect(state.saved).toEqual([]);
  expect(state.getTimezone()).toBe("US/Eastern");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  expect(state.saved).toEqual(["Asia/Katmandu"]);
  expect(state.getTimezone()).toBe("Asia/Katmandu");
});

test("administrator can read an existing alias and its offset but not edit it", async ({
  page,
}) => {
  const state = await openSettings(page, "admin");
  await expect(page.getByRole("textbox", { name: "Timezone" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Timezone" })).toHaveValue(
    /US\/Eastern · UTC[-+]\d{2}:\d{2}/,
  );
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    0,
  );
  expect(state.saved).toEqual([]);
});
