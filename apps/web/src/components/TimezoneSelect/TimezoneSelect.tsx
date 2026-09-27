import { Autocomplete } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTimezoneOptions } from "../../helpers/timezoneOptions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

/** Selects an IANA zone while showing its current, date-sensitive UTC offset. */
export const TimezoneSelect = ({
  value,
  onChange,
  disabled,
  required,
}: Props) => {
  const [at, setAt] = useState(() => new Date());
  const initialValue = useRef(value);
  const options = useMemo(
    () => getTimezoneOptions(value || initialValue.current, at),
    [value, at],
  );
  const label = options.find((option) => option.value === value)?.label ?? "";
  const [inputValue, setInputValue] = useState(label);
  const previousLabel = useRef(label);

  useEffect(() => {
    const timer = window.setInterval(() => setAt(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setInputValue((current) =>
      current === previousLabel.current ? label : current,
    );
    previousLabel.current = label;
  }, [label]);

  return (
    <Autocomplete
      label="Timezone"
      description="Current UTC offset; daylight saving time can change it for future dates."
      placeholder="Search city, IANA zone, or UTC offset"
      data={options}
      value={inputValue}
      onChange={(text) => {
        const match = options.find(
          (option) => option.label === text || option.value === text,
        );
        setInputValue(match?.label ?? text);
        onChange(match?.value ?? "");
      }}
      limit={30}
      maxDropdownHeight={260}
      clearable={!disabled}
      disabled={disabled}
      required={required}
    />
  );
};
