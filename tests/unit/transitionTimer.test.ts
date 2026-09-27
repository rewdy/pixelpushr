import { expect, test } from "bun:test";
import {
  maxTransitionTimeoutMs,
  transitionDelayMs,
} from "../../apps/web/src/helpers/transitionTimer";

test("distant transitions wake in bounded chunks using server-adjusted time", () => {
  const boundary = 3_000_000_000;
  const skew = 60_000;
  expect(transitionDelayMs(boundary, skew)).toBe(maxTransitionTimeoutMs);
  expect(transitionDelayMs(boundary, 2_999_000_000 + skew)).toBe(940_000);
  expect(transitionDelayMs(boundary, boundary + skew)).toBe(0);
});
