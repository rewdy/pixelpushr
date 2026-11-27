export const webOrigin = "http://127.0.0.1:5173";

/** Extracts the cookie pair from a successful login response for API tests. */
export const loginCookie = (response: Response) => {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie)
    throw new Error(`Login did not return a cookie (HTTP ${response.status})`);
  return cookie;
};

/** Models the trusted browser origin for direct in-process HTTP requests. */
export const browserRequest =
  (app: {
    request: (path: string, init?: RequestInit) => Response | Promise<Response>;
  }) =>
  (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("origin")) headers.set("origin", webOrigin);
    return app.request(path, { ...init, headers });
  };
