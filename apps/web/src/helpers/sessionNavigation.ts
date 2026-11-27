const inviteDestination = "pixelpushr-invite-continuation";
const adminPath =
  /^\/(?:media|people|settings|(?:playlists|displays)(?:\/[\w-]+)?|setup)?$/;
const invitePath = /^\/invite\/[\w-]{20,}$/;

/** Restricts the post-login path to known same-origin application routes. */
export const returnDestination = (target: string | null) => {
  if (
    !target?.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("\\") ||
    /\s/.test(target)
  )
    return "/";
  const parsed = new URL(target, window.location.origin);
  if (parsed.origin !== window.location.origin) return "/";
  return adminPath.test(parsed.pathname)
    ? parsed.pathname + parsed.search
    : "/";
};

/** Keeps the invitation credential in the current tab during authentication. */
export const rememberInvite = (path: string) => {
  if (invitePath.test(path)) sessionStorage.setItem(inviteDestination, path);
};

/** Reads the authentication continuation for the current tab. */
export const authContinuation = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") === "invite"
    ? "invite"
    : returnDestination(params.get("next"));
};

/** Consumes the validated continuation after a successful sign-in. */
export const afterSignIn = (next: string) => {
  if (next !== "invite") {
    sessionStorage.removeItem(inviteDestination);
    return returnDestination(next);
  }
  const path = sessionStorage.getItem(inviteDestination) ?? "";
  sessionStorage.removeItem(inviteDestination);
  return invitePath.test(path) ? path : "/";
};

/** Builds a sign-in destination without exposing invitation credentials. */
export const loginDestination = (target: string, ended = false) => {
  if (invitePath.test(target)) rememberInvite(target);
  const next = invitePath.test(target) ? "invite" : returnDestination(target);
  return `/login?next=${encodeURIComponent(next)}${ended ? "&reason=session-ended" : ""}`;
};
