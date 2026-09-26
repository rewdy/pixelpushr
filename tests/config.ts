/** Local Docker Compose defaults; override when testing against other services. */
export const testDatabaseAdminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  "postgres://pixelpushr:pixelpushr@127.0.0.1:54329/postgres";

export const testS3Endpoint =
  process.env.TEST_S3_ENDPOINT ?? "http://127.0.0.1:4566";

export const browserTestApiPort = 43722;
