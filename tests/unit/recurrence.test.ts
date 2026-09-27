import { expect, test } from "bun:test";
import {
  coalesceWindows,
  occurrenceWindows,
} from "../../apps/api/src/displays/recurrence";
import type { ScheduleRule } from "../../apps/api/src/displays/schedules";
import { localTimeToInstant } from "../../apps/api/src/displays/schedules";

const rule = (
  startLocal: string,
  endLocal: string,
  changes: Partial<ScheduleRule>,
  timezone = "America/Chicago",
): ScheduleRule => ({
  id: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  recurrence: "daily",
  timezone,
  startAt: localTimeToInstant(startLocal, timezone),
  endAt: localTimeToInstant(endLocal, timezone),
  repeatInterval: 1,
  weekdays: null,
  monthDay: null,
  monthOrdinal: null,
  monthWeekday: null,
  lastOccurrenceDate: null,
  recurrenceUntil: null,
  ...changes,
});

const starts = (
  value: ScheduleRule,
  fromLocal: string,
  toLocal: string,
  timezone = "America/Chicago",
) =>
  occurrenceWindows(
    value,
    timezone,
    localTimeToInstant(fromLocal, timezone),
    localTimeToInstant(toLocal, timezone),
  ).map(({ start }) => start.toISOString());

test("daily starts repeat every N calendar days", () => {
  const value = rule("2026-09-01T09:00", "2026-09-01T10:00", {
    repeatInterval: 2,
  });
  expect(starts(value, "2026-09-01T00:00", "2026-09-07T00:00")).toEqual([
    "2026-09-01T14:00:00.000Z",
    "2026-09-03T14:00:00.000Z",
    "2026-09-05T14:00:00.000Z",
  ]);
});

test("last occurrence date includes its local day and preserves the final end", () => {
  const value = rule("2026-09-01T23:00", "2026-09-02T01:00", {
    lastOccurrenceDate: "2026-09-03",
  });
  const windows = occurrenceWindows(
    value,
    "America/Chicago",
    localTimeToInstant("2026-09-01T00:00", "America/Chicago"),
    localTimeToInstant("2026-09-05T00:00", "America/Chicago"),
  );
  expect(windows).toHaveLength(3);
  expect(windows.at(-1)?.end.toISOString()).toBe("2026-09-04T06:00:00.000Z");
});

test("overlapping and touching windows of one assignment become one window", () => {
  const value = rule("2026-09-01T09:00", "2026-09-02T10:00", {});
  const windows = occurrenceWindows(
    value,
    "America/Chicago",
    localTimeToInstant("2026-09-01T00:00", "America/Chicago"),
    localTimeToInstant("2026-09-05T00:00", "America/Chicago"),
  );
  expect(windows).toHaveLength(4);
  expect(coalesceWindows(windows)).toEqual([
    { start: windows[0]?.start, end: windows[3]?.end },
  ]);
});

test("selected weekdays remain inside eligible two-week cycles", () => {
  const value = rule("2026-09-07T09:00", "2026-09-07T10:00", {
    recurrence: "weekly",
    repeatInterval: 2,
    weekdays: [1, 4],
  });
  expect(starts(value, "2026-09-07T00:00", "2026-09-25T00:00")).toEqual([
    "2026-09-07T14:00:00.000Z",
    "2026-09-10T14:00:00.000Z",
    "2026-09-21T14:00:00.000Z",
    "2026-09-24T14:00:00.000Z",
  ]);
});

test("long weekly intervals retain their anchored weekday", () => {
  const value = rule("2026-09-07T09:00", "2026-09-07T10:00", {
    recurrence: "weekly",
    repeatInterval: 52,
    weekdays: [1],
  });
  expect(starts(value, "2026-09-01T00:00", "2027-10-01T00:00")).toEqual([
    "2026-09-07T14:00:00.000Z",
    "2027-09-06T14:00:00.000Z",
  ]);
});

test("monthly date skips a missing 31st without shifting its anchor", () => {
  const value = rule("2026-01-31T09:00", "2026-01-31T10:00", {
    recurrence: "monthly",
    monthDay: 31,
  });
  expect(starts(value, "2026-01-01T00:00", "2026-05-01T00:00")).toEqual([
    "2026-01-31T15:00:00.000Z",
    "2026-03-31T14:00:00.000Z",
  ]);
});

test("monthly ordinal weekday supports last and fifth weekday", () => {
  const last = rule("2026-01-30T09:00", "2026-01-30T10:00", {
    recurrence: "monthly",
    monthOrdinal: -1,
    monthWeekday: 5,
  });
  expect(starts(last, "2026-01-01T00:00", "2026-04-01T00:00")).toEqual([
    "2026-01-30T15:00:00.000Z",
    "2026-02-27T15:00:00.000Z",
    "2026-03-27T14:00:00.000Z",
  ]);
  const fifth = rule("2026-01-29T09:00", "2026-01-29T10:00", {
    recurrence: "monthly",
    monthOrdinal: 5,
    monthWeekday: 4,
  });
  expect(starts(fifth, "2026-01-01T00:00", "2026-04-01T00:00")).toEqual([
    "2026-01-29T15:00:00.000Z",
  ]);
});

test("DST gaps follow Temporal's existing shift-forward behavior", () => {
  const value = rule("2026-03-07T02:30", "2026-03-07T03:30", {});
  expect(starts(value, "2026-03-07T00:00", "2026-03-10T00:00")).toEqual([
    "2026-03-07T08:30:00.000Z",
    "2026-03-08T08:30:00.000Z",
    "2026-03-09T07:30:00.000Z",
  ]);
});

test("DST folds use the earlier offset and future rules follow organization timezone", () => {
  const fold = rule("2026-10-31T01:30", "2026-10-31T02:30", {});
  expect(starts(fold, "2026-10-31T00:00", "2026-11-03T00:00")).toEqual([
    "2026-10-31T06:30:00.000Z",
    "2026-11-01T06:30:00.000Z",
    "2026-11-02T07:30:00.000Z",
  ]);
  const future = rule("2026-09-07T09:00", "2026-09-07T10:00", {
    recurrence: "weekly",
    weekdays: [1],
  });
  expect(
    starts(future, "2026-09-14T00:00", "2026-09-15T00:00", "America/New_York"),
  ).toEqual(["2026-09-14T13:00:00.000Z"]);
});
