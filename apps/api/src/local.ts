import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { readConfig } from "./config/env";
import { createRuntime } from "./config/runtime";

const config = readConfig(process.env);
const runtime = createRuntime(config);
serve({ fetch: createApp(runtime.dependencies).fetch, port: config.PORT });
