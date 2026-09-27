import { Temporal } from "@js-temporal/polyfill";
import { RRule } from "rrule";
import type { scheduleRules } from "../db/schema";

type ScheduleRule = typeof scheduleRules.$inferSelect;

export type OccurrenceWindow = { start: Date; end: Date };

const maxExpansionDays = 400;
const maxWindows = 512;

const localFromInstant = (instant: Date, timezone: string) =>
  Temporal.Instant.from(instant.toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime();

const floatingDate = (local: Temporal.PlainDateTime): Date =>
  new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
      local.millisecond,
    ),
  );

const localFromFloatingDate = (date: Date) =>
  new Temporal.PlainDateTime(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );

const instantFromLocal = (local: Temporal.PlainDateTime, timezone: string) =>
  new Date(local.toZonedDateTime(timezone).epochMilliseconds);

const weekday = (isoDay: number) => {
  const value = [
    RRule.MO,
    RRule.TU,
    RRule.WE,
    RRule.TH,
    RRule.FR,
    RRule.SA,
    RRule.SU,
  ][isoDay - 1];
  if (!value) throw new Error("Invalid recurrence weekday");
  return value;
};

/** Expands calendar-local starts, then uses Temporal for authoritative instants. */
export const occurrenceWindows = (
  rule: ScheduleRule,
  organizationTimezone: string,
  from: Date,
  to: Date,
): OccurrenceWindow[] => {
  if (rule.recurrence === "none")
    return rule.startAt < to && rule.endAt > from
      ? [{ start: rule.startAt, end: rule.endAt }]
      : [];

  const firstStart = localFromInstant(rule.startAt, rule.timezone);
  const firstEnd = localFromInstant(rule.endAt, rule.timezone);
  const span = firstStart.until(firstEnd, { largestUnit: "days" });
  const durationDays = Math.ceil(
    (floatingDate(firstEnd).getTime() - floatingDate(firstStart).getTime()) /
      86_400_000,
  );
  if (
    to.getTime() - from.getTime() > maxExpansionDays * 86_400_000 ||
    durationDays > maxExpansionDays
  )
    throw new Error("Recurrence expansion exceeds supported range");
  const interval = rule.repeatInterval ?? 1;
  const options = {
    dtstart: floatingDate(firstStart),
    interval,
    wkst: RRule.MO,
  };
  const calendarRule =
    rule.recurrence === "daily"
      ? new RRule({ ...options, freq: RRule.DAILY })
      : rule.recurrence === "weekly"
        ? new RRule({
            ...options,
            freq: RRule.WEEKLY,
            byweekday: (rule.weekdays ?? [firstStart.dayOfWeek]).map(weekday),
          })
        : new RRule({
            ...options,
            freq: RRule.MONTHLY,
            ...(rule.monthDay
              ? { bymonthday: rule.monthDay }
              : {
                  byweekday: weekday(
                    rule.monthWeekday ?? firstStart.dayOfWeek,
                  ).nth(rule.monthOrdinal ?? 1),
                }),
          });
  const localFrom = localFromInstant(from, organizationTimezone).subtract({
    days: durationDays + 2,
  });
  const localTo = localFromInstant(to, organizationTimezone).add({ days: 2 });
  const starts = calendarRule.between(
    floatingDate(localFrom),
    floatingDate(localTo),
    true,
  );
  if (starts.length > maxWindows)
    throw new Error("Recurrence expansion exceeds supported window count");
  return starts
    .map((floatingStart) => {
      const startLocal = localFromFloatingDate(floatingStart);
      const start = instantFromLocal(startLocal, organizationTimezone);
      const resolvedEnd = instantFromLocal(
        startLocal.add(span),
        organizationTimezone,
      );
      // A spring-forward gap can move the start past a valid local end. Keep
      // the window's nominal local duration instead of yielding zero/negative time.
      const end =
        resolvedEnd > start
          ? resolvedEnd
          : new Date(
              start.getTime() +
                Math.max(
                  1,
                  floatingDate(firstEnd).getTime() -
                    floatingDate(firstStart).getTime(),
                ),
            );
      return { startLocal, start, end };
    })
    .filter(({ startLocal, start, end }) => {
      if (
        rule.lastOccurrenceDate &&
        startLocal.toPlainDate().toString() > rule.lastOccurrenceDate
      )
        return false;
      if (rule.recurrenceUntil && start >= rule.recurrenceUntil) return false;
      return start < to && end > from;
    })
    .map(({ start, end }) => ({ start, end }));
};

/** Unions touching/overlapping occurrences belonging to one assignment. */
export const coalesceWindows = (
  windows: OccurrenceWindow[],
): OccurrenceWindow[] => {
  const sorted = [...windows].sort(
    (left, right) => left.start.getTime() - right.start.getTime(),
  );
  const result: OccurrenceWindow[] = [];
  for (const window of sorted) {
    const previous = result.at(-1);
    if (previous && window.start <= previous.end) {
      if (window.end > previous.end) previous.end = window.end;
    } else result.push({ ...window });
  }
  return result;
};
