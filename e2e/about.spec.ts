import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/* Collect anything the page reports as broken: uncaught exceptions and
   console errors (React hydration mismatches surface as both). */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

const agentFigure = (page: Page) => page.locator('[data-figure="agent"]');

test.describe("home", () => {
  test("renders and hydrates without errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(page).toHaveTitle(/Work tools for people and their agents/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Work tools for people and their agents.");
    // Walk the whole page so lazy images and the 3D figure get a chance to load.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("every image loads", async ({ page }) => {
    await page.goto("/");
    const imgs = page.locator("img");
    for (let i = 0; i < (await imgs.count()); i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
          message: `image ${await img.getAttribute("src")} should load`,
        })
        .toBe(true);
    }
  });

  test("each section is reachable from the masthead", async ({ page, isMobile }) => {
    test.skip(isMobile, "section links are desktop-only; phones scroll");
    await page.goto("/");
    for (const [label, id] of [
      ["Suite", "suite"],
      ["Agents", "agents"],
      ["Storage", "storage"],
      ["Security", "security"],
      ["Source", "source"],
    ]) {
      await page.locator("header nav").getByRole("link", { name: label }).click();
      await expect(page.locator(`section#${id}`)).toBeInViewport();
    }
  });

  test("app launcher lists every app and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open the apps" }).click();
    for (const host of ["formstr.app", "calendar.formstr.app", "pages.formstr.app", "drive.formstr.app", "mailstr.app"]) {
      await expect(page.locator(`header a[href="https://${host}"]`)).toBeVisible();
    }
    await expect(page.locator('header a[href*="npmjs.com/package/@formstr/mcp"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('header a[href="https://formstr.app"]')).toBeHidden();
  });

  test("copy button puts the MCP command on the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const button = page.getByRole("button", { name: "Copy npx -y @formstr/mcp" });
    await button.click();
    await expect(button).toContainText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npx -y @formstr/mcp");
  });

  test("storage: whichever option you pick, only you can read it", async ({ page }) => {
    await page.goto("/");
    const storage = page.locator("section#storage");
    await expect(storage.getByRole("heading", { level: 2 })).toHaveText("Hosted or self-hosted. Encrypted either way.");
    // Our relay is an option, not the presumed answer.
    await expect(storage.getByRole("radio", { name: /Formstr Relay/ })).not.toBeChecked();
    const readers = storage.locator("dt", { hasText: "Who can read it" }).locator("xpath=following-sibling::dd");
    const destination = storage.locator("figure p.font-mono").first();
    for (const [option, dest] of [
      ["On this device", "Nothing sent"],
      ["Your own relay", "relay.yourco.internal"],
      ["Relays you choose", "relay.damus.io"],
      ["Formstr Relay", "relay.formstr.app"],
    ]) {
      await storage.getByText(option, { exact: true }).click();
      await expect(storage.getByRole("radio", { name: new RegExp(option) })).toBeChecked();
      await expect(destination).toContainText(dest);
      await expect(readers).toHaveText("Only you, and people you share with");
    }
  });

  test("storage options work from the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation");
    await page.goto("/");
    const storage = page.locator("section#storage");
    await storage.getByRole("radio", { name: /Your own relay/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(storage.getByRole("radio", { name: /Relays you choose/ })).toBeChecked();
  });

  test("source table links every repository", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator('section#source a[href^="https://github.com/formstr-hq/"]');
    await expect(rows).toHaveCount(7);
  });

  test("nothing overflows the viewport sideways", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("agent figure (Fig. 2)", () => {
  test("the still is shown before the 3D scene, and the scene goes live", async ({ page }) => {
    await page.goto("/");
    const fig = agentFigure(page);
    const still = fig.locator("img");
    await still.scrollIntoViewIfNeeded();
    await expect.poll(() => still.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    // With WebGL available, the live scene takes over and its context stays healthy.
    await expect(fig).toHaveAttribute("data-live", "", { timeout: 20_000 });
    const lost = await fig.locator("canvas").evaluate((c: HTMLCanvasElement) => {
      const gl = c.getContext("webgl2") ?? c.getContext("webgl");
      return !gl || gl.isContextLost();
    });
    expect(lost).toBe(false);
  });

  test("falls back to the still when the WebGL context is lost", async ({ page }) => {
    await page.goto("/");
    const fig = agentFigure(page);
    await fig.scrollIntoViewIfNeeded();
    await expect(fig).toHaveAttribute("data-live", "", { timeout: 20_000 });
    await fig.locator("canvas").evaluate((c: HTMLCanvasElement) => {
      const gl = c.getContext("webgl2") ?? c.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect(fig).not.toHaveAttribute("data-live", "");
    await expect(fig.locator("img")).toHaveCSS("opacity", "1");
    await expect(fig.locator("canvas")).toHaveCount(0);
  });

  test("reduced motion gets the still and never downloads the 3D scene", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const requested: string[] = [];
    page.on("request", (r) => requested.push(r.url()));
    await page.goto("/");
    const fig = agentFigure(page);
    await fig.scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");
    await expect(fig.locator("img")).toHaveCSS("opacity", "1");
    await expect(fig.locator("canvas")).toHaveCount(0);
    expect(requested.some((u) => u.endsWith("/models/robot.glb"))).toBe(false);
    await context.close();
  });
});

test.describe("agent thoughts (Fig. 2)", () => {
  const thought = (page: Page) => agentFigure(page).locator("a[data-thought]");
  const apps: Record<string, string> = {
    Formstr: "https://formstr.app",
    Calendar: "https://calendar.formstr.app",
    Pages: "https://pages.formstr.app",
    Drive: "https://drive.formstr.app",
    Mailstr: "https://mailstr.app",
  };

  test("each thought links to the app it offers", async ({ page }) => {
    await page.goto("/");
    await agentFigure(page).scrollIntoViewIfNeeded();
    const seen = new Set<string>();
    for (let i = 0; i < 6 && seen.size < 5; i++) {
      const app = (await thought(page).getAttribute("data-thought"))!;
      await expect(thought(page)).toHaveAttribute("href", apps[app]);
      await expect(thought(page)).toHaveAttribute("target", "_blank");
      seen.add(app);
      await expect(thought(page)).not.toHaveAttribute("data-thought", app, { timeout: 6000 });
    }
    expect([...seen].sort()).toEqual(Object.keys(apps).sort());
  });

  test("hovering a thought keeps it from changing", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hover on touch screens");
    await page.goto("/");
    await agentFigure(page).scrollIntoViewIfNeeded();
    const app = await thought(page).getAttribute("data-thought");
    await thought(page).hover();
    await page.waitForTimeout(4500);
    await expect(thought(page)).toHaveAttribute("data-thought", app!);
  });

  test("reduced motion holds a single thought", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await agentFigure(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(4500);
    await expect(thought(page)).toHaveAttribute("data-thought", "Formstr");
    await context.close();
  });

  test("tapping the figure on a touch screen is handled cleanly", async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch only");
    const errors = trackErrors(page);
    await page.goto("/");
    const fig = agentFigure(page);
    await fig.scrollIntoViewIfNeeded();
    await expect(fig).toHaveAttribute("data-live", "", { timeout: 20_000 });
    // Tap empty stage (bottom-right, away from the bubble link).
    const box = (await fig.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.85, box.y + box.height * 0.6);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe("privacy policy", () => {
  test("prerendered page hydrates cleanly", async ({ page }) => {
    const errors = trackErrors(page);
    // Trailing slash: `vite preview` serves the prerendered privacy-policy/index.html.
    await page.goto("/privacy-policy/");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("is reachable without the trailing slash", async ({ page }) => {
    // `vite preview` falls back to the home HTML here (Vercel serves the
    // prerendered file), so only assert the right page ends up on screen.
    await page.goto("/privacy-policy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  });
});

test.describe("llms.txt", () => {
  test("is served as plain text and points agents at the setup docs", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body.startsWith("# Formstr\n")).toBe(true);
    expect(body).toContain("npx -y @formstr/mcp");
    expect(body).toContain("packages/mcp/AGENTS.md");
    expect(body).toContain("wss://relay.formstr.app");
    for (const host of ["formstr.app", "calendar.formstr.app", "pages.formstr.app", "drive.formstr.app", "mailstr.app"]) {
      expect(body).toContain(`https://${host}`);
    }
  });

  test("is linked from the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('footer a[href="/llms.txt"]')).toBeVisible();
  });
});
