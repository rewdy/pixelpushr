import { expect, type Page, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5QAAAABJRU5ErkJggg==",
  "base64",
);

const mockMediaApi = async (
  page: Page,
  onUpload: (name: string) => Promise<number | undefined> = async () =>
    undefined,
) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("pixelpushr-admin-session", "test-token"),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      json: {
        user: { email: "owner@example.com" },
        membership: { role: "owner" },
        organization: { name: "Fixture", timezone: "UTC" },
      },
    }),
  );
  const assets = new Map<string, Record<string, unknown>>();
  await page.route("**/api/admin/media", (route) =>
    route.fulfill({ json: { assets: [...assets.values()] } }),
  );
  await page.route("**/api/admin/media/uploads", (route) => {
    const body = route.request().postDataJSON() as {
      name: string;
      mimeType: string;
      sizeBytes: number;
    };
    const id = crypto.randomUUID();
    const asset = {
      id,
      name: body.name,
      kind: "image",
      status: "pending",
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      width: 1,
      height: 1,
      durationMs: null,
      failureReason: null,
      url: `/fake-media/${id}`,
      previewUrl: null,
    };
    assets.set(id, asset);
    return route.fulfill({
      status: 201,
      json: {
        asset,
        uploadUrl: `http://127.0.0.1:5173/fake-upload/${id}`,
      },
    });
  });
  await page.route("**/fake-upload/*", async (route) => {
    const id = route.request().url().split("/").at(-1) ?? "";
    const status = await onUpload(String(assets.get(id)?.name ?? ""));
    await route.fulfill({ status: status ?? 200 });
  });
  await page.route("**/api/admin/media/*/complete", (route) => {
    const id = route.request().url().split("/").at(-2) ?? "";
    const asset = { ...assets.get(id), status: "ready" };
    assets.set(id, asset);
    return route.fulfill({ json: { asset } });
  });
};

test("uploads at most two files together and gives each one a ready state", async ({
  page,
}) => {
  let active = 0;
  let maxActive = 0;
  let releaseUploads: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseUploads = resolve;
  });
  await mockMediaApi(page, async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await gate;
    active--;
    return undefined;
  });
  await page.goto("/media");
  await page.locator('input[type="file"]').setInputFiles(
    ["one.png", "two.png", "three.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect.poll(() => active).toBe(2);
  expect(maxActive).toBe(2);
  await expect(
    page.getByTestId("upload-entry").filter({ hasText: "three.png" }),
  ).toContainText("queued");
  releaseUploads();
  await expect(page.getByTestId("upload-entry")).toHaveCount(3);
  await expect
    .poll(async () =>
      page.getByTestId("upload-entry").filter({ hasText: "ready" }).count(),
    )
    .toBe(3);
  expect(maxActive).toBe(2);
});

test("one failed upload keeps its error while another file becomes ready", async ({
  page,
}) => {
  await mockMediaApi(page, async (name) => (name === "broken.png" ? 500 : 200));
  await page.goto("/media");
  await page.locator('input[type="file"]').setInputFiles(
    ["broken.png", "working.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect(
    page.getByTestId("upload-entry").filter({ hasText: "broken.png" }),
  ).toContainText("Upload failed (500)");
  await expect(
    page.getByTestId("upload-entry").filter({ hasText: "working.png" }),
  ).toContainText("ready");
});

test("page-wide file drop queues media without navigating, while text drags are ignored", async ({
  page,
}) => {
  await mockMediaApi(page);
  await page.goto("/media");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "not a file");
    document.body.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
    document.body.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await expect(page.getByTestId("media-drop-overlay")).toHaveCount(0);
  await expect(page.getByTestId("upload-entry")).toHaveCount(0);

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["a"], "dropped-a.png", { type: "image/png" }));
    data.items.add(new File(["b"], "dropped-b.png", { type: "image/png" }));
    document.body.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await expect(page.getByTestId("media-drop-overlay")).toBeVisible();
  const dropPrevented = await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["a"], "dropped-a.png", { type: "image/png" }));
    data.items.add(new File(["b"], "dropped-b.png", { type: "image/png" }));
    return !document.body.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  expect(dropPrevented).toBe(true);
  await expect(page.getByTestId("media-drop-overlay")).toHaveCount(0);
  await expect(page.getByTestId("upload-entry")).toHaveCount(2);
  await expect
    .poll(async () =>
      page.getByTestId("upload-entry").filter({ hasText: "ready" }).count(),
    )
    .toBe(2);
  await expect(page).toHaveURL(/\/media$/);
});
