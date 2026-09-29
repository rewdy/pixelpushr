import { describe, expect, test } from "bun:test";
import type { Assignment } from "../../apps/web/src/components/DisplaysPage/assignment.models";
import { assignmentEditPayload } from "../../apps/web/src/components/DisplaysPage/assignmentEditPayload";
import type { RecurrenceDraft } from "../../apps/web/src/components/DisplaysPage/RecurrenceFields";

const assignment = (): Assignment => ({
  id: "assignment-1",
  playlistId: "playlist-1",
  playlistName: "Campaign",
  mode: "override",
  position: 2,
  priority: 3,
  version: "version-1",
  schedule: {
    recurrence: "none",
    startAt: "2026-09-27T13:25:42.000Z",
    endAt: "2026-09-27T13:30:00.000Z",
    timezone: "America/Chicago",
    repeatInterval: null,
    weekdays: null,
    monthDay: null,
    monthOrdinal: null,
    monthWeekday: null,
    lastOccurrenceDate: null,
  },
});

const draft = (recurrence: RecurrenceDraft["recurrence"]): RecurrenceDraft => ({
  recurrence,
  repeatInterval: 1,
  weekdays: ["1"],
  monthlyPattern: "date",
  monthDay: 1,
  monthOrdinal: "1",
  monthWeekday: "1",
  lastOccurrenceDate: "",
});

const payload = (
  item: Assignment,
  recurrence: RecurrenceDraft,
  priority = item.priority,
) =>
  assignmentEditPayload(
    item,
    "2026-09-27T08:25",
    "2026-09-27T08:30",
    recurrence,
    priority,
  );

describe("assignment edit payload", () => {
  test("priority-only edit omits an immediate start with seconds", () => {
    expect(payload(assignment(), draft("none"), 9)).toEqual({
      expectedVersion: "version-1",
      priority: 9,
    });
  });

  test("Append interval and weekday edits omit unchanged boundaries", () => {
    const item = assignment();
    item.mode = "scheduled";
    if (!item.schedule) throw new Error("Missing fixture schedule");
    item.schedule.recurrence = "weekly";
    item.schedule.repeatInterval = 1;
    item.schedule.weekdays = [1];
    expect(
      payload(item, {
        ...draft("weekly"),
        repeatInterval: 2,
        weekdays: ["1", "4"],
      }),
    ).toEqual({
      expectedVersion: "version-1",
      repeatInterval: 2,
      weekdays: [1, 4],
    });
  });

  test("switches among one-time, daily, weekly, and monthly without dates", () => {
    const item = assignment();
    item.mode = "scheduled";
    if (!item.schedule) throw new Error("Missing fixture schedule");
    const daily = payload(item, draft("daily"));
    expect(daily).toMatchObject({
      recurrence: "daily",
      repeatInterval: 1,
      weekdays: null,
      monthDay: null,
    });
    expect(daily).not.toHaveProperty("startLocal");
    expect(daily).not.toHaveProperty("endLocal");

    item.schedule.recurrence = "daily";
    item.schedule.repeatInterval = 1;
    const weekly = payload(item, draft("weekly"));
    expect(weekly).toMatchObject({
      recurrence: "weekly",
      repeatInterval: 1,
      weekdays: [1],
      monthDay: null,
    });

    item.schedule.recurrence = "weekly";
    item.schedule.weekdays = [1];
    const monthly = payload(item, {
      ...draft("monthly"),
      monthlyPattern: "weekday",
      monthOrdinal: "-1",
      monthWeekday: "5",
    });
    expect(monthly).toMatchObject({
      recurrence: "monthly",
      weekdays: null,
      monthDay: null,
      monthOrdinal: -1,
      monthWeekday: 5,
    });

    item.schedule.recurrence = "monthly";
    item.schedule.weekdays = null;
    item.schedule.monthOrdinal = -1;
    item.schedule.monthWeekday = 5;
    expect(payload(item, draft("none"))).toMatchObject({
      recurrence: "none",
      repeatInterval: null,
      monthOrdinal: null,
      monthWeekday: null,
    });
  });
});
