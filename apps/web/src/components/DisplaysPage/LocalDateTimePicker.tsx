import { DateTimePicker } from "@mantine/dates";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

/** Mantine uses floating date strings; API forms use the same local time with a T separator. */
export const LocalDateTimePicker = ({
  label,
  value,
  onChange,
  required,
}: Props) => (
  <DateTimePicker
    label={label}
    placeholder="Choose date and time"
    value={value ? value.replace("T", " ") : null}
    onChange={(next) =>
      onChange(next ? next.replace(" ", "T").slice(0, 16) : "")
    }
    valueFormat="MMM D, YYYY h:mm A"
    timePickerProps={{
      withDropdown: true,
      format: "12h",
      hoursInputLabel: "Hours",
      minutesInputLabel: "Minutes",
      amPmInputLabel: "AM/PM",
    }}
    required={required}
  />
);
