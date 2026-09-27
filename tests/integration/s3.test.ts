import { expect, test } from "bun:test";
import { createS3Storage } from "../../apps/api/src/media/storage";
import { testS3Endpoint } from "../config";

const endpoint = testS3Endpoint;

test("Floci S3 supports presigned upload and public media delivery", async () => {
  const storage = createS3Storage({
    region: "us-east-1",
    bucket: "pixelpushr-media",
    publicBaseUrl: `${endpoint}/pixelpushr-media`,
    endpoint,
    accessKeyId: "test",
    secretAccessKey: "test",
  });
  const key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
  const copiedKey = `${key.slice(0, 36)}/${crypto.randomUUID()}`;
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
    await storage.copy(key, copiedKey);
    expect(await storage.head(copiedKey)).toEqual({
      sizeBytes: bytes.byteLength,
      mimeType: "image/png",
    });
    expect(await storage.readPrefix(copiedKey, 8)).toEqual(bytes.slice(0, 8));
    const publicResponse = await fetch(storage.publicUrl(key));
    expect(publicResponse.status).toBe(200);
  } finally {
    await storage.remove(key);
    await storage.remove(copiedKey);
  }
});

test("Floci S3 stores bounded JPEG thumbnails", async () => {
  const storage = createS3Storage({
    region: "us-east-1",
    bucket: "pixelpushr-media",
    publicBaseUrl: `${endpoint}/pixelpushr-media`,
    endpoint,
    accessKeyId: "test",
    secretAccessKey: "test",
  });
  const key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
  const jpeg = new Uint8Array([255, 216, 255, 217]);
  try {
    await storage.writeSmall(key, "image/jpeg", jpeg);
    expect(await storage.head(key)).toEqual({
      sizeBytes: jpeg.length,
      mimeType: "image/jpeg",
    });
    expect(await storage.readPrefix(key, 4)).toEqual(jpeg);
    expect((await fetch(storage.publicUrl(key))).status).toBe(200);
    await expect(
      storage.writeSmall(key, "image/jpeg", new Uint8Array(1024 * 1024 + 1)),
    ).rejects.toThrow();
  } finally {
    await storage.remove(key);
  }
});
