import {
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";

export type RecurrenceDraft = {
  recurrence: "none" | "daily" | "weekly" | "monthly";
  repeatInterval: number | string;
  weekdays: string[];
  monthlyPattern: "date" | "weekday";
  monthDay: number | string;
  monthOrdinal: string;
  monthWeekday: string;
  lastOccurrenceDate: string;
};

export const emptyRecurrence = (): RecurrenceDraft => ({
  recurrence: "none",
  repeatInterval: 1,
  weekdays: [],
  monthlyPattern: "date",
  monthDay: 1,
  monthOrdinal: "1",
  monthWeekday: "1",
  lastOccurrenceDate: "",
});

const weekdayOptions = [
  { value: "7", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export const recurrencePayload = (
  draft: RecurrenceDraft,
  startLocal: string,
) => {
  if (draft.recurrence === "none") return { recurrence: "none" as const };
  const interval = Number(draft.repeatInterval);
  const max =
    draft.recurrence === "daily"
      ? 365
      : draft.recurrence === "weekly"
        ? 52
        : 12;
  if (!Number.isInteger(interval) || interval < 1 || interval > max)
    throw new Error(`Repeat every must be between 1 and ${max}.`);
  if (
    draft.lastOccurrenceDate &&
    draft.lastOccurrenceDate < startLocal.slice(0, 10)
  )
    throw new Error("Last occurrence date must not precede the first start.");
  if (draft.recurrence === "weekly" && draft.weekdays.length === 0)
    throw new Error("Select at least one weekday.");
  if (
    draft.recurrence === "monthly" &&
    draft.monthlyPattern === "date" &&
    (!Number.isInteger(Number(draft.monthDay)) ||
      Number(draft.monthDay) < 1 ||
      Number(draft.monthDay) > 31)
  )
    throw new Error("Choose a day between 1 and 31.");
  return {
    recurrence: draft.recurrence,
    repeatInterval: interval,
    ...(draft.recurrence === "weekly"
      ? { weekdays: draft.weekdays.map(Number) }
      : {}),
    ...(draft.recurrence === "monthly"
      ? draft.monthlyPattern === "date"
        ? { monthDay: Number(draft.monthDay) }
        : {
            monthOrdinal: Number(draft.monthOrdinal),
            monthWeekday: Number(draft.monthWeekday),
          }
      : {}),
    ...(draft.lastOccurrenceDate
      ? { lastOccurrenceDate: draft.lastOccurrenceDate }
      : {}),
  };
};

type Props = {
  value: RecurrenceDraft;
  onChange: (value: RecurrenceDraft) => void;
  firstDate?: string;
  disabled?: boolean;
};

/** Shared supported recurrence subset for Append and Override create/edit. */
export const RecurrenceFields = ({
  value,
  onChange,
  firstDate,
  disabled = false,
}: Props) => {
  const update = (patch: Partial<RecurrenceDraft>) =>
    onChange({ ...value, ...patch });
  return (
    <Stack gap="sm">
      <Group grow align="start">
        <Select
          label="Repeat"
          disabled={disabled}
          value={value.recurrence}
          data={[
            { value: "none", label: "One-time window" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
          onChange={(next) =>
            update({
              recurrence: (next ?? "none") as RecurrenceDraft["recurrence"],
            })
          }
        />
        {value.recurrence !== "none" && !disabled && (
          <NumberInput
            label={`Repeat every (${value.recurrence === "daily" ? "days" : value.recurrence === "weekly" ? "weeks" : "months"})`}
            min={1}
            max={
              value.recurrence === "daily"
                ? 365
                : value.recurrence === "weekly"
                  ? 52
                  : 12
            }
            value={value.repeatInterval}
            onChange={(repeatInterval) => update({ repeatInterval })}
          />
        )}
      </Group>
      {value.recurrence !== "none" && !disabled && (
        <>
          {value.recurrence === "weekly" && (
            <MultiSelect
              label="Weekdays"
              data={weekdayOptions}
              value={value.weekdays}
              onChange={(weekdays) => update({ weekdays })}
              required
            />
          )}
          {value.recurrence === "monthly" && (
            <>
              <Radio.Group
                label="Monthly pattern"
                value={value.monthlyPattern}
                onChange={(monthlyPattern) =>
                  update({
                    monthlyPattern:
                      monthlyPattern as RecurrenceDraft["monthlyPattern"],
                  })
                }
              >
                <Group mt="xs">
                  <Radio value="date" label="Day of month" />
                  <Radio value="weekday" label="Ordinal weekday" />
                </Group>
              </Radio.Group>
              {value.monthlyPattern === "date" ? (
                <>
                  <NumberInput
                    label="Day of month"
                    min={1}
                    max={31}
                    value={value.monthDay}
                    onChange={(monthDay) => update({ monthDay })}
                  />
                  <Text size="xs" c="dimmed">
                    Months without this date are skipped (for example, the
                    31st).
                  </Text>
                </>
              ) : (
                <Group grow align="start">
                  <Select
                    label="Which"
                    value={value.monthOrdinal}
                    onChange={(monthOrdinal) =>
                      update({ monthOrdinal: monthOrdinal ?? "1" })
                    }
                    data={[
                      { value: "1", label: "First" },
                      { value: "2", label: "Second" },
                      { value: "3", label: "Third" },
                      { value: "4", label: "Fourth" },
                      { value: "5", label: "Fifth" },
                      { value: "-1", label: "Last" },
                    ]}
                  />
                  <Select
                    label="Weekday"
                    value={value.monthWeekday}
                    onChange={(monthWeekday) =>
                      update({ monthWeekday: monthWeekday ?? "1" })
                    }
                    data={weekdayOptions}
                  />
                </Group>
              )}
            </>
          )}
          <Checkbox
            label="Set last occurrence date"
            checked={!!value.lastOccurrenceDate}
            onChange={(event) =>
              update({
                lastOccurrenceDate: event.currentTarget.checked
                  ? (firstDate?.slice(0, 10) ??
                    new Date().toISOString().slice(0, 10))
                  : "",
              })
            }
          />
          {value.lastOccurrenceDate && (
            <DatePickerInput
              label="Last occurrence date"
              placeholder="Choose a date"
              value={value.lastOccurrenceDate || null}
              onChange={(event) => update({ lastOccurrenceDate: event ?? "" })}
            />
          )}
          <Text size="xs" c="dimmed">
            The final date includes any occurrence starting that day.
          </Text>
        </>
      )}
    </Stack>
  );
};
