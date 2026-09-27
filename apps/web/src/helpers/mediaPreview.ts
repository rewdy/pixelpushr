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

/** Captures a bounded JPEG poster without changing video upload readiness. */
export const captureVideoThumbnail = async (file: File): Promise<Blob> => {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Video thumbnail timed out")),
        10000,
      );
      const finish = (result: Blob | Error) => {
        window.clearTimeout(timeout);
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      video.onerror = () => finish(new Error("Video frame is unavailable"));
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          finish(new Error("Video duration is unavailable"));
          return;
        }
        video.currentTime = Math.min(0.5, video.duration / 2);
      };
      video.onseeked = () => {
        if (!video.videoWidth || !video.videoHeight) {
          finish(new Error("Video frame dimensions are unavailable"));
          return;
        }
        const scale = Math.min(
          1,
          640 / video.videoWidth,
          360 / video.videoHeight,
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          finish(new Error("Canvas is unavailable"));
          return;
        }
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          finish(new Error("Video frame could not be drawn"));
          return;
        }
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size > 1024 * 1024)
              finish(new Error("Video thumbnail exceeds 1 MB"));
            else finish(blob);
          },
          "image/jpeg",
          0.8,
        );
      };
      video.src = url;
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
};
