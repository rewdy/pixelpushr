export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "session_required"
  | "session_ended"
  | "membership_required"
  | "owner_required"
  | "auth_unavailable"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: { path: string; message: string }[];
  };
};
