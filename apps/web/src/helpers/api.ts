import type { ApiErrorResponse } from "@pixelpushr/contracts/errors";

const tokenKey = "pixelpushr-admin-session";

/** Reads the tab-scoped administrator access token. */
export const getToken = () => sessionStorage.getItem(tokenKey);

/** Saves or clears the tab-scoped administrator access token. */
export const setToken = (token: string | null) => {
  if (token) sessionStorage.setItem(tokenKey, token);
  else sessionStorage.removeItem(tokenKey);
};

/** Sends a JSON request to the API and presents its stable error message. */
export const requestJson = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      data?.error.message ?? `Request failed (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
};
