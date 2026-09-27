import { handle } from "hono/aws-lambda";
import { createApp } from "./app";
import { databaseUrlFromEnvironment } from "./config/databaseSecret";
import { readConfig } from "./config/env";
import { createRuntime } from "./config/runtime";

const databaseUrl = await databaseUrlFromEnvironment(process.env);
const runtime = createRuntime(
  readConfig({ ...process.env, DATABASE_URL: databaseUrl }),
);
export const handler = handle(createApp(runtime.dependencies));
