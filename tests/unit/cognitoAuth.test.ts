import { expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  CognitoIdentityProviderClient,
  GetTokensFromRefreshTokenCommand,
  RevokeTokenCommand,
} from "../../apps/api/node_modules/@aws-sdk/client-cognito-identity-provider";
import { createCognitoAuth } from "../../apps/api/src/auth/cognitoAuth";

test("Cognito rotates and revokes credentials and distinguishes rejection from an outage", async () => {
  const client = new CognitoIdentityProviderClient({});
  const commands: unknown[] = [];
  let failure: Error | undefined;
  client.send = (async (command: unknown) => {
    commands.push(command);
    if (failure) throw failure;
    return {
      AuthenticationResult: {
        AccessToken: "new-access",
        RefreshToken: "new-refresh",
        ExpiresIn: 900,
      },
    };
  }) as typeof client.send;
  const auth = createCognitoAuth("us-east-1", "pool", "app", client);
  expect(await auth.renew?.("original")).toEqual({
    accessToken: "new-access",
    refreshToken: "new-refresh",
    expiresIn: 900,
  });
  expect(commands[0]).toBeInstanceOf(GetTokensFromRefreshTokenCommand);
  expect((commands[0] as GetTokensFromRefreshTokenCommand).input).toEqual({
    ClientId: "app",
    RefreshToken: "original",
  });
  await auth.revoke?.("new-refresh");
  expect(commands[1]).toBeInstanceOf(RevokeTokenCommand);
  failure = Object.assign(new Error("secret provider detail"), {
    name: "NotAuthorizedException",
  });
  await expect(auth.renew?.("original")).rejects.toMatchObject({
    code: "session_ended",
  });
  failure = new Error("secret provider detail");
  await expect(auth.renew?.("original")).rejects.toMatchObject({
    code: "auth_unavailable",
  });
});

test("Cognito validates required access token claims", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = { ...(await exportJWK(publicKey)), kid: "test" };
  const fetchKeys = (() =>
    Promise.resolve(Response.json({ keys: [key] }))) as typeof fetch;
  const auth = createCognitoAuth(
    "us-east-1",
    "pool",
    "app",
    undefined,
    fetchKeys,
  );
  const token = (claims: Record<string, unknown>, expires = "5m") =>
    new SignJWT({ client_id: "app", token_use: "access", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://cognito-idp.us-east-1.amazonaws.com/pool")
      .setSubject("subject")
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey);
  expect(await auth.verify(await token({}))).toEqual({
    subject: "subject",
    email: "",
  });
  for (const claims of [
    { client_id: "other" },
    { token_use: "id" },
    { exp: 0 },
  ]) {
    const jwt = await token(claims, claims.exp === 0 ? "0s" : "5m");
    await expect(auth.verify(jwt)).rejects.toMatchObject({
      code: "session_ended",
    });
  }
});
