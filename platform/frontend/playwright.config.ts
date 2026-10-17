import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// E2E runs against its own backend (port 8001) and a throwaway SQLite file, never your study data.
const DB = path.resolve(import.meta.dirname, "test-results/e2e.db");
const MEDIA = path.resolve(import.meta.dirname, "test-results/media");

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174", trace: "retain-on-failure", channel: process.env.PW_CHANNEL ?? "chrome",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL ?? "chrome", permissions: ["microphone"],
      launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL ?? "chrome" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `rm -rf "${DB}" "${MEDIA}" && cd ../backend && APP_ACCESS_TOKEN= DATABASE_URL=sqlite:///${DB} MEDIA_DIR=${MEDIA} AI_PROVIDER=fake AI_RATE_LIMIT_PER_MINUTE=500 CONTENT_RELOAD_SECONDS=60 .venv/bin/uvicorn app.main:app --port 8001`,
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "VITE_API_PROXY=http://127.0.0.1:8001 npx vite --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
