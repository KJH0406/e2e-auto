import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  fullyParallel: false,
  // reporter: "html",
  use: {
    trace: "on-first-retry",
    headless: false,
    storageState: "auth.json",
  },
  projects: [{ name: "Google Chrome", use: { ...devices["Desktop Chrome"] } }],
})
