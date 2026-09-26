import { expect, test } from "bun:test";
import { createS3Storage } from "../../apps/api/src/media/storage";

const endpoint = process.env.TEST_S3_ENDPOINT;

test.skipIf(!endpoint)(
  "Floci S3 supports presigned upload and public media delivery",
  async () => {
    const storage = createS3Storage({
      region: "us-east-1",
      bucket: "pixelpushr-media",
      publicBaseUrl: `${endpoint}/pixelpushr-media`,
      endpoint,
      accessKeyId: "test",
      secretAccessKey: "test",
    });
    const key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    try {
      const uploadUrl = await storage.createUploadUrl(key, "image/png");
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: bytes,
      });
      expect(upload.status).toBe(200);
      expect(await storage.head(key)).toEqual({
        sizeBytes: bytes.byteLength,
        mimeType: "image/png",
      });
      expect(await storage.readPrefix(key, 8)).toEqual(bytes.slice(0, 8));
      const publicResponse = await fetch(storage.publicUrl(key));
      expect(publicResponse.status).toBe(200);
    } finally {
      await storage.remove(key);
    }
  },
);
