import type { MediaStorage } from "./storage";
import { matchesSignature, supportedMedia } from "./validation";

type UploadMetadata = {
  kind: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
};

type PreviewMetadata = {
  durationMs?: number;
};

/** Applies the same declared-size and MIME limits to uploads and replacements. */
export const uploadDeclarationFailure = (
  mimeType: string,
  sizeBytes: number,
  maxImageBytes: number,
  maxVideoBytes: number,
): string | null => {
  const kind = supportedMedia[mimeType as keyof typeof supportedMedia];
  if (!kind) return "Unsupported image or video format";
  const limit = kind === "image" ? maxImageBytes : maxVideoBytes;
  return sizeBytes > limit
    ? `File exceeds the ${Math.round(limit / 1024 / 1024)} MB limit`
    : null;
};

/** Checks the stored object before making it visible in a manifest. */
export const uploadedMediaFailure = async (
  storage: MediaStorage,
  upload: UploadMetadata,
  preview: PreviewMetadata,
): Promise<string | null> => {
  const object = await storage.head(upload.objectKey);
  if (!object) return "Uploaded object was not found";
  if (object.sizeBytes !== upload.sizeBytes)
    return "Uploaded size differs from declared size";
  if (object.mimeType !== upload.mimeType)
    return "Uploaded content type differs from declared type";
  if (upload.kind === "video" && !preview.durationMs)
    return "Video duration metadata is required";
  const bytes = await storage.readPrefix(upload.objectKey, 16);
  return matchesSignature(upload.mimeType, bytes)
    ? null
    : "File signature does not match its content type";
};
