import type {
  ManifestItem,
  OverrideWindow,
  PlayerManifest,
} from "@pixelpushr/contracts/manifest";

export type QueueState = {
  queue: ManifestItem[];
  index: number;
  cycle: number;
  version: string;
  pending: PlayerManifest | null;
  manifest: PlayerManifest;
  overrideId: string | null;
};

const winnerAt = (
  manifest: PlayerManifest,
  serverNow: number,
): OverrideWindow | null =>
  (manifest.overrideWindows ?? [])
    .filter(
      (window) =>
        serverNow >= Date.parse(window.startAt) &&
        serverNow < Date.parse(window.endAt),
    )
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.assignmentId.localeCompare(right.assignmentId),
    )[0] ?? null;

/** Starts playback from the first manifest queue. */
export const initialQueue = (manifest: PlayerManifest): QueueState => ({
  queue: manifest.activeQueue,
  index: 0,
  cycle: 0,
  version: manifest.version,
  pending: null,
  manifest,
  overrideId: manifest.override?.assignmentId ?? null,
});

/** Holds a normal manifest update until the existing queue completes. */
export const receiveManifest = (
  state: QueueState,
  manifest: PlayerManifest,
): QueueState => {
  const nextOverrideId = manifest.override?.assignmentId ?? null;
  if (nextOverrideId !== state.overrideId) return initialQueue(manifest);
  if (nextOverrideId)
    return JSON.stringify(state.queue) === JSON.stringify(manifest.activeQueue)
      ? { ...state, manifest, version: manifest.version, pending: null }
      : initialQueue(manifest);
  if (state.queue.length === 0) return initialQueue(manifest);
  const unchanged =
    JSON.stringify(state.queue) === JSON.stringify(manifest.normalQueue);
  return {
    ...state,
    manifest,
    version: manifest.version,
    pending: unchanged ? null : manifest,
  };
};

/** A known override boundary interrupts playback even without network access. */
export const applyTimedOverride = (
  state: QueueState,
  serverNow: number,
): QueueState => {
  const winner = winnerAt(state.manifest, serverNow);
  if ((winner?.assignmentId ?? null) === state.overrideId) return state;
  return {
    ...state,
    queue: winner?.queue ?? state.manifest.normalQueue,
    index: 0,
    cycle: state.cycle + 1,
    overrideId: winner?.assignmentId ?? null,
    pending: null,
  };
};

/** Advances one item, activating any pending normal update at queue rollover. */
export const advanceQueue = (state: QueueState): QueueState => {
  if (state.index + 1 < state.queue.length)
    return { ...state, index: state.index + 1, cycle: state.cycle + 1 };
  if (state.pending && !state.overrideId)
    return { ...initialQueue(state.pending), cycle: state.cycle + 1 };
  return { ...state, index: 0, cycle: state.cycle + 1 };
};

export const playerCrossfadeMs = 500;

export type OverlapPlan = {
  next: ManifestItem;
  nextState: QueueState;
  startMs: number;
  durationMs: number;
};

/** Plans an overlap inside an outgoing item's remaining time, without delaying its boundary. */
export const planItemOverlap = (
  state: QueueState,
  remainingMs: number,
): OverlapPlan | null => {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  const nextState = advanceQueue(state);
  const next = nextState.queue[nextState.index];
  if (!next) return null;
  const durationMs = Math.min(playerCrossfadeMs, remainingMs);
  return {
    next,
    nextState,
    startMs: remainingMs - durationMs,
    durationMs,
  };
};
