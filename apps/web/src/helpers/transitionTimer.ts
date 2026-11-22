/** Browsers clamp oversized timeouts; wake and re-arm until the actual boundary. */
export const maxTransitionTimeoutMs = 2_147_000_000;

export const transitionDelayMs = (boundaryAt: number, adjustedNow: number) =>
  Math.max(0, Math.min(maxTransitionTimeoutMs, boundaryAt - adjustedNow));

/** Schedules a playback callback against a monotonic deadline, even if a timer wakes early. */
export const schedulePlaybackDeadline = (
  deadline: number,
  callback: () => void,
) => {
  let timer: number;
  const arm = () => {
    timer = window.setTimeout(
      () => {
        if (performance.now() < deadline) arm();
        else callback();
      },
      Math.ceil(transitionDelayMs(deadline, performance.now())),
    );
  };
  arm();
  return () => window.clearTimeout(timer);
};
