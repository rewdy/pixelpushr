import { handle } from "hono/aws-lambda";
import { createApp } from "./app";
import { readConfig } from "./config/env";
import { createRuntime } from "./config/runtime";
import { databaseUrlFromEnvironment } from "./config/databaseSecret";

const databaseUrl = await databaseUrlFromEnvironment(process.env);
const runtime = createRuntime(
  readConfig({ ...process.env, DATABASE_URL: databaseUrl }),
);
export const handler = handle(createApp(runtime.dependencies));
