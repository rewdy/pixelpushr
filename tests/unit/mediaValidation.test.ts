import { expect, test } from "bun:test";
import { matchesSignature } from "../../apps/api/src/media/validation";

test("media signatures match declared browser formats", () => {
  expect(
    matchesSignature(
      "image/png",
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ),
  ).toBe(true);
  expect(matchesSignature("image/png", new Uint8Array([37, 80, 68, 70]))).toBe(
    false,
  );
  expect(
    matchesSignature(
      "video/mp4",
      new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112]),
    ),
  ).toBe(true);
});
