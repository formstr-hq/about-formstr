import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { finalizeEvent, nip44 } from "nostr-tools";
import { DEMO_FORM, DEMO_RESULTS_KEY } from "../src/lib/form.mjs";

const demo = JSON.parse(fs.readFileSync(new URL("../src/data/demo-form.json", import.meta.url), "utf8"));

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
  // The page talks to relays after load (form freshness, live results);
  // keep these tests off the real network.
  test.beforeEach(async ({ page }) => {
    await fakeRelays(page);
  });

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

test.describe("agent figure", () => {
  // Keep off the real relays: the page talks to them after load.
  test.beforeEach(async ({ page }) => {
    await fakeRelays(page);
  });

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

test.describe("agent thoughts", () => {
  // Keep off the real relays: the page talks to them after load.
  test.beforeEach(async ({ page }) => {
    await fakeRelays(page);
  });

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

/* The hero's example form is real: submitting publishes a real response.
   Tests stand in for every relay with a fake that stores what's published
   and answers each REQ by its filter, like a relay would, so nothing is ever
   published. */
type Ev = { id: string; kind: number; pubkey: string; content: string; tags: string[][]; created_at: number };
const matches = (e: Ev, f: Record<string, unknown>) =>
  (!f.ids || (f.ids as string[]).includes(e.id)) &&
  (!f["#d"] || e.tags.some((t) => t[0] === "d" && (f["#d"] as string[]).includes(t[1]))) &&
  (!f.kinds || (f.kinds as number[]).includes(e.kind)) &&
  (!f.authors || (f.authors as string[]).includes(e.pubkey)) &&
  (!f["#a"] || e.tags.some((t) => t[0] === "a" && (f["#a"] as string[]).includes(t[1])));

async function fakeRelays(page: Page, stored: Ev[] = []) {
  const published: Ev[] = [];
  await page.routeWebSocket(/^wss:\/\//, (ws) => {
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg[0] === "EVENT") {
        published.push(msg[1]);
        ws.send(JSON.stringify(["OK", msg[1].id, true, ""]));
      }
      if (msg[0] === "REQ") {
        for (const e of [demo.event, ...stored, ...published].filter((e) => matches(e, msg[2] ?? {})))
          ws.send(JSON.stringify(["EVENT", msg[1], e]));
        ws.send(JSON.stringify(["EOSE", msg[1]]));
      }
    });
  });
  return published;
}

/* A response exactly as the page sends one: signed with the published
   results key, NIP-44 encrypted to the form's pubkey. */
function pageResponse(choice: string, secondsAgo: number, key = DEMO_RESULTS_KEY.secret): Ev {
  const sk = Uint8Array.from(key.match(/../g)!, (b) => parseInt(b, 16));
  const conv = nip44.v2.utils.getConversationKey(sk, DEMO_FORM.pubkey);
  return finalizeEvent(
    {
      kind: 1069,
      created_at: Math.floor(Date.now() / 1000) - secondsAgo,
      tags: [["a", `30168:${DEMO_FORM.pubkey}:${DEMO_FORM.id}`]],
      content: nip44.v2.encrypt(JSON.stringify([["response", "f0", choice, "{}"]]), conv),
    },
    sk,
  ) as Ev;
}

test.describe("example form", () => {
  test("renders the SDK's form, accessible and without names", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("figure").first();
    await expect(hero.locator(".form-name")).toHaveText("Site visit feedback");
    await expect(hero.getByRole("radiogroup", { name: "How was the visit?" })).toBeVisible();
    // One question, no names, no free text.
    await expect(hero.locator(".demo-form").getByRole("textbox")).toHaveCount(0);
    await expect(page.getByText(/^Fig\. \d/)).toHaveCount(0);
  });

  test("the event panel follows the answers as they're given", async ({ page }) => {
    await fakeRelays(page);
    await page.goto("/");
    const hero = page.locator("figure").first();
    const panel = hero.locator("pre.ev");
    await expect(hero.getByText("kind 30168 · signed")).toBeVisible();

    await hero.getByText("Mixed", { exact: true }).click();
    await expect(hero.getByText("kind 1069 · draft")).toBeVisible();
    await expect(panel).toContainText('["response", "f0", "o1", "{}"]');
    await expect(panel).toContainText("// Mixed");

    await hero.getByText("Rough", { exact: true }).click();
    await expect(panel).toContainText('["response", "f0", "o2", "{}"]');
    // Updating the panel must not reset the form (React re-applying its HTML).
    await expect(hero.getByRole("radio", { name: "Rough" })).toBeChecked();
  });

  test("won't submit without the required choice", async ({ page }) => {
    const published = await fakeRelays(page);
    await page.goto("/");
    const hero = page.locator("figure").first();
    await hero.getByRole("button", { name: "Submit" }).click();
    await page.waitForTimeout(500);
    expect(published).toEqual([]);
    await expect(hero.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  test("shows the full round trip: encrypted, stored, decrypted, counted", async ({ page }) => {
    const published = await fakeRelays(page, [pageResponse("o0", 400), pageResponse("o2", 900)]);
    await page.goto("/");
    const hero = page.locator("figure").first();
    await hero.getByText("Mixed", { exact: true }).click();
    await hero.getByRole("button", { name: "Submit" }).click();

    const status = hero.getByRole("status");
    await expect(status).toContainText("Sent");
    await expect(status).toContainText("Encrypted in your browser");
    await expect(status).toContainText("Stored on relay.formstr.app");
    // Decrypted from what the relay served back, with the published key.
    await expect(status).toContainText("How was the visit? Mixed");
    // The live tally, computed in the browser, with this response counted.
    await expect(status).toContainText("3 responses");
    await expect(status.getByText("you", { exact: true })).toBeVisible();
    await expect(hero.getByText("kind 1069 · encrypted")).toBeVisible();

    const response = published.find((e) => e.kind === 1069)!;
    expect(response.pubkey).toBe(DEMO_RESULTS_KEY.pubkey);
    expect(response.tags).toContainEqual(["a", `30168:${DEMO_FORM.pubkey}:${DEMO_FORM.id}`]);
    // (only multi-character strings: random ciphertext can contain any short one)
    expect(response.content).not.toContain("Mixed");
    await expect(hero.locator("pre.ev")).toContainText(response.content.slice(0, 20));

    await hero.getByRole("button", { name: "Send another" }).click();
    await expect(hero.getByText("kind 30168 · signed")).toBeVisible();
  });

  test("the Formstr plate tallies responses live, in the browser", async ({ page }) => {
    const otherKey = "11".repeat(32);
    await fakeRelays(page, [
      pageResponse("o0", 150),
      pageResponse("o0", 5400),
      pageResponse("o2", 200),
      pageResponse("o1", 60, otherKey), // not from this page: not counted
    ]);
    await page.goto("/");
    const plate = page.locator("section#suite figure").first();
    await plate.scrollIntoViewIfNeeded();
    await expect(plate).toContainText("3 responses · live");
    await expect(plate).toContainText("2 min ago");
    await expect(plate).toContainText("1 h ago");
  });

  test("the Formstr plate counts correctly when most relays fail", async ({ page }) => {
    // Relays are flaky: here every relay but one errors. The tally must still
    // be right, not "no responses".
    const stored = [pageResponse("o0", 150), pageResponse("o2", 200)];
    await page.routeWebSocket(/^wss:\/\//, (ws) => {
      if (!ws.url().includes("relay.primal.net")) return ws.close();
      ws.onMessage((raw) => {
        const msg = JSON.parse(String(raw));
        if (msg[0] !== "REQ") return;
        for (const e of [demo.event, ...stored].filter((e) => matches(e, msg[2] ?? {})))
          ws.send(JSON.stringify(["EVENT", msg[1], e]));
        ws.send(JSON.stringify(["EOSE", msg[1]]));
      });
    });
    await page.goto("/");
    const plate = page.locator("section#suite figure").first();
    await plate.scrollIntoViewIfNeeded();
    await expect(plate).toContainText("2 responses · live");
  });

  test("the Formstr plate says so when the relays are unreachable", async ({ page }) => {
    await page.routeWebSocket(/^wss:\/\//, (ws) => ws.close());
    await page.goto("/");
    const plate = page.locator("section#suite figure").first();
    await plate.scrollIntoViewIfNeeded();
    await expect(plate).toContainText("Results unavailable right now");
  });
});

/* The page checks the relays for a newer version of the form after load. */
test.describe("example form stays current", () => {
  const newer = (sign: (e: object) => object) =>
    sign({
      kind: 30168,
      created_at: demo.event.created_at + 100,
      content: "",
      tags: demo.event.tags.map((t: string[]) => (t[0] === "name" ? ["name", "Site visit feedback, revised"] : t)),
    });
  async function serveForm(page: Page, event: object) {
    await page.routeWebSocket(/^wss:\/\//, (ws) => {
      ws.onMessage((raw) => {
        const msg = JSON.parse(String(raw));
        if (msg[0] !== "REQ") return;
        if (msg[2]?.kinds?.includes(30168)) ws.send(JSON.stringify(["EVENT", msg[1], event]));
        ws.send(JSON.stringify(["EOSE", msg[1]]));
      });
    });
  }

  test("ignores a newer version with a forged signature", async ({ page }) => {
    const forged = newer((e) => ({ ...e, pubkey: demo.event.pubkey, id: "ab".repeat(32), sig: "00".repeat(64) }));
    await serveForm(page, forged);
    await page.goto("/");
    await page.waitForTimeout(2500);
    await expect(page.locator("figure").first().locator(".form-name")).toHaveText("Site visit feedback");
  });

  test("swaps in a newer, correctly signed version", async ({ page }) => {
    const key = process.env.FORMSTR_DEMO_FORM_KEY;
    test.skip(!key, "needs FORMSTR_DEMO_FORM_KEY to sign a test version of the form");
    const sk = Uint8Array.from(key!.trim().match(/../g)!, (b) => parseInt(b, 16));
    await serveForm(page, newer((e) => finalizeEvent(e as never, sk)));
    await page.goto("/");
    const hero = page.locator("figure").first();
    await expect(hero.locator(".form-name")).toHaveText("Site visit feedback, revised");
    await expect(hero.locator("pre.ev")).toContainText("Site visit feedback, revised");
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
    expect(body).toContain("Site visit feedback");
    for (const host of ["formstr.app", "calendar.formstr.app", "pages.formstr.app", "drive.formstr.app", "mailstr.app"]) {
      expect(body).toContain(`https://${host}`);
    }
  });

  test("is linked from the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('footer a[href="/llms.txt"]')).toBeVisible();
  });
});
