import { expect, test } from "bun:test";
import type { PlayerManifest } from "@pixelpushr/contracts/manifest";
import {
  advanceQueue,
  applyTimedOverride,
  initialQueue,
  planItemOverlap,
  receiveManifest,
} from "../../apps/web/src/helpers/playerQueue";

const item = (id: string) => ({
  id,
  playlistId: "p",
  assetId: id,
  kind: "image" as const,
  url: `/${id}.png`,
  imageDurationMs: 1000,
  videoMode: null,
  repeatDurationMs: null,
});

test("500 ms overlap stays inside each configured item boundary", () => {
  const first = initialQueue(manifest("normal", ["a", "b"]));
  const planned = planItemOverlap(first, 1000);
  expect(planned?.next.id).toBe("b");
  expect(planned?.startMs).toBe(500);
  expect(planned?.durationMs).toBe(500);
  expect(planned?.startMs + (planned?.durationMs ?? 0)).toBe(1000);
  expect(planItemOverlap(first, 300)?.durationMs).toBe(300);
  expect(planItemOverlap(first, 300)?.startMs).toBe(0);
  expect(
    planItemOverlap(initialQueue(manifest("loop", ["only"])), 1000)?.next.id,
  ).toBe("only");
  expect(planItemOverlap(first, Number.NaN)).toBeNull();
  expect(planItemOverlap(initialQueue(manifest("empty", [])), 1000)).toBeNull();
});

test("overlap targets the latest pending normal queue at rollover", () => {
  const initial = initialQueue(manifest("one", ["a", "b"]));
  const last = advanceQueue(initial);
  const pending = receiveManifest(last, manifest("two", ["c"]));
  expect(planItemOverlap(pending, 1000)?.next.id).toBe("c");
  expect(planItemOverlap(pending, 1000)?.nextState.queue[0]?.id).toBe("c");
  expect(planItemOverlap(pending, 1000)?.durationMs).toBe(500);
  expect(advanceQueue(pending).queue[0]?.id).toBe("c");
});
const manifest = (version: string, ids: string[]): PlayerManifest => ({
  display: { id: "d", name: "Lobby" },
  version,
  serverTime: new Date().toISOString(),
  normalQueue: ids.map(item),
  activeQueue: ids.map(item),
  override: null,
  overrideWindows: [],
  transitions: [],
});

test("normal updates wait until queue rollover and single-item queues loop", () => {
  const initial = initialQueue(manifest("one", ["a", "b"]));
  const pending = receiveManifest(initial, manifest("two", ["c"]));
  expect(advanceQueue(pending).queue.map((entry) => entry.id)).toEqual([
    "a",
    "b",
  ]);
  const switched = advanceQueue(advanceQueue(pending));
  expect(switched.queue.map((entry) => entry.id)).toEqual(["c"]);
  expect(advanceQueue(switched).cycle).toBe(switched.cycle + 1);
});

test("an empty queue starts immediately and a withdrawn update never plays", () => {
  const started = receiveManifest(
    initialQueue(manifest("empty", [])),
    manifest("one", ["a"]),
  );
  expect(started.queue.map((entry) => entry.id)).toEqual(["a"]);
  const pending = receiveManifest(started, manifest("two", ["b"]));
  expect(receiveManifest(pending, manifest("one", ["a"])).pending).toBeNull();
});

test("known override boundaries interrupt and restore the latest normal queue", () => {
  const startAt = "2026-09-26T12:00:00.000Z";
  const endAt = "2026-09-26T12:00:02.000Z";
  const window = {
    assignmentId: "override",
    priority: 5,
    startAt,
    endAt,
    queue: [item("countdown")],
  };
  const scheduled: PlayerManifest = {
    ...manifest("scheduled", ["brand"]),
    serverTime: "2026-09-26T11:59:59.000Z",
    overrideWindows: [window],
    transitions: [
      { at: startAt, overrideId: "override" },
      { at: endAt, overrideId: null },
    ],
  };
  const initial = initialQueue(scheduled);
  expect(initial.queue[0]?.id).toBe("brand");
  const active = applyTimedOverride(initial, Date.parse(startAt));
  expect(active.queue[0]?.id).toBe("countdown");
  const latest = receiveManifest(active, {
    ...scheduled,
    version: "updated",
    normalQueue: [item("new-brand")],
    activeQueue: [item("countdown")],
    override: window,
  });
  expect(latest.queue[0]?.id).toBe("countdown");
  expect(applyTimedOverride(latest, Date.parse(endAt)).queue[0]?.id).toBe(
    "new-brand",
  );
});
