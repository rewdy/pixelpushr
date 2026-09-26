import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoredObject = { sizeBytes: number; mimeType: string };
export type MediaStorage = {
  kind: "local" | "s3";
  createUploadUrl: (key: string, mimeType: string) => Promise<string>;
  head: (key: string) => Promise<StoredObject | null>;
  readPrefix: (key: string, length: number) => Promise<Uint8Array>;
  remove: (key: string) => Promise<void>;
  publicUrl: (key: string) => string;
};

type S3Options = { region: string; bucket: string; publicBaseUrl: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string };

/** Adapts AWS S3 or local MinIO to the media storage boundary. */
export const createS3Storage = (options: S3Options): MediaStorage => {
  const client = new S3Client({
    region: options.region,
    ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true, credentials: { accessKeyId: options.accessKeyId!, secretAccessKey: options.secretAccessKey! } } : {}),
  });
  return {
    kind: "s3",
    createUploadUrl: async (key, mimeType) => getSignedUrl(client, new PutObjectCommand({ Bucket: options.bucket, Key: key, ContentType: mimeType }), { expiresIn: 900 }),
    head: async (key) => {
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket: options.bucket, Key: key }));
        return { sizeBytes: object.ContentLength ?? 0, mimeType: object.ContentType ?? "" };
      } catch (error) {
        if (error instanceof Error && (error.name === "NotFound" || error.name === "NoSuchKey")) return null;
        throw error;
      }
    },
    readPrefix: async (key, length) => {
      const object = await client.send(new GetObjectCommand({ Bucket: options.bucket, Key: key, Range: `bytes=0-${length - 1}` }));
      return object.Body ? object.Body.transformToByteArray() : new Uint8Array();
    },
    remove: async (key) => { await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key })); },
    publicUrl: (key) => `${options.publicBaseUrl.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`,
  };
};
