export type TimezoneOption = { value: string; label: string };

const fallbackZones = [
  "UTC",
  "America/Chicago",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Australia/Adelaide",
  "Asia/Tokyo",
];

/** Checks that a stored or browser-provided zone is accepted by Intl. */
export const isValidTimezone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/** Formats the offset at one instant; future DST offsets may differ. */
export const currentUtcOffset = (zone: string, at: Date): string => {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((value) => value.type === "timeZoneName")?.value;
  if (!part || part === "GMT") return "UTC+00:00";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(part);
  if (!match) throw new Error(`Cannot read current UTC offset for ${zone}`);
  return `UTC${match[1]}${(match[2] ?? "0").padStart(2, "0")}:${match[3] ?? "00"}`;
};

/** Builds searchable zone labels, retaining valid aliases already saved. */
export const getTimezoneOptions = (
  currentValue: string,
  at: Date,
  supportedZones: string[] = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : fallbackZones,
): TimezoneOption[] => {
  const zones = new Set(["UTC", ...supportedZones, currentValue]);
  return [...zones]
    .filter(isValidTimezone)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: `${value} · ${currentUtcOffset(value, at)}`,
    }));
};
