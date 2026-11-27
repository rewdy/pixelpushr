import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { type APIGatewayProxyEventV2, handle } from "hono/aws-lambda";
import postgres from "postgres";
import { createApp } from "../../apps/api/src/app";
import type { AuthProvider } from "../../apps/api/src/auth/provider";
import { sessionLifetimeSeconds } from "../../apps/api/src/auth/sessionStorage";
import { createSessions } from "../../apps/api/src/auth/sessions";
import { createDatabase } from "../../apps/api/src/db/client";
import { memberships, users } from "../../apps/api/src/db/schema";
import { ApiError } from "../../apps/api/src/http/errors";
import { testDatabaseAdminUrl } from "../config";
import { loginCookie } from "../fixtures/authRequests";

const admin = postgres(testDatabaseAdminUrl);
const database = `pixelpushr_test_${crypto.randomUUID().replaceAll("-", "")}`;
const key = "aa".repeat(32);
const baseline = Date.UTC(2026, 0, 1);
const subject = "provider-owner";
const email = "owner@example.test";
const origin = "https://signage.example.test";
let connection: ReturnType<typeof createDatabase>;

const mockProvider = (): AuthProvider => ({
  signUp: async () => ({ subject, confirmationRequired: false }),
  confirm: async () => undefined,
  signIn: async (address) => ({
    accessToken: address,
    refreshToken: "original",
    expiresIn: 900,
  }),
  verify: async (token) => ({
    subject: token === email ? subject : token,
    email: token,
  }),
  renew: async () => ({
    accessToken: email,
    refreshToken: "rotated",
    expiresIn: 900,
  }),
});

beforeAll(async () => {
  await admin`CREATE DATABASE ${admin(database)}`;
  const url = new URL(testDatabaseAdminUrl);
  url.pathname = database;
  connection = createDatabase(url.toString());
  await migrate(connection.db, {
    migrationsFolder: new URL("../../apps/api/drizzle", import.meta.url)
      .pathname,
  });
  await connection.db.insert(users).values({ subject, email });
});

afterAll(async () => {
  if (connection) await connection.close();
  await admin`DROP DATABASE IF EXISTS ${admin(database)} WITH (FORCE)`;
  await admin.end();
});

test("transient renewal failure preserves the session, concurrent renewal rotates once, and the original deadline holds", async () => {
  let now = baseline;
  const auth = mockProvider();
  const attempts: string[] = [];
  auth.renew = async (refreshToken) => {
    attempts.push(refreshToken);
    if (attempts.length === 1)
      throw new ApiError(503, "auth_unavailable", "Try again");
    await Bun.sleep(15);
    return { accessToken: email, refreshToken: "rotated", expiresIn: 900 };
  };
  const sessions = createSessions(connection.db, auth, key, () => now);
  const credential = await sessions.login(email, "password");
  now += sessionLifetimeSeconds * 1000 - 1000;
  await expect(sessions.resolve(credential)).rejects.toMatchObject({
    code: "auth_unavailable",
  });
  const renewed = await Promise.all([
    sessions.resolve(credential),
    sessions.resolve(credential),
    sessions.resolve(credential),
  ]);
  expect(renewed.map((result) => result.user.subject)).toEqual([
    subject,
    subject,
    subject,
  ]);
  expect(attempts).toEqual(["original", "original"]);
  now += 1000;
  await expect(sessions.resolve(credential)).rejects.toMatchObject({
    code: "session_ended",
  });
});

test("logout during renewal removes the session and revokes the rotated credential", async () => {
  let now = baseline;
  const auth = mockProvider();
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let revoked: string | undefined;
  auth.renew = async () => {
    started.resolve();
    await finish.promise;
    return { accessToken: email, refreshToken: "rotated", expiresIn: 900 };
  };
  auth.revoke = async (token) => {
    revoked = token;
  };
  const sessions = createSessions(connection.db, auth, key, () => now);
  const credential = await sessions.login(email, "password");
  now += 900_000;
  const refreshing = sessions.resolve(credential);
  await started.promise;
  const logout = sessions.logout(credential);
  finish.resolve();
  await Promise.allSettled([refreshing]);
  await logout;
  expect(revoked).toBe("rotated");
  await expect(sessions.resolve(credential)).rejects.toMatchObject({
    code: "session_ended",
  });
});

test("definitive refresh rejection deletes the application session", async () => {
  let now = baseline;
  const auth = mockProvider();
  let attempts = 0;
  auth.renew = async () => {
    attempts++;
    throw new ApiError(401, "session_ended", "Sign in again");
  };
  const sessions = createSessions(connection.db, auth, key, () => now);
  const credential = await sessions.login(email, "password");
  now += 900_000;
  await expect(sessions.resolve(credential)).rejects.toMatchObject({
    code: "session_ended",
  });
  await expect(sessions.resolve(credential)).rejects.toMatchObject({
    code: "session_ended",
  });
  expect(attempts).toBe(1);
});

test("cookie API enforces origin, role and current verified email", async () => {
  const auth = mockProvider();
  let currentEmail = email;
  auth.verify = async (token, options) => ({
    subject: token === email ? subject : token,
    email:
      options?.requireVerifiedEmail && token !== email ? currentEmail : token,
  });
  const { db } = connection;
  const memberEmail = "member@example.test";
  await db.insert(users).values({ subject: memberEmail, email: memberEmail });
  const app = createApp({
    db,
    auth,
    sessionEncryptionKey: key,
    mailer: { send: async () => undefined },
    publicWebUrl: origin,
    initialOwnerEmail: email,
  });
  const post = (
    path: string,
    body: unknown,
    cookie = "",
    requestOrigin = origin,
  ) =>
    app.request(path, {
      method: "POST",
      headers: {
        origin: requestOrigin,
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const login = (email: string, requestOrigin?: string) =>
    post(
      "/auth/login",
      { email, password: "super-long-password" },
      "",
      requestOrigin,
    );
  const blocked = await login(email, "https://other.example.test");
  expect(blocked.status).toBe(403);
  expect(blocked.headers.get("set-cookie")).toBeNull();
  const response = await login(email);
  const cookie = loginCookie(response);
  expect(response.headers.get("set-cookie")).toMatch(
    /Max-Age=604800.*Path=\/.*HttpOnly.*Secure.*SameSite=Lax/,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ signedIn: true });
  expect(
    (await post("/setup", { name: "Workspace", timezone: "UTC" }, cookie))
      .status,
  ).toBe(201);
  expect(
    (
      await post(
        "/admin/invitations",
        { email: memberEmail },
        cookie,
        "https://other.example.test",
      )
    ).status,
  ).toBe(403);
  const memberCookie = loginCookie(await login(memberEmail));
  const me = () =>
    app.request("/admin/me", { headers: { cookie: memberCookie } });
  expect(await (await me()).json()).toMatchObject({
    error: { code: "membership_required" },
  });
  const invitation = await post(
    "/admin/invitations",
    { email: memberEmail },
    cookie,
  );
  expect(invitation.status).toBe(201);
  const { url } = (await invitation.json()) as { url: string };
  const token = new URL(url).pathname.split("/").at(-1);
  const accept = () => post("/invitations/accept", { token }, memberCookie);
  for (const verified of ["", "former@example.test"]) {
    currentEmail = verified;
    expect((await accept()).status).toBe(403);
  }
  currentEmail = memberEmail;
  const redemption = await Promise.all([accept(), accept()]);
  expect(redemption.map((result) => result.status).sort()).toEqual([200, 409]);
  expect((await me()).status).toBe(200);
  const denial = await post(
    "/admin/invitations",
    { email: "another@example.test" },
    memberCookie,
  );
  expect(await denial.json()).toMatchObject({
    error: { code: "owner_required" },
  });
  const member = await db.query.users.findFirst({
    where: eq(users.subject, memberEmail),
  });
  if (!member) throw new Error("Missing test account");
  await db.delete(memberships).where(eq(memberships.userId, member.id));
  expect((await me()).status).toBe(403);
  const logout = await post("/auth/logout", {}, memberCookie);
  expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  expect((await me()).status).toBe(401);
});

test("API Gateway v2 carries the login cookie into a protected request", async () => {
  const auth = mockProvider();
  const signIn = auth.signIn;
  auth.signIn = async (email, password) => ({
    ...(await signIn(email, password)),
    expiresIn: 1,
  });
  let renewals = 0;
  auth.renew = async () => {
    renewals++;
    return { accessToken: email, refreshToken: "rotated", expiresIn: 900 };
  };
  const handler = handle(
    createApp({
      db: connection.db,
      auth,
      mailer: { send: async () => undefined },
      publicWebUrl: origin,
      sessionEncryptionKey: key,
    }),
  );
  const request = (
    method: string,
    path: string,
    body: string | null,
    cookies?: string[],
  ) => {
    const http = {
      method,
      path,
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "test",
    };
    return handler({
      version: "2.0",
      routeKey: "$default",
      rawPath: path,
      rawQueryString: "",
      isBase64Encoded: false,
      headers: { origin, "content-type": "application/json" },
      cookies,
      body,
      requestContext: {
        http,
        accountId: "test",
        authentication: null,
        authorizer: {},
        apiId: "test",
        domainName: "api.example.test",
        domainPrefix: "api",
        requestId: "test",
        routeKey: "$default",
        stage: "$default",
        time: "",
        timeEpoch: 0,
      },
    } satisfies APIGatewayProxyEventV2);
  };
  const login = await request(
    "POST",
    "/auth/login",
    JSON.stringify({ email, password: "super-long-password" }),
  );
  expect(login.statusCode).toBe(200);
  expect(login.headers["cache-control"]).toBe("no-store");
  const cookie = login.cookies?.[0]?.split(";")[0];
  if (!cookie)
    throw new Error("API Gateway response omitted the session cookie");
  const session = await request("GET", "/auth/session", null, [cookie]);
  expect(session.statusCode).toBe(200);
  expect(JSON.parse(session.body)).toEqual({ signedIn: true });
  expect(
    (await request("GET", "/auth/session", null, [cookie])).statusCode,
  ).toBe(200);
  expect(renewals).toBe(1);
});
