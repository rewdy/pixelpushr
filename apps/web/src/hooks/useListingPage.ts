import { useCallback } from "react";
import { useSearchParams } from "wouter";

/** Keeps a top-level listing page in the current URL. */
export const useListingPage = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get("page");
  const parsed = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
  const page = Number.isSafeInteger(parsed) && parsed <= 1_000_000 ? parsed : 1;
  const setPage = useCallback(
    (nextPage: number) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (nextPage <= 1) next.delete("page");
        else next.set("page", String(nextPage));
        return next;
      });
    },
    [setParams],
  );
  return { page, setPage, params, setParams };
};
