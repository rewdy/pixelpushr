export type ApiErrorCode = "invalid_request" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "internal_error";

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: { path: string; message: string }[];
  };
};
