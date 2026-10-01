import type { PageParams } from "@pixelpushr/contracts/pagination";
import { ApiError } from "./errors";

const positiveInteger = (
  value: string | undefined,
  fallback: number,
  max: number,
) => {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value))
    throw new ApiError(400, "invalid_request", "Invalid pagination parameters");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max)
    throw new ApiError(400, "invalid_request", "Invalid pagination parameters");
  return parsed;
};

/** Parses opt-in paging while keeping legacy unpaged requests intact. */
export const parsePagination = (
  query: (key: string) => string | undefined,
): PageParams | null => {
  const rawPage = query("page");
  const rawSize = query("pageSize");
  if (rawPage === undefined && rawSize === undefined) return null;
  return {
    page: positiveInteger(rawPage, 1, 1_000_000),
    pageSize: positiveInteger(rawSize, 25, 100),
  };
};
