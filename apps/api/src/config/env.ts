import { z } from "zod";

const schema = z
  .object({
    APP_ENV: z.enum(["local", "production"]).default("local"),
    SESSION_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, "Expected a 32-byte hex key")
      .optional(),
    AUTH_MODE: z.enum(["local", "cognito"]).default("local"),
    DATABASE_URL: z.url(),
    INITIAL_OWNER_EMAIL: z.email().toLowerCase().optional(),
    LOCAL_AUTH_SECRET: z.string().min(32).optional(),
    AWS_REGION: z.string().optional(),
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    PUBLIC_WEB_URL: z.url().default("http://127.0.0.1:5173"),
    SMTP_URL: z.url().optional(),
    MAIL_FROM: z.email().optional(),
    MEDIA_BUCKET: z.string().min(1).default("pixelpushr-media"),
    MEDIA_STORAGE: z.enum(["local", "s3"]).default("local"),
    MEDIA_PUBLIC_URL: z.url().optional(),
    LOCAL_MEDIA_DIR: z.string().optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    MAX_IMAGE_MB: z.coerce.number().positive().default(20),
    MAX_VIDEO_MB: z.coerce.number().positive().default(500),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  })
  .superRefine((value, context) => {
    if (value.AUTH_MODE === "cognito" && !value.SESSION_ENCRYPTION_KEY)
      context.addIssue({
        code: "custom",
        path: ["SESSION_ENCRYPTION_KEY"],
        message: "Cognito sessions require an encryption key",
      });
    if (value.APP_ENV === "production" && !value.INITIAL_OWNER_EMAIL)
      context.addIssue({
        code: "custom",
        path: ["INITIAL_OWNER_EMAIL"],
        message: "Production requires an initial owner email",
      });
    if (
      value.APP_ENV === "production" &&
      !value.PUBLIC_WEB_URL.startsWith("https://")
    )
      context.addIssue({
        code: "custom",
        path: ["PUBLIC_WEB_URL"],
        message: "Production sessions require an HTTPS web origin",
      });
    if (value.APP_ENV === "production" && value.AUTH_MODE !== "cognito")
      context.addIssue({
        code: "custom",
        path: ["AUTH_MODE"],
        message: "Production requires Cognito",
      });
    if (value.AUTH_MODE === "local" && !value.LOCAL_AUTH_SECRET)
      context.addIssue({
        code: "custom",
        path: ["LOCAL_AUTH_SECRET"],
        message: "Local auth requires a signing secret",
      });
    if (
      value.AUTH_MODE === "cognito" &&
      (!value.AWS_REGION ||
        !value.COGNITO_USER_POOL_ID ||
        !value.COGNITO_CLIENT_ID)
    )
      context.addIssue({
        code: "custom",
        path: ["COGNITO_USER_POOL_ID"],
        message: "Cognito region, pool, and client are required",
      });
    if (
      !value.MAIL_FROM ||
      (value.APP_ENV === "local" ? !value.SMTP_URL : !value.AWS_REGION)
    )
      context.addIssue({
        code: "custom",
        path: ["MAIL_FROM"],
        message: "Invitation email delivery configuration is required",
      });
    if (value.APP_ENV === "production" && value.MEDIA_STORAGE !== "s3")
      context.addIssue({
        code: "custom",
        path: ["MEDIA_STORAGE"],
        message: "Production requires S3 media storage",
      });
    if (value.MEDIA_STORAGE === "s3" && !value.MEDIA_PUBLIC_URL)
      context.addIssue({
        code: "custom",
        path: ["MEDIA_PUBLIC_URL"],
        message: "S3 media delivery URL is required",
      });
    if (value.MEDIA_STORAGE === "local" && !value.LOCAL_MEDIA_DIR)
      context.addIssue({
        code: "custom",
        path: ["LOCAL_MEDIA_DIR"],
        message: "Local media directory is required",
      });
  });

export type AppConfig = z.infer<typeof schema>;

/** Parses process configuration before the server accepts requests. */
export const readConfig = (source: NodeJS.ProcessEnv): AppConfig => {
  const result = schema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Invalid API configuration: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  return result.data;
};
