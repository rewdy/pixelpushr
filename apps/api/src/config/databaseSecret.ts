import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/** Resolves RDS's managed master secret during a Lambda cold start. */
export const databaseUrlFromEnvironment = async (
  environment: NodeJS.ProcessEnv,
): Promise<string> => {
  if (environment.DATABASE_URL) return environment.DATABASE_URL;
  const { AWS_REGION, DATABASE_HOST, DATABASE_NAME, DATABASE_SECRET_ARN } =
    environment;
  if (!AWS_REGION || !DATABASE_HOST || !DATABASE_NAME || !DATABASE_SECRET_ARN)
    throw new Error(
      "Database configuration requires DATABASE_URL or AWS_REGION, DATABASE_HOST, DATABASE_NAME, and DATABASE_SECRET_ARN",
    );
  const response = await new SecretsManagerClient({ region: AWS_REGION }).send(
    new GetSecretValueCommand({ SecretId: DATABASE_SECRET_ARN }),
  );
  if (!response.SecretString) throw new Error("RDS secret has no string value");
  const credentials = JSON.parse(response.SecretString) as {
    username?: string;
    password?: string;
    port?: number;
  };
  if (!credentials.username || !credentials.password)
    throw new Error("RDS secret is missing username or password");
  const url = new URL(
    `postgres://${DATABASE_HOST}:${credentials.port ?? 5432}/${DATABASE_NAME}`,
  );
  url.username = encodeURIComponent(credentials.username);
  url.password = encodeURIComponent(credentials.password);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
};
