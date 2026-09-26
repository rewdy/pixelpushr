import { expect, test } from "@playwright/test";
import { createS3Storage } from "../../apps/api/src/media/storage";

test.skip(!process.env.TEST_S3_ENDPOINT, "Run with Floci to check browser CORS");

test("browser can upload media to Floci using a presigned URL", async ({ page }) => {
  const endpoint = process.env.TEST_S3_ENDPOINT!;
  const storage = createS3Storage({ region: "us-east-1", bucket: "pixelpushr-media", publicBaseUrl: `${endpoint}/pixelpushr-media`, endpoint, accessKeyId: "test", secretAccessKey: "test" });
  const key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
  const url = await storage.createUploadUrl(key, "image/png");
  try {
    await page.goto("/login");
    const result = await page.evaluate(async (uploadUrl) => {
      const response = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "image/png" }, body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) });
      return response.status;
    }, url);
    expect(result).toBe(200);
    expect((await storage.head(key))?.sizeBytes).toBe(8);
  } finally { await storage.remove(key); }
});
