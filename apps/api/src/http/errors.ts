import type {
  ApiErrorCode,
  ApiErrorResponse,
} from "@pixelpushr/contracts/errors";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorResponse["error"]["details"];

  constructor(
    status: ContentfulStatusCode,
    code: ApiErrorCode,
    message: string,
    details?: ApiErrorResponse["error"]["details"],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Maps known application failures into a stable client-readable envelope. */
export const handleError = (error: Error, context: Context) => {
  if (error instanceof ApiError) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    return context.json(body, error.status);
  }
  if (error instanceof HTTPException) {
    const body: ApiErrorResponse = {
      error: {
        code: error.status === 404 ? "not_found" : "invalid_request",
        message: error.message,
      },
    };
    return context.json(body, error.status);
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failure",
      errorType: error.name,
    }),
  );
  const body: ApiErrorResponse = {
    error: { code: "internal_error", message: "An unexpected error occurred" },
  };
  return context.json(body, 500);
};
