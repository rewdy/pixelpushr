export type Assignment = {
  id: string;
  playlistId: string;
  playlistName: string;
  mode: "always" | "scheduled" | "override";
  position: number;
  priority: number;
  version: string | null;
  schedule: {
    recurrence: "none" | "daily" | "weekly" | "monthly";
    startAt: string;
    endAt: string;
    timezone: string;
    repeatInterval: number | null;
    weekdays: number[] | null;
    monthDay: number | null;
    monthOrdinal: number | null;
    monthWeekday: number | null;
    lastOccurrenceDate: string | null;
  } | null;
};

export type Display = {
  id: string;
  name: string;
  playerUrl: string;
  lastSeenAt: string | null;
  lastHealth: string | null;
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ordinals: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
  [-1]: "last",
};

/** Human-readable persisted rule, never used to calculate player activity. */
export const recurrenceSummary = (
  schedule: NonNullable<Assignment["schedule"]>,
) => {
  if (schedule.recurrence === "none") return "One-time";
  const every = schedule.repeatInterval ?? 1;
  const unit =
    schedule.recurrence === "daily"
      ? "day"
      : schedule.recurrence === "weekly"
        ? "week"
        : "month";
  const prefix = every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`;
  const detail =
    schedule.recurrence === "weekly"
      ? ` on ${(schedule.weekdays ?? []).map((day) => days[day - 1]).join(", ")}`
      : schedule.recurrence === "monthly"
        ? schedule.monthDay !== null
          ? ` on day ${schedule.monthDay} (missing dates skipped)`
          : ` on the ${ordinals[schedule.monthOrdinal ?? 1]} ${days[(schedule.monthWeekday ?? 1) - 1]}`
        : "";
  return `${prefix}${detail}${schedule.lastOccurrenceDate ? ` · Last start ${schedule.lastOccurrenceDate}` : ""}`;
};
