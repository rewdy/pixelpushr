import { createCognitoAuth } from "../auth/cognitoAuth";
import { createLocalAuth } from "../auth/localAuth";
import { createSesMailer, createSmtpMailer } from "../auth/mailer";
import type { AppDependencies } from "../auth/routes";
import { createDatabase } from "../db/client";
import { createLocalStorage } from "../media/localStorage";
import { createS3Storage } from "../media/storage";
import type { AppConfig } from "./env";

const required = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`Missing validated API configuration: ${name}`);
  return value;
};

/** Instantiates infrastructure adapters from validated configuration. */
export const createRuntime = (
  config: AppConfig,
): { dependencies: AppDependencies; close: () => Promise<void> } => {
  const connection = createDatabase(config.DATABASE_URL);
  const auth =
    config.AUTH_MODE === "cognito"
      ? createCognitoAuth(
          required(config.AWS_REGION, "AWS_REGION"),
          required(config.COGNITO_USER_POOL_ID, "COGNITO_USER_POOL_ID"),
          required(config.COGNITO_CLIENT_ID, "COGNITO_CLIENT_ID"),
        )
      : createLocalAuth(
          connection.db,
          required(config.LOCAL_AUTH_SECRET, "LOCAL_AUTH_SECRET"),
        );
  const mailer =
    config.APP_ENV === "production"
      ? createSesMailer(
          required(config.AWS_REGION, "AWS_REGION"),
          required(config.MAIL_FROM, "MAIL_FROM"),
        )
      : createSmtpMailer(
          required(config.SMTP_URL, "SMTP_URL"),
          required(config.MAIL_FROM, "MAIL_FROM"),
        );
  const storage =
    config.MEDIA_STORAGE === "local"
      ? createLocalStorage(
          required(config.LOCAL_MEDIA_DIR, "LOCAL_MEDIA_DIR"),
          config.PUBLIC_WEB_URL,
          required(config.LOCAL_AUTH_SECRET, "LOCAL_AUTH_SECRET"),
        )
      : createS3Storage({
          region: config.AWS_REGION ?? "us-east-1",
          bucket: config.MEDIA_BUCKET,
          publicBaseUrl: required(config.MEDIA_PUBLIC_URL, "MEDIA_PUBLIC_URL"),
          endpoint: config.S3_ENDPOINT,
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
        });
  return {
    dependencies: {
      db: connection.db,
      auth,
      mailer,
      publicWebUrl: config.PUBLIC_WEB_URL,
      sessionEncryptionKey: config.SESSION_ENCRYPTION_KEY,
      initialOwnerEmail: config.INITIAL_OWNER_EMAIL,
      storage,
      maxImageBytes: config.MAX_IMAGE_MB * 1024 * 1024,
      maxVideoBytes: config.MAX_VIDEO_MB * 1024 * 1024,
    },
    close: connection.close,
  };
};
