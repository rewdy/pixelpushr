import { Temporal } from "@js-temporal/polyfill";
import type { ManifestTransition, OverrideWindow } from "@pixelpushr/contracts/manifest";
import type { scheduleRules } from "../db/schema";

export type ScheduleRule = typeof scheduleRules.$inferSelect;

/** Interpret a local wall time in an IANA timezone, including DST changes. */
export const localTimeToInstant = (localTime: string, timezone: string): Date => {
  const instant = Temporal.PlainDateTime.from(localTime).toZonedDateTime(timezone).toInstant();
  return new Date(instant.epochMilliseconds);
};

const occurrence = (rule: ScheduleRule, organizationTimezone: string, week: number) => {
  // The original timezone preserves the administrator-entered wall clock if the
  // organization changes timezone later. The new zone then owns future repeats.
  const startLocal = Temporal.Instant.from(rule.startAt.toISOString()).toZonedDateTimeISO(rule.timezone).toPlainDateTime();
  const endLocal = Temporal.Instant.from(rule.endAt.toISOString()).toZonedDateTimeISO(rule.timezone).toPlainDateTime();
  const weeks = week * (rule.weekInterval ?? 1);
  return {
    start: startLocal.add({ weeks }).toZonedDateTime(organizationTimezone).epochMilliseconds,
    end: endLocal.add({ weeks }).toZonedDateTime(organizationTimezone).epochMilliseconds,
  };
};

/** Half-open [start, end) schedule window, with calendar-week recurrence. */
export const isScheduleActive = (rule: ScheduleRule, organizationTimezone: string, at: Date): boolean => {
  const now = at.getTime();
  if (rule.recurrence === "none") return now >= rule.startAt.getTime() && now < rule.endAt.getTime();
  const startDate = Temporal.Instant.from(rule.startAt.toISOString()).toZonedDateTimeISO(rule.timezone).toPlainDate();
  const currentDate = Temporal.Instant.from(at.toISOString()).toZonedDateTimeISO(organizationTimezone).toPlainDate();
  const days = currentDate.since(startDate, { largestUnit: "days" }).days;
  const approximateWeek = Math.floor(days / (7 * (rule.weekInterval ?? 1)));
  for (let week = Math.max(0, approximateWeek - 1); week <= Math.max(0, approximateWeek + 1); week += 1) {
    const window = occurrence(rule, organizationTimezone, week);
    if (rule.recurrenceUntil && window.start >= rule.recurrenceUntil.getTime()) continue;
    if (now >= window.start && now < window.end) return true;
  }
  return false;
};

/** Highest priority wins; assignment ID breaks ties consistently across requests. */
export const activeOverride = (windows: OverrideWindow[], at: Date): OverrideWindow | null => windows
  .filter((window) => at.getTime() >= Date.parse(window.startAt) && at.getTime() < Date.parse(window.endAt))
  .sort((left, right) => right.priority - left.priority || left.assignmentId.localeCompare(right.assignmentId))[0] ?? null;

/** Only winner changes matter to the player; timestamps are absolute UTC. */
export const overrideTransitions = (windows: OverrideWindow[], at: Date): ManifestTransition[] => {
  const boundaries = [...new Set(windows.flatMap((window) => [window.startAt, window.endAt]))].filter((value) => Date.parse(value) > at.getTime()).sort();
  let previous = activeOverride(windows, at)?.assignmentId ?? null;
  const transitions: ManifestTransition[] = [];
  for (const boundary of boundaries) {
    const winner = activeOverride(windows, new Date(boundary))?.assignmentId ?? null;
    if (winner !== previous) transitions.push({ at: boundary, overrideId: winner });
    previous = winner;
  }
  return transitions;
};
