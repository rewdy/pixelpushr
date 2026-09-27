import { Temporal } from "@js-temporal/polyfill";
import type {
  ManifestTransition,
  OverrideWindow,
} from "@pixelpushr/contracts/manifest";
import type { scheduleRules } from "../db/schema";
import { occurrenceWindows } from "./recurrence";

export type ScheduleRule = typeof scheduleRules.$inferSelect;

/** Interpret a local wall time in an IANA timezone, including DST changes. */
export const localTimeToInstant = (
  localTime: string,
  timezone: string,
): Date => {
  const instant = Temporal.PlainDateTime.from(localTime)
    .toZonedDateTime(timezone)
    .toInstant();
  return new Date(instant.epochMilliseconds);
};

/** Half-open [start, end) activity check shared by all recurrence kinds. */
export const isScheduleActive = (
  rule: ScheduleRule,
  organizationTimezone: string,
  at: Date,
): boolean => {
  return (
    occurrenceWindows(
      rule,
      organizationTimezone,
      at,
      new Date(at.getTime() + 1),
    ).length > 0
  );
};

/** Highest priority wins; assignment ID breaks ties consistently across requests. */
export const activeOverride = (
  windows: OverrideWindow[],
  at: Date,
): OverrideWindow | null =>
  windows
    .filter(
      (window) =>
        at.getTime() >= Date.parse(window.startAt) &&
        at.getTime() < Date.parse(window.endAt),
    )
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.assignmentId.localeCompare(right.assignmentId),
    )[0] ?? null;

/** Only winner changes matter to the player; timestamps are absolute UTC. */
export const overrideTransitions = (
  windows: OverrideWindow[],
  at: Date,
): ManifestTransition[] => {
  const boundaries = [
    ...new Set(windows.flatMap((window) => [window.startAt, window.endAt])),
  ]
    .filter((value) => Date.parse(value) > at.getTime())
    .sort();
  let previous = activeOverride(windows, at)?.assignmentId ?? null;
  const transitions: ManifestTransition[] = [];
  for (const boundary of boundaries) {
    const winner =
      activeOverride(windows, new Date(boundary))?.assignmentId ?? null;
    if (winner !== previous)
      transitions.push({ at: boundary, overrideId: winner });
    previous = winner;
  }
  return transitions;
};
