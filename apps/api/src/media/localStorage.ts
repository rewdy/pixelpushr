import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MediaStorage } from "./storage";

export type LocalMediaStorage = MediaStorage & {
  kind: "local";
  validUpload: (
    key: string,
    mimeType: string,
    expires: string,
    signature: string,
  ) => boolean;
  writeUpload: (
    key: string,
    mimeType: string,
    request: Request,
  ) => Promise<void>;
  serve: (key: string) => Promise<Response | null>;
};

const validKey = (key: string) => /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key);

/** Stores development media on disk behind expiring upload URLs. */
export const createLocalStorage = (
  directory: string,
  webBaseUrl: string,
  secret: string,
): LocalMediaStorage => {
  const pathFor = (key: string) => {
    if (!validKey(key)) throw new Error("Invalid media key");
    return join(directory, key);
  };
  const sign = (key: string, mimeType: string, expires: string) =>
    createHmac("sha256", secret)
      .update(`${key}\n${mimeType}\n${expires}`)
      .digest("hex");
  return {
    kind: "local",
    createUploadUrl: async (key, mimeType) => {
      const expires = String(Date.now() + 15 * 60 * 1000);
      const signature = sign(key, mimeType, expires);
      return `${webBaseUrl.replace(/\/$/, "")}/api/local-media/${key}?expires=${expires}&signature=${signature}`;
    },
    validUpload: (key, mimeType, expires, signature) => {
      if (
        !validKey(key) ||
        !/^\d+$/.test(expires) ||
        Number(expires) < Date.now() ||
        !/^[0-9a-f]{64}$/.test(signature)
      )
        return false;
      return timingSafeEqual(
        Buffer.from(sign(key, mimeType, expires), "hex"),
        Buffer.from(signature, "hex"),
      );
    },
    writeUpload: async (key, mimeType, request) => {
      const path = pathFor(key);
      await mkdir(join(directory, key.split("/")[0]!), { recursive: true });
      await Bun.write(path, request);
      await Bun.write(`${path}.type`, mimeType);
    },
    head: async (key) => {
      const file = Bun.file(pathFor(key));
      if (!(await file.exists())) return null;
      const type = Bun.file(`${pathFor(key)}.type`);
      return { sizeBytes: file.size, mimeType: await type.text() };
    },
    readPrefix: async (key, length) =>
      Bun.file(pathFor(key)).slice(0, length).bytes(),
    remove: async (key) => {
      const file = Bun.file(pathFor(key));
      const type = Bun.file(`${pathFor(key)}.type`);
      if (await file.exists()) await file.delete();
      if (await type.exists()) await type.delete();
    },
    publicUrl: (key) =>
      `${webBaseUrl.replace(/\/$/, "")}/api/local-media/${key}`,
    serve: async (key) => {
      const file = Bun.file(pathFor(key));
      if (!(await file.exists())) return null;
      const mimeType = await Bun.file(`${pathFor(key)}.type`).text();
      return new Response(file, {
        headers: {
          "content-type": mimeType,
          "cache-control": "public, max-age=3600",
          "accept-ranges": "bytes",
        },
      });
    },
  };
};
