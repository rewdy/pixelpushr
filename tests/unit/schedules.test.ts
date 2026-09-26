import { describe, expect, test } from "bun:test";
import type { ScheduleRule } from "../../apps/api/src/displays/schedules";
import { activeOverride, isScheduleActive, localTimeToInstant, overrideTransitions } from "../../apps/api/src/displays/schedules";
import type { OverrideWindow } from "@pixelpushr/contracts/manifest";

const weekly = (startLocal: string, endLocal: string, weekInterval: number, timezone = "America/Chicago"): ScheduleRule => ({
  id: crypto.randomUUID(), organizationId: crypto.randomUUID(), recurrence: "weekly", timezone,
  startAt: localTimeToInstant(startLocal, timezone), endAt: localTimeToInstant(endLocal, timezone),
  weekInterval, recurrenceUntil: null,
});

test("overlapping override priority and exact boundaries resolve deterministically", () => {
  const windows: OverrideWindow[] = [
    { assignmentId: "low", priority: 1, startAt: "2026-09-26T12:00:00.000Z", endAt: "2026-09-26T12:05:00.000Z", queue: [] },
    { assignmentId: "high", priority: 9, startAt: "2026-09-26T12:01:00.000Z", endAt: "2026-09-26T12:03:00.000Z", queue: [] },
  ];
  expect(activeOverride(windows, new Date("2026-09-26T12:00:00.000Z"))?.assignmentId).toBe("low");
  expect(activeOverride(windows, new Date("2026-09-26T12:01:00.000Z"))?.assignmentId).toBe("high");
  expect(activeOverride(windows, new Date("2026-09-26T12:03:00.000Z"))?.assignmentId).toBe("low");
  expect(activeOverride(windows, new Date("2026-09-26T12:05:00.000Z"))).toBeNull();
  expect(overrideTransitions(windows, new Date("2026-09-26T11:59:00.000Z"))).toEqual([
    { at: "2026-09-26T12:00:00.000Z", overrideId: "low" },
    { at: "2026-09-26T12:01:00.000Z", overrideId: "high" },
    { at: "2026-09-26T12:03:00.000Z", overrideId: "low" },
    { at: "2026-09-26T12:05:00.000Z", overrideId: null },
  ]);
});

describe("schedule evaluation", () => {
  test("date-bounded windows include the start but exclude the end", () => {
    const rule = { ...weekly("2026-09-01T09:00", "2026-09-01T10:00", 1), recurrence: "none" as const };
    expect(isScheduleActive(rule, "America/Chicago", rule.startAt)).toBe(true);
    expect(isScheduleActive(rule, "America/Chicago", rule.endAt)).toBe(false);
  });

  test("three staggered campaigns each own one week in a three-week cycle", () => {
    const campaigns = [0, 1, 2].map((index) => weekly(`2026-09-${String(7 + 7 * index).padStart(2, "0")}T00:00`, `2026-09-${String(14 + 7 * index).padStart(2, "0")}T00:00`, 3));
    for (const [at, expected] of [["2026-09-08T12:00", 0], ["2026-09-15T12:00", 1], ["2026-09-22T12:00", 2], ["2026-09-29T12:00", 0]] as const) {
      const instant = localTimeToInstant(at, "America/Chicago");
      expect(campaigns.map((rule) => isScheduleActive(rule, "America/Chicago", instant))).toEqual(campaigns.map((_, index) => index === expected));
    }
  });

  test("weekly wall time stays fixed across daylight saving time", () => {
    const rule = weekly("2026-03-01T09:00", "2026-03-01T10:00", 1);
    expect(isScheduleActive(rule, "America/Chicago", new Date("2026-03-08T14:30:00Z"))).toBe(true);
    expect(isScheduleActive(rule, "America/Chicago", new Date("2026-03-08T15:00:00Z"))).toBe(false);
  });

  test("a timezone change moves future weekly wall times but not one-time instants", () => {
    const rule = weekly("2026-09-07T09:00", "2026-09-07T10:00", 1);
    const oldInstant = localTimeToInstant("2026-09-14T09:30", "America/Chicago");
    const newInstant = localTimeToInstant("2026-09-14T09:30", "America/New_York");
    expect(isScheduleActive(rule, "America/New_York", newInstant)).toBe(true);
    expect(isScheduleActive(rule, "America/New_York", oldInstant)).toBe(false);
    expect(isScheduleActive({ ...rule, recurrence: "none" }, "America/New_York", rule.startAt)).toBe(true);
  });

  test("weekly recurrence can expire", () => {
    const rule = weekly("2026-09-07T09:00", "2026-09-07T10:00", 1);
    rule.recurrenceUntil = localTimeToInstant("2026-09-14T00:00", "America/Chicago");
    expect(isScheduleActive(rule, "America/Chicago", localTimeToInstant("2026-09-07T09:30", "America/Chicago"))).toBe(true);
    expect(isScheduleActive(rule, "America/Chicago", localTimeToInstant("2026-09-14T09:30", "America/Chicago"))).toBe(false);
  });
});
