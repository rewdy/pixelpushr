export const supportedMedia = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
} as const;

/** Checks the file signature before an asset can become ready. */
export const matchesSignature = (
  mimeType: string,
  bytes: Uint8Array,
): boolean => {
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  switch (mimeType) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes
          .slice(0, 8)
          .every(
            (value, index) =>
              value === [137, 80, 78, 71, 13, 10, 26, 10][index],
          )
      );
    case "image/webp":
      return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
    case "image/gif":
      return text(0, 6) === "GIF87a" || text(0, 6) === "GIF89a";
    case "video/mp4":
      return text(4, 8) === "ftyp";
    case "video/webm":
      return (
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3
      );
    default:
      return false;
  }
};
