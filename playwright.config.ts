import { defineConfig } from "@playwright/test";
import { browserTestApiPort } from "./tests/config";

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5173", browserName: "chromium" },
  webServer: {
    command: "bun run dev:web",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      VITE_PLAYER_POLL_MS: "300",
      VITE_API_PROXY_TARGET: `http://127.0.0.1:${browserTestApiPort}`,
    },
  },
});
