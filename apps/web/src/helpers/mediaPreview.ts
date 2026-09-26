type Preview = { width?: number; height?: number; durationMs?: number };

/** Reads browser playback metadata before marking an uploaded asset ready. */
export const readMediaPreview = async (file: File): Promise<Preview> => {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const image = await createImageBitmap(file);
      const result = { width: image.width, height: image.height };
      image.close();
      return result;
    }
    if (file.type.startsWith("video/")) {
      return await new Promise<Preview>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.onloadedmetadata = () => {
          const result = {
            width: video.videoWidth,
            height: video.videoHeight,
            durationMs: Math.round(video.duration * 1000),
          };
          video.removeAttribute("src");
          video.load();
          if (!Number.isFinite(result.durationMs) || result.durationMs <= 0)
            reject(new Error("Video duration is unavailable"));
          else resolve(result);
        };
        video.onerror = () =>
          reject(new Error("This browser cannot read the video"));
        video.src = url;
      });
    }
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
};
