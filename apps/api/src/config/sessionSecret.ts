import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/** Resolves the application session key without putting its value in Terraform state. */
export const sessionKeyFromEnvironment = async (
  environment: NodeJS.ProcessEnv,
): Promise<string | undefined> => {
  if (environment.SESSION_ENCRYPTION_KEY)
    return environment.SESSION_ENCRYPTION_KEY;
  const { AWS_REGION, SESSION_ENCRYPTION_SECRET_ID } = environment;
  if (!AWS_REGION || !SESSION_ENCRYPTION_SECRET_ID) return undefined;
  try {
    const response = await new SecretsManagerClient({
      region: AWS_REGION,
    }).send(
      new GetSecretValueCommand({ SecretId: SESSION_ENCRYPTION_SECRET_ID }),
    );
    return response.SecretString;
  } catch {
    throw new Error("Unable to load the session encryption key");
  }
};
