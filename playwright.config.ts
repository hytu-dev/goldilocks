import { defineConfig, devices } from "@playwright/test";

// PW_CHROMIUM points at a preinstalled Chromium when the bundled one cannot be downloaded
const executablePath = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: "test",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4173" },
  webServer: { command: "node test/serve.ts", url: "http://localhost:4173/test/space.html" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
