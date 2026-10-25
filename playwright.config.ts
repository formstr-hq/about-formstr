import { defineConfig, devices } from "@playwright/test";

/* End-to-end tests run against the production build (prerendered HTML +
   hydration), served by `vite preview`. Build first: `npm run test:e2e`. */
const PORT = 4176;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Three browser projects plus software WebGL at once starve the preview
  // server (page loads time out); cap concurrency.
  workers: 4,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: {
      // Software WebGL, so the 3D figure can run on machines without a GPU.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  // Run in the installed Google Chrome (set per project: device presets
  // override a top-level channel), so no separate browser download is needed.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
    // Firefox at a narrow phone width: the form used to break here (a Pixel 9a
    // with a larger display size). Layout and form tests only; no WebGL.
    {
      name: "firefox-narrow",
      use: { browserName: "firefox", viewport: { width: 340, height: 800 }, launchOptions: { args: [] } },
      grep: /example form|every image|overflows|privacy|storage/,
    },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
