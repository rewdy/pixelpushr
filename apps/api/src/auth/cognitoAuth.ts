import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "../http/errors";
import type { AuthProvider } from "./provider";

/** Uses Cognito's API while keeping all sign-up and sign-in screens in our SPA. */
export const createCognitoAuth = (
  region: string,
  poolId: string,
  clientId: string,
): AuthProvider => {
  const client = new CognitoIdentityProviderClient({ region });
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
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
        );
        if (!result.UserSub) throw new Error("Cognito omitted user subject");
        return {
          subject: result.UserSub,
          confirmationRequired: !result.UserConfirmed,
        };
      } catch (error) {
        throw new ApiError(
          400,
          "invalid_request",
          error instanceof Error ? error.message : "Sign-up failed",
        );
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
        );
      } catch (error) {
        throw new ApiError(
          400,
          "invalid_request",
          error instanceof Error ? error.message : "Confirmation failed",
        );
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
        );
        if (!result.AuthenticationResult?.AccessToken)
          throw new ApiError(
            400,
            "invalid_request",
            "Additional authentication challenge is not supported yet",
          );
        return {
          accessToken: result.AuthenticationResult.AccessToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
          expiresIn: result.AuthenticationResult.ExpiresIn ?? 3600,
        };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, "unauthorized", "Invalid email or password");
      }
    },
    verify: async (token) => {
      try {
        const { payload } = await jwtVerify(token, keys, { issuer });
        if (
          payload.token_use !== "access" ||
          payload.client_id !== clientId ||
          !payload.sub
        )
          throw new Error("Unexpected token claims");
        return { subject: payload.sub, email: "" };
      } catch {
        throw new ApiError(401, "unauthorized", "Invalid or expired session");
      }
    },
  };
};
