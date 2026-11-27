import type {
  ApiErrorCode,
  ApiErrorResponse,
} from "@pixelpushr/contracts/errors";

const legacyTokenKey = "pixelpushr-admin-session";
export const sessionEndedEvent = "pixelpushr-session-ended";
let sessionGeneration = 0;
let sessionSeen = false;

/** Preserves the API error code and HTTP status for the calling screen. */
export class RequestError extends Error {
  readonly status: number;
  readonly code?: ApiErrorCode;

  constructor(message: string, status: number, code?: ApiErrorCode) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Invalidates requests made under the previous account or session. */
export const resetSessionState = () => {
  sessionGeneration++;
  sessionSeen = false;
  sessionStorage.removeItem(legacyTokenKey);
};

/** Sends a same-origin API request and detects the loss of an established session. */
export const requestJson = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const protectedRequest =
    path.startsWith("/admin/") ||
    path === "/auth/session" ||
    path === "/setup" ||
    path === "/invitations/accept";
  const generation = sessionGeneration;
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
    signal: options.signal,
  });
  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null;
    const code = data?.error?.code;
    if (
      generation === sessionGeneration &&
      protectedRequest &&
      response.status === 401
    ) {
      const wasSignedIn =
        sessionSeen || sessionStorage.getItem(legacyTokenKey) !== null;
      if (
        code === "session_ended" ||
        (code === "session_required" && wasSignedIn)
      ) {
        resetSessionState();
        window.dispatchEvent(new Event(sessionEndedEvent));
      }
    }
    throw new RequestError(
      data?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      code,
    );
  }
  const body = (await response.json()) as T;
  if (protectedRequest) {
    if (generation !== sessionGeneration)
      throw new DOMException("Session changed", "AbortError");
    sessionSeen = true;
  }
  return body;
};
