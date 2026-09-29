import type { Assignment } from "./assignment.models";
import { type RecurrenceDraft, recurrencePayload } from "./RecurrenceFields";

const localDateTime = (instant: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

/** Renders a saved instant in its assignment timezone for the edit form. */
export const savedLocalDateTime = (instant: string, timezone: string) =>
  localDateTime(instant, timezone);

/** Builds a partial PATCH so untouched instants never round-trip through minute precision. */
export const assignmentEditPayload = (
  assignment: Assignment,
  startLocal: string,
  endLocal: string,
  draft: RecurrenceDraft,
  priority: number,
) => {
  const schedule = assignment.schedule;
  if (!schedule || !assignment.version)
    throw new Error("Scheduled assignment is required");
  const repeat = recurrencePayload(draft, startLocal);
  const body: Record<string, unknown> = {
    expectedVersion: assignment.version,
  };
  if (startLocal !== localDateTime(schedule.startAt, schedule.timezone))
    body.startLocal = startLocal;
  if (endLocal !== localDateTime(schedule.endAt, schedule.timezone))
    body.endLocal = endLocal;

  const current = {
    recurrence: repeat.recurrence,
    repeatInterval: "repeatInterval" in repeat ? repeat.repeatInterval : null,
    weekdays: "weekdays" in repeat ? repeat.weekdays : null,
    monthDay: "monthDay" in repeat ? repeat.monthDay : null,
    monthOrdinal: "monthOrdinal" in repeat ? repeat.monthOrdinal : null,
    monthWeekday: "monthWeekday" in repeat ? repeat.monthWeekday : null,
    lastOccurrenceDate:
      "lastOccurrenceDate" in repeat ? repeat.lastOccurrenceDate : null,
  };
  const frequencyChanged = current.recurrence !== schedule.recurrence;
  if (frequencyChanged) body.recurrence = current.recurrence;
  for (const key of [
    "repeatInterval",
    "weekdays",
    "monthDay",
    "monthOrdinal",
    "monthWeekday",
    "lastOccurrenceDate",
  ] as const) {
    if (
      frequencyChanged ||
      JSON.stringify(current[key]) !== JSON.stringify(schedule[key])
    )
      body[key] = current[key];
  }
  if (assignment.mode === "override" && priority !== assignment.priority)
    body.priority = priority;
  return body;
};
