import {
  type AuthenticationResultType,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  GetTokensFromRefreshTokenCommand,
  GetUserCommand,
  InitiateAuthCommand,
  RevokeTokenCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createRemoteJWKSet, customFetch, errors, jwtVerify } from "jose";
import { ApiError } from "../http/errors";
import type { AuthProvider } from "./provider";

const unavailable = () =>
  new ApiError(
    503,
    "auth_unavailable",
    "Sign-in service is temporarily unavailable. Try again.",
  );

const ended = () =>
  new ApiError(
    401,
    "session_ended",
    "Your session ended. Sign in again to continue.",
  );

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : "";

const sessionFrom = (result: AuthenticationResultType | undefined) => {
  if (!result?.AccessToken || !result.RefreshToken || !result.ExpiresIn)
    throw unavailable();
  return {
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken,
    expiresIn: result.ExpiresIn,
  };
};

/** Uses Cognito while keeping provider credentials server-side. */
export const createCognitoAuth = (
  region: string,
  poolId: string,
  clientId: string,
  client = new CognitoIdentityProviderClient({ region, maxAttempts: 1 }),
  fetchKeys = fetch,
): AuthProvider => {
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
    timeoutDuration: 4000,
    [customFetch]: fetchKeys,
  });
  const deadline = () => ({ abortSignal: AbortSignal.timeout(5000) });
  return {
    signUp: async (email, password) => {
      try {
        const result = await client.send(
          new SignUpCommand({
            ClientId: clientId,
            Username: email,
            Password: password,
            UserAttributes: [{ Name: "email", Value: email }],
          }),
          deadline(),
        );
        if (!result.UserSub) throw unavailable();
        return {
          subject: result.UserSub,
          confirmationRequired: !result.UserConfirmed,
        };
      } catch (error) {
        if (
          [
            "UsernameExistsException",
            "InvalidPasswordException",
            "InvalidParameterException",
          ].includes(errorName(error))
        )
          throw new ApiError(
            400,
            "invalid_request",
            "Unable to create account with these details.",
          );
        throw unavailable();
      }
    },
    confirm: async (email, code) => {
      try {
        await client.send(
          new ConfirmSignUpCommand({
            ClientId: clientId,
            Username: email,
            ConfirmationCode: code,
          }),
          deadline(),
        );
      } catch (error) {
        if (
          [
            "CodeMismatchException",
            "ExpiredCodeException",
            "UserNotFoundException",
            "NotAuthorizedException",
            "InvalidParameterException",
          ].includes(errorName(error))
        )
          throw new ApiError(
            400,
            "invalid_request",
            "The confirmation code is invalid or expired.",
          );
        throw unavailable();
      }
    },
    signIn: async (email, password) => {
      try {
        const result = await client.send(
          new InitiateAuthCommand({
            ClientId: clientId,
            AuthFlow: "USER_PASSWORD_AUTH",
            AuthParameters: { USERNAME: email, PASSWORD: password },
          }),
          deadline(),
        );
        if (result.ChallengeName)
          throw new ApiError(
            400,
            "invalid_request",
            "Additional authentication challenge is not supported yet",
          );
        return sessionFrom(result.AuthenticationResult);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (
          ["NotAuthorizedException", "UserNotFoundException"].includes(
            errorName(error),
          )
        )
          throw new ApiError(401, "unauthorized", "Invalid email or password");
        if (errorName(error) === "UserNotConfirmedException")
          throw new ApiError(
            400,
            "invalid_request",
            "Confirm your email before signing in.",
          );
        throw unavailable();
      }
    },
    renew: async (refreshToken) => {
      try {
        const result = await client.send(
          new GetTokensFromRefreshTokenCommand({
            ClientId: clientId,
            RefreshToken: refreshToken,
          }),
          deadline(),
        );
        return sessionFrom(result.AuthenticationResult);
      } catch (error) {
        if (
          [
            "NotAuthorizedException",
            "RefreshTokenReuseException",
            "UserNotFoundException",
          ].includes(errorName(error))
        )
          throw ended();
        throw unavailable();
      }
    },
    revoke: async (refreshToken) => {
      try {
        await client.send(
          new RevokeTokenCommand({ ClientId: clientId, Token: refreshToken }),
          deadline(),
        );
      } catch {
        throw unavailable();
      }
    },
    verify: async (token, options) => {
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer,
          algorithms: ["RS256"],
          requiredClaims: ["exp", "sub", "iat"],
        });
        if (
          payload.token_use !== "access" ||
          payload.client_id !== clientId ||
          !payload.sub
        )
          throw ended();
        if (!options?.requireVerifiedEmail)
          return { subject: payload.sub, email: "" };
        const { UserAttributes } = await client.send(
          new GetUserCommand({ AccessToken: token }),
          deadline(),
        );
        const attributes = new Map(
          UserAttributes?.map(({ Name, Value }) => [Name, Value]),
        );
        const email =
          attributes.get("email_verified") === "true"
            ? (attributes.get("email") ?? "")
            : "";
        return { subject: payload.sub, email };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (
          error instanceof errors.JWTExpired ||
          error instanceof errors.JWTClaimValidationFailed ||
          error instanceof errors.JWSInvalid ||
          error instanceof errors.JWSSignatureVerificationFailed ||
          error instanceof errors.JOSEAlgNotAllowed ||
          error instanceof errors.JWKSNoMatchingKey ||
          ["NotAuthorizedException", "UserNotFoundException"].includes(
            errorName(error),
          )
        )
          throw ended();
        throw unavailable();
      }
    },
  };
};
