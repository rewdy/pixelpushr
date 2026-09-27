import { expect, test } from "bun:test";
import {
  currentUtcOffset,
  getTimezoneOptions,
  isValidTimezone,
} from "../../apps/web/src/helpers/timezoneOptions";

test("current offsets include UTC, DST changes, and fractional hours", () => {
  expect(currentUtcOffset("UTC", new Date("2026-01-15T12:00:00Z"))).toBe(
    "UTC+00:00",
  );
  expect(
    currentUtcOffset("America/Chicago", new Date("2026-01-15T12:00:00Z")),
  ).toBe("UTC-06:00");
  expect(
    currentUtcOffset("America/Chicago", new Date("2026-07-15T12:00:00Z")),
  ).toBe("UTC-05:00");
  expect(
    currentUtcOffset("Asia/Kathmandu", new Date("2026-01-15T12:00:00Z")),
  ).toBe("UTC+05:45");
});

test("options retain a valid saved alias and sort by identifier", () => {
  const options = getTimezoneOptions(
    "US/Eastern",
    new Date("2026-01-15T12:00:00Z"),
    ["America/New_York", "Asia/Kathmandu"],
  );
  expect(options.map((option) => option.value)).toEqual([
    "America/New_York",
    "Asia/Kathmandu",
    "US/Eastern",
    "UTC",
  ]);
  expect(options.find((option) => option.value === "US/Eastern")?.label).toBe(
    "US/Eastern · UTC-05:00",
  );
  expect(getTimezoneOptions("UTC", new Date(), [])).toEqual([
    { value: "UTC", label: "UTC · UTC+00:00" },
  ]);
  expect(isValidTimezone("Not/AZone")).toBe(false);
});
