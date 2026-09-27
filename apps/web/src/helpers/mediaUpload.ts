import type { MediaAsset } from "../models/media.models";
import { requestJson } from "./api";
import { captureVideoThumbnail, readMediaPreview } from "./mediaPreview";

/** Uploads and completes one asset, preserving best-effort video poster creation. */
export const uploadMediaFile = async (file: File): Promise<MediaAsset> => {
  const created = await requestJson<{
    asset: MediaAsset;
    uploadUrl: string | null;
  }>("/admin/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    }),
  });
  if (!created.uploadUrl)
    throw new Error(created.asset.failureReason ?? "Unsupported file");
  const response = await fetch(created.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);

  let preview: { width?: number; height?: number; durationMs?: number } = {};
  try {
    preview = await readMediaPreview(file);
  } catch (error) {
    if (file.type.startsWith("video/")) {
      await requestJson(`/admin/media/${created.asset.id}/complete`, {
        method: "POST",
        body: "{}",
      });
      throw error;
    }
  }
  const completed = await requestJson<{ asset: MediaAsset }>(
    `/admin/media/${created.asset.id}/complete`,
    { method: "POST", body: JSON.stringify(preview) },
  );
  if (completed.asset.status !== "ready")
    throw new Error(
      completed.asset.failureReason ?? "Media could not be processed",
    );
  if (file.type.startsWith("video/")) {
    try {
      const thumbnail = await captureVideoThumbnail(file);
      await requestJson(`/admin/media/${created.asset.id}/thumbnail`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: thumbnail,
      });
    } catch {
      // A video remains ready when poster generation or upload fails.
    }
  }
  return completed.asset;
};
