import type { AppDependencies } from "../auth/routes";
import { createCognitoAuth } from "../auth/cognitoAuth";
import { createLocalAuth } from "../auth/localAuth";
import { createSesMailer, createSmtpMailer } from "../auth/mailer";
import { createDatabase } from "../db/client";
import type { AppConfig } from "./env";
import { createS3Storage } from "../media/storage";
import { createLocalStorage } from "../media/localStorage";

/** Instantiates infrastructure adapters from validated configuration. */
export const createRuntime = (config: AppConfig): { dependencies: AppDependencies; close: () => Promise<void> } => {
  const connection = createDatabase(config.DATABASE_URL);
  const auth = config.AUTH_MODE === "cognito"
    ? createCognitoAuth(config.AWS_REGION!, config.COGNITO_USER_POOL_ID!, config.COGNITO_CLIENT_ID!)
    : createLocalAuth(connection.db, config.LOCAL_AUTH_SECRET!);
  const mailer = config.APP_ENV === "production" ? createSesMailer(config.AWS_REGION!, config.MAIL_FROM!) : createSmtpMailer(config.SMTP_URL!, config.MAIL_FROM!);
  const storage = config.MEDIA_STORAGE === "local"
    ? createLocalStorage(config.LOCAL_MEDIA_DIR!, config.PUBLIC_WEB_URL, config.LOCAL_AUTH_SECRET!)
    : createS3Storage({ region: config.AWS_REGION ?? "us-east-1", bucket: config.MEDIA_BUCKET, publicBaseUrl: config.MEDIA_PUBLIC_URL!, endpoint: config.S3_ENDPOINT, accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY });
  return { dependencies: { db: connection.db, auth, mailer, publicWebUrl: config.PUBLIC_WEB_URL, storage, maxImageBytes: config.MAX_IMAGE_MB * 1024 * 1024, maxVideoBytes: config.MAX_VIDEO_MB * 1024 * 1024 }, close: connection.close };
};
