import type { Context } from "hono";
import type { z } from "zod";
import { ApiError } from "./errors";

/** Parses a JSON request body and reports field-level validation failures. */
export const parseJsonBody = async <T extends z.ZodType>(
  context: Context,
  schema: T,
): Promise<z.infer<T>> => {
  let payload: unknown;
  try {
    payload = await context.req.json();
  } catch {
    throw new ApiError(400, "invalid_request", "Expected a valid JSON body");
  }
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(
      400,
      "invalid_request",
      "Request validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
};
