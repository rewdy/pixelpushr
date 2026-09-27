import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { ApiError } from "../http/errors";

export const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/);

export const recurrenceFields = {
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  repeatInterval: z.number().int().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
  monthOrdinal: z
    .number()
    .int()
    .refine((value) => value === -1 || (value >= 1 && value <= 5))
    .optional(),
  monthWeekday: z.number().int().min(1).max(7).optional(),
  lastOccurrenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  weekInterval: z.number().int().min(1).max(52).optional(),
};

type RecurrenceInput = z.infer<z.ZodObject<typeof recurrenceFields>>;

/** Validates one typed recurrence rule and returns database-ready fields. */
export const validateRecurrence = (
  input: RecurrenceInput,
  startAt: Date,
  endAt: Date,
  timezone: string,
) => {
  const invalid = (message: string): never => {
    throw new ApiError(400, "invalid_request", message);
  };
  if (endAt <= startAt) invalid("Schedule end must be after start");
  const firstLocal = Temporal.Instant.from(startAt.toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime();
  const endLocal = Temporal.Instant.from(endAt.toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime();
  const localSpanDays =
    (Date.UTC(
      endLocal.year,
      endLocal.month - 1,
      endLocal.day,
      endLocal.hour,
      endLocal.minute,
    ) -
      Date.UTC(
        firstLocal.year,
        firstLocal.month - 1,
        firstLocal.day,
        firstLocal.hour,
        firstLocal.minute,
      )) /
    86_400_000;
  if (input.recurrence !== "none" && localSpanDays > 400)
    invalid("Schedule window is too long");
  let lastOccurrenceDate: string | null = null;
  if (input.lastOccurrenceDate) {
    try {
      lastOccurrenceDate = Temporal.PlainDate.from(
        input.lastOccurrenceDate,
      ).toString();
    } catch {
      invalid("Invalid last occurrence date");
    }
    if (
      lastOccurrenceDate !== null &&
      lastOccurrenceDate < firstLocal.toPlainDate().toString()
    )
      invalid("Last occurrence date must not precede the first start");
  }
  const extra = {
    monthDay: input.monthDay,
    monthOrdinal: input.monthOrdinal,
    monthWeekday: input.monthWeekday,
    weekdays: input.weekdays,
  };
  if (input.recurrence === "none") {
    if (
      input.repeatInterval !== undefined ||
      input.weekInterval !== undefined ||
      Object.values(extra).some((value) => value !== undefined) ||
      lastOccurrenceDate
    )
      invalid("One-time schedules cannot have repetition settings");
    return {
      recurrence: "none" as const,
      repeatInterval: null,
      weekdays: null,
      monthDay: null,
      monthOrdinal: null,
      monthWeekday: null,
      lastOccurrenceDate: null,
    };
  }
  const interval = input.repeatInterval ?? input.weekInterval ?? 1;
  const max =
    input.recurrence === "daily"
      ? 365
      : input.recurrence === "weekly"
        ? 52
        : 12;
  if (interval < 1 || interval > max)
    invalid(`Repeat interval must be between 1 and ${max}`);
  if (input.weekInterval !== undefined && input.recurrence !== "weekly")
    invalid("Week interval applies only to weekly schedules");
  if (
    input.weekInterval !== undefined &&
    input.repeatInterval !== undefined &&
    input.weekInterval !== input.repeatInterval
  )
    invalid("Conflicting weekly intervals");
  if (input.recurrence === "daily") {
    if (Object.values(extra).some((value) => value !== undefined))
      invalid("Daily schedules cannot have weekday or monthly selections");
  }
  if (input.recurrence === "weekly") {
    if (
      input.monthDay !== undefined ||
      input.monthOrdinal !== undefined ||
      input.monthWeekday !== undefined
    )
      invalid("Weekly schedules cannot have monthly selections");
    if (
      input.weekdays?.length === 0 ||
      (input.weekdays && new Set(input.weekdays).size !== input.weekdays.length)
    )
      invalid("Select one or more distinct weekdays");
    if (localSpanDays > interval * 7 + 1 / 24)
      invalid("Weekly window cannot exceed its repeat interval");
  }
  if (input.recurrence === "monthly") {
    if (input.weekdays !== undefined)
      invalid("Monthly schedules cannot have weekly weekdays");
    if (
      input.monthDay === undefined &&
      (input.monthOrdinal === undefined || input.monthWeekday === undefined)
    )
      invalid("Choose a monthly day or ordinal weekday");
    if (
      input.monthDay !== undefined &&
      (input.monthOrdinal !== undefined || input.monthWeekday !== undefined)
    )
      invalid("Choose only one monthly pattern");
  }
  return {
    recurrence: input.recurrence,
    repeatInterval: interval,
    weekdays:
      input.recurrence === "weekly"
        ? (input.weekdays ?? [firstLocal.dayOfWeek])
        : null,
    monthDay: input.recurrence === "monthly" ? (input.monthDay ?? null) : null,
    monthOrdinal:
      input.recurrence === "monthly" ? (input.monthOrdinal ?? null) : null,
    monthWeekday:
      input.recurrence === "monthly" ? (input.monthWeekday ?? null) : null,
    lastOccurrenceDate,
  };
};
