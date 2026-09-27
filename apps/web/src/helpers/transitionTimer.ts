/** Browsers clamp oversized timeouts; wake and re-arm until the actual boundary. */
export const maxTransitionTimeoutMs = 2_147_000_000;

export const transitionDelayMs = (boundaryAt: number, adjustedNow: number) =>
  Math.max(0, Math.min(maxTransitionTimeoutMs, boundaryAt - adjustedNow));
