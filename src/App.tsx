import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { Point } from "./three/AgentScene";
import type { ComponentType, CSSProperties, FormEvent, ReactNode } from "react";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Copy, Lock } from "lucide-react";
import "./index.css";
import repoStats from "./data/repos.json";
import demoForm from "./data/demo-form.json";
import {
  DEMO_FORM,
  DEMO_RESULTS_KEY,
  decryptResponse,
  enhanceFormHtml,
  fetchFormVersions,
  fetchResults,
  sdkRawTags,
  talliedQuestion,
} from "./lib/form.mjs";
import type { Results } from "./lib/form.mjs";

/* The privacy page pulls in a markdown renderer the home page doesn't need,
   so the browser loads it on demand. The prerender passes the real component
   in (see entry-server.tsx); React keeps that prerendered HTML on screen until
   this chunk arrives, so there's no flash. */
const LazyPrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const GITHUB = "https://github.com/formstr-hq";
const NPM_MCP = "https://www.npmjs.com/package/@formstr/mcp";
const AGENTS_MD =
  "https://github.com/formstr-hq/common-packages/blob/main/packages/mcp/AGENTS.md";
const CONTACT = "mailto:hello@formstr.app";
const MCP_CMD = "npx -y @formstr/mcp";

const apps = [
  { name: "Formstr", what: "Forms", url: "https://formstr.app", color: "var(--color-forms)" },
  { name: "Calendar", what: "Events", url: "https://calendar.formstr.app", color: "var(--color-cal)" },
  { name: "Pages", what: "Documents", url: "https://pages.formstr.app", color: "var(--color-pages)" },
  { name: "Drive", what: "Files", url: "https://drive.formstr.app", color: "var(--color-drive)" },
  { name: "Mailstr", what: "Email", url: "https://mailstr.app", color: "var(--color-mail)" },
];

/* What the agent offers to do, one thought at a time (agent figure). Each opens its app. */
const thoughts = [
  { text: "Draft a survey?", app: "Formstr", url: "https://formstr.app", color: "var(--color-forms)" },
  { text: "Manage your calendar?", app: "Calendar", url: "https://calendar.formstr.app", color: "var(--color-cal)" },
  { text: "Note down your thoughts?", app: "Pages", url: "https://pages.formstr.app", color: "var(--color-pages)" },
  { text: "Stash a file?", app: "Drive", url: "https://drive.formstr.app", color: "var(--color-drive)" },
  { text: "Sort your inbox?", app: "Mailstr", url: "https://mailstr.app", color: "var(--color-mail)" },
];
const THOUGHT_MS = 3800;

/* Repos shown in the Source section. Stars and dates come from
   src/data/repos.json, refreshed at build time by scripts/fetch-repos.mjs. */
const repos = [
  { name: "nostr-forms", what: "Formstr: encrypted forms and surveys", color: "var(--color-forms)" },
  { name: "nostr-calendar", what: "Calendar: events and booking pages", color: "var(--color-cal)" },
  { name: "nostr-docs", what: "Pages: collaborative documents", color: "var(--color-pages)" },
  { name: "formstr-drive", what: "Drive: files on Blossom", color: "var(--color-drive)" },
  { name: "nail", what: "Mailstr: the email ⇄ Nostr bridge", color: "var(--color-mail)" },
  { name: "nostr-polls", what: "Polls on Nostr", color: "var(--color-polls)" },
  { name: "common-packages", what: "@formstr/mcp and the shared SDKs", color: "var(--color-ink)" },
];

type RepoStat = { stars: number; pushedAt: string; license: string | null };
const stats = repoStats.repos as Record<string, RepoStat | undefined>;

// Fixed locale + UTC so the prerendered HTML and the hydrated client agree.
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

/* 12-column row inside the sheet. Collapses to one column below lg. */
function Row({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`grid grid-cols-1 gap-x-6 px-6 sm:px-10 lg:grid-cols-12 lg:px-12 [&>*]:min-w-0 ${className}`}>
      {children}
    </div>
  );
}

/* Numbered section head: "01 — The suite" in the margin, title in the body. */
function SectionHead({ no, title, lede }: { no: string; title: string; lede?: ReactNode }) {
  return (
    <Row className="mb-14 items-start lg:mb-18">
      <span className="cap pt-3 lg:col-span-3">{no}</span>
      <div className="mt-4 lg:col-span-7 lg:mt-0">
        <h2 className="text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[44px] lg:text-[52px]">
          {title}
        </h2>
        {lede && <p className="mt-6 max-w-[620px] text-[17px] leading-relaxed text-ink-2 lg:text-lg">{lede}</p>}
      </div>
    </Row>
  );
}

function Figcap({ children }: { children: ReactNode }) {
  return <figcaption className="figcap">{children}</figcaption>;
}

/* Browser-window chrome around a product plate. */
function Win({ url, flush = false, children }: { url: string; flush?: boolean; children: ReactNode }) {
  return (
    <div className={`win ${flush ? "rounded-b-none rounded-tr-none border-r-0 border-b-0" : ""}`}>
      <div className="flex h-[34px] items-center gap-1.5 border-b border-line-2 px-3">
        <i className="h-[9px] w-[9px] rounded-full bg-[#e4e4e1]" />
        <i className="h-[9px] w-[9px] rounded-full bg-[#e4e4e1]" />
        <i className="h-[9px] w-[9px] rounded-full bg-[#e4e4e1]" />
        <span className="ml-2.5 truncate font-mono text-[11.5px] text-mute">{url}</span>
      </div>
      {children}
    </div>
  );
}

function CopyCommand({ dark = false }: { dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(MCP_CMD).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={`flex h-[42px] w-full items-center justify-between rounded-[4px] border px-3.5 font-mono text-[13.5px] transition-colors ${
        dark
          ? "border-night-line bg-night-2 text-night-text hover:border-night-mute"
          : "border-line bg-white text-ink hover:border-faint"
      }`}
      aria-label={`Copy ${MCP_CMD}`}
    >
      <span>
        <span className="text-faint">$ </span>
        {MCP_CMD}
      </span>
      <span className="cap flex items-center gap-1.5">
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Connect an agent"}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Masthead                                                            */
/* ------------------------------------------------------------------ */

function Launcher() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-[4px] bg-ink px-3.5 text-[13.5px] font-medium text-white"
      >
        Open the apps
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 border border-line bg-white p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.2)]">
            {apps.map((a) => (
              <a
                key={a.name}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-paper"
              >
                <i className="h-2 w-2 rounded-[2px]" style={{ background: a.color }} />
                <span className="text-sm font-medium">{a.name}</span>
                <span className="cap ml-auto">{a.what}</span>
              </a>
            ))}
            <a
              href={NPM_MCP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-3 border-t border-line-2 px-3 py-2.5 transition-colors hover:bg-paper"
            >
              <i className="h-2 w-2 rounded-[2px] bg-ink" />
              <span className="font-mono text-[13px]">@formstr/mcp</span>
              <span className="cap ml-auto">Agents</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export function Navbar() {
  const links = [
    ["01", "Suite", "/#suite"],
    ["02", "Agents", "/#agents"],
    ["03", "Storage", "/#storage"],
    ["04", "Security", "/#security"],
    ["05", "Source", "/#source"],
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="sheet">
        <Row className="h-[60px] items-center">
          <a href="/" className="col-start-1 row-start-1 lg:col-span-3" aria-label="Formstr home">
            <img src="/images/formstr/formstr-logo.svg" alt="Formstr" className="block h-7" />
          </a>
          <nav className="hidden gap-8 text-sm text-ink-2 lg:col-span-6 lg:flex">
            {links.map(([n, label, href]) => (
              <a key={label} href={href} className="transition-colors hover:text-ink">
                <span className="mr-1.5 font-mono text-[11px] text-faint">{n}</span>
                {label}
              </a>
            ))}
          </nav>
          <div className="col-start-1 row-start-1 flex items-center gap-5 justify-self-end lg:col-span-3 lg:col-start-auto lg:row-start-auto">
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm text-mute transition-colors hover:text-ink sm:block"
            >
              GitHub
            </a>
            <Launcher />
          </div>
        </Row>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero + the example form                                            */
/* ------------------------------------------------------------------ */

/* The hero's example form is real: "Site visit feedback", fetched and
   rendered with @formstr/sdk at build time (scripts/fetch-form.mjs), so the
   page ships the real form markup. The SDK only loads when someone starts
   filling it in. Responses are signed with a results key this page publishes
   and encrypted to the form's pubkey, so the Formstr app and any browser can
   open them: the page shows the whole round trip and a live tally with no
   server (see DEMO_RESULTS_KEY in src/lib/form.mjs). */
type SignedEvent = {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
};
const demoEvent = demoForm.event as SignedEvent;

const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n)}…` : v);
const loadSdk = () => import("@formstr/sdk");

/* ---- live results ---- */

/* The current form: the build-time snapshot first, replaced by the live
   version from the relays when that's newer (see Hero). */
type DemoField = { id: string; labelHtml: string; options?: { id: string; labelHtml: string }[] };
type FormShape = typeof demoForm.form;
type LiveForm = { form: FormShape; html: string; event: SignedEvent };
const snapshot: LiveForm = { form: demoForm.form, html: demoForm.html, event: demoEvent };
const fieldsOf = (form: FormShape) => form.fieldOrder.map((id) => (form.fields as Record<string, DemoField>)[id]);
const answerLabel = (form: FormShape, fieldId: string, value: string) =>
  fieldsOf(form)
    .find((f) => f.id === fieldId)
    ?.options?.find((o) => o.id === value)?.labelHtml ?? value;
/* The tallied question from the snapshot, until live results describe it. */
const snapshotQuestion = talliedQuestion(demoEvent)!;

/* The newest signed version of the form, fetched once per page load and
   shared by the hero and the results views. Falls back to the build snapshot
   if the relays don't answer, or don't have anything newer. */
let currentForm: Promise<SignedEvent> | null = null;
function currentFormEvent() {
  currentForm ??= (async () => {
    // Only versions newer than the snapshot matter; nostr-tools (for the
    // signature check) only loads if there is one.
    const newer = ((await fetchFormVersions(DEMO_FORM.relays)) as SignedEvent[]).filter(
      (e) => e.created_at > demoEvent.created_at,
    );
    if (!newer.length) return demoEvent;
    const { verifyEvent } = await import("nostr-tools");
    return newer.find((e) => verifyEvent(e)) ?? demoEvent;
  })().catch(() => demoEvent);
  return currentForm;
}


/* Current time, client-only (null in the prerender, so relative times never
   cause a hydration mismatch), refreshed every 30 s. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ago(at: number, now: number) {
  const s = Math.max(0, now - at);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function ResultBars({ results, yours }: { results: Results | null; yours?: string }) {
  const max = Math.max(1, ...Object.values(results?.counts ?? {}));
  const question = results?.question ?? snapshotQuestion;
  return (
    <div className="grid gap-3 text-[13px]">
      {question.options.map((o) => {
        const n = results?.counts[o.id] ?? 0;
        return (
          <div key={o.id} className="grid grid-cols-[minmax(0,88px)_1fr_26px] items-center gap-2.5">
            <span className="flex items-center gap-1.5 truncate">
              {o.label}
              {yours === o.id && <span className="cap text-forms normal-case">you</span>}
            </span>
            <span className="h-2.5 overflow-hidden rounded-[2px] bg-line-2">
              <b
                className="block h-full rounded-[2px] bg-forms transition-[width] duration-700"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-xs text-mute">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- the form ---- */

type Sent = { event: SignedEvent; values: Record<string, string> };

/* The answers in the embedded form, as the SDK will submit them. */
function formValues(formEl: HTMLFormElement) {
  const values: Record<string, string> = {};
  new FormData(formEl).forEach((v, k) => {
    if (typeof v === "string" && v.trim()) values[k] = v.trim();
  });
  return values;
}

function DemoForm({
  live,
  onSent,
  onTouch,
  onDraft,
}: {
  live: LiveForm;
  onSent: (sent: Sent | null) => void;
  onTouch: () => void;
  /** Called as the answers change, so the event panel can show the response taking shape. */
  onDraft: (values: Record<string, string>) => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sent, setSent] = useState<Sent | null>(null);
  // React 19 re-applies dangerouslySetInnerHTML whenever the prop object
  // changes identity, which would wipe what someone has typed on every
  // re-render. Keep it stable until the form itself changes.
  const formHtml = useMemo(() => ({ __html: live.html }), [live.html]);

  // The embedded markup is the SDK's own; React only listens to it.
  const onSubmit = async (e: FormEvent<HTMLDivElement>) => {
    const formEl = e.target as HTMLFormElement;
    e.preventDefault();
    const values = formValues(formEl);
    const button = formEl.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = "Encrypting and sending…";
    }
    setState("sending");
    try {
      const [{ FormstrSDK }, nt] = await Promise.all([loadSdk(), import("nostr-tools")]);
      // The SDK's anonymous-response scheme, with the published results key
      // as the signer: encrypted to the form's pubkey, so the owner reads it
      // in Formstr as usual, and any browser can read it with the results key.
      const key = Uint8Array.from(DEMO_RESULTS_KEY.secret.match(/../g)!, (b) => parseInt(b, 16));
      const conv = (pub: string) => nt.nip44.v2.utils.getConversationKey(key, pub);
      const signer = {
        getPublicKey: async () => DEMO_RESULTS_KEY.pubkey,
        signEvent: async (ev: Parameters<typeof nt.finalizeEvent>[0]) => nt.finalizeEvent(ev, key),
        nip44Encrypt: async (pub: string, text: string) => nt.nip44.v2.encrypt(text, conv(pub)),
        nip44Decrypt: async (pub: string, text: string) => nt.nip44.v2.decrypt(text, conv(pub)),
      };
      const event = (await new FormstrSDK().submit(live.form as never, values, signer)) as SignedEvent;
      const next = { event, values };
      setSent(next);
      setState("sent");
      onSent(next);
    } catch {
      setState("error");
      if (button) {
        button.disabled = false;
        button.textContent = "Submit";
      }
    }
  };

  if (state === "sent" && sent) {
    return (
      <SentFlow
        sent={sent}
        form={live.form}
        onReset={() => {
          setSent(null);
          setState("idle");
          onSent(null);
        }}
      />
    );
  }

  return (
    <div className="rounded-md border border-line-2 border-t-4 border-t-forms bg-white px-7 py-[26px]">
      <div
        className="demo-form"
        onSubmit={onSubmit}
        onInput={(e) => {
          const formEl = (e.currentTarget as HTMLElement).querySelector("form");
          if (formEl) onDraft(formValues(formEl));
        }}
        onChange={(e) => {
          const formEl = (e.currentTarget as HTMLElement).querySelector("form");
          if (formEl) onDraft(formValues(formEl));
        }}
        // Warm the SDK as soon as someone starts filling the form in (and
        // tell the hero not to swap in a newer version under their fingers).
        onFocusCapture={() => {
          onTouch();
          void loadSdk();
        }}
        dangerouslySetInnerHTML={formHtml}
      />
      <p className="mt-4 flex items-center gap-1.5 text-xs text-mute">
        <Lock size={12} />
        {state === "error"
          ? "Couldn't reach the relays. Your answers are still here; try again."
          : "Encrypted in your browser before sending"}
      </p>
    </div>
  );
}

/* Read one event back from a relay by id (the round trip, done for real). */
function fetchFromRelay(relay: string, id: string, ms = 5000): Promise<SignedEvent | null> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    const done = (ev: SignedEvent | null) => {
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      resolve(ev);
    };
    const timer = setTimeout(() => done(null), ms);
    try {
      ws = new WebSocket(relay);
    } catch {
      return done(null);
    }
    ws.onopen = () => ws.send(JSON.stringify(["REQ", "check", { ids: [id] }]));
    ws.onmessage = (m) => {
      const [type, , ev] = JSON.parse(m.data);
      if (type === "EVENT") done(ev);
      if (type === "EOSE") done(null);
    };
    ws.onerror = () => done(null);
    ws.onclose = () => done(null);
  });
}

type Step = "pending" | "done" | "failed";

/* After submitting: the real round trip, step by step, then the live tally. */
function SentFlow({ sent, form, onReset }: { sent: Sent; form: FormShape; onReset: () => void }) {
  const relay = form.relays[0];
  const relayHost = relay.replace(/^wss:\/\//, "");
  const [stored, setStored] = useState<Step>("pending");
  const [answers, setAnswers] = useState<[string, string][] | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 2. Fetch it back from the relay (it may take a moment to land).
      let ev: SignedEvent | null = null;
      for (let i = 0; i < 4 && !ev && !cancelled; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1000));
        ev = await fetchFromRelay(relay, sent.event.id);
      }
      if (cancelled) return;
      setStored(ev ? "done" : "failed");
      // 3. Decrypt what the relay returned, with the published results key:
      //    exactly what any visitor's browser can do.
      const source = ev ?? sent.event;
      try {
        const tags = await decryptResponse(source);
        if (!cancelled)
          setAnswers(
            tags
              .filter((t) => t[0] === "response")
              .map(([, fid, v]) => [fieldsOf(form).find((f) => f.id === fid)?.labelHtml ?? fid, answerLabel(form, fid, v)]),
          );
      } catch {
        /* leave the step pending */
      }
      // 4. The live tally, until it counts this response.
      for (let i = 0; i < 6 && !cancelled; i++) {
        const r = await fetchResults(await currentFormEvent(), { includes: sent.event.id });
        if (cancelled) break;
        // A round where no relay answered just waits for the next one.
        if (r) setResults(r);
        if (r?.includes) break;
        await new Promise((res) => setTimeout(res, 2000));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [relay, sent, form]);

  const steps: [Step, string, ReactNode][] = [
    ["done", "Encrypted in your browser", <span className="font-mono">{clip(sent.event.content, 26)}</span>],
    [
      stored,
      `Stored on ${relayHost}`,
      stored === "failed" ? "Couldn't read it back yet" : <span className="font-mono">event {clip(sent.event.id, 12)}</span>,
    ],
    [
      answers ? "done" : "pending",
      "Decrypted with this page's results key",
      answers ? (
        <span className="grid gap-0.5 whitespace-normal">
          {answers.map(([q, a]) => (
            <span key={q}>
              {q} <span className="text-ink">{a}</span>
            </span>
          ))}
        </span>
      ) : null,
    ],
  ];

  return (
    <div className="rounded-md border border-line-2 border-t-4 border-t-forms bg-white px-7 py-[26px]" role="status">
      <p className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em]">
        <Check size={20} className="text-forms" /> Sent
      </p>
      <ol className="mt-5 grid gap-3.5">
        {steps.map(([st, title, detail], i) => (
          <li key={title} className="grid grid-cols-[16px_1fr] gap-x-2.5 text-[13.5px]">
            <span
              className={`marker mt-[2px] ${st === "pending" ? "!bg-line animate-pulse" : st === "failed" ? "!bg-faint" : ""}`}
            >
              {i + 1}
            </span>
            <span className="font-medium">{title}</span>
            {detail && <span className="col-start-2 mt-0.5 truncate text-[12.5px] text-mute">{detail}</span>}
          </li>
        ))}
      </ol>
      {results && (
        <div className="mt-6 border-t border-line-2 pt-5">
          <p className="mb-3 flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-medium">{results.question.label}</span>
            <span className="cap">
              {results.total} {results.total === 1 ? "response" : "responses"}
            </span>
          </p>
          <ResultBars results={results} yours={results.includes ? sent.values[results.question.id] : undefined} />
        </div>
      )}
      <button type="button" onClick={onReset} className="mt-6 border-b border-ink pb-0.5 text-sm font-medium">
        Send another
      </button>
    </div>
  );
}

/* The right-hand panel while someone fills the form in: the response event
   their answers become, before it's encrypted and signed. Numbered like the
   questions; choice answers show their label next to the stored id. */
function DraftListing({ values, form }: { values: Record<string, string>; form: FormShape }) {
  const s = (t: string) => <span className="s">"{t}"</span>;
  const k = (t: string) => <span className="k">"{t}"</span>;
  const fields = fieldsOf(form);
  const answered = fields.map((f, i) => ({ f, n: i + 1 })).filter(({ f }) => values[f.id]);
  return (
    <pre className="ev">
      {"{\n  "}
      {k("kind")}: <span className="num">1069</span>,{"\n  "}
      {k("pubkey")}: {s(clip(DEMO_RESULTS_KEY.pubkey, 24))},{"\n  "}
      {k("tags")}: [[{s("a")}, {s(clip(`30168:${form.pubkey}:${form.id}`, 26))}]],{"\n  "}
      {k("content")}: <span className="k">encrypt</span>([{"\n"}
      {answered.map(({ f, n }) => {
        const label = f.options?.length ? answerLabel(form, f.id, values[f.id]) : null;
        return (
          <span key={f.id}>
            <span className="hl">
              {"    ["}
              {s("response")}, {s(f.id)}, {s(clip(values[f.id], 28))}, {s("{}")}]
            </span>
            {label && <span className="k">{`  // ${label}`}</span>}
            {"  "}
            <span className="marker align-[1px]">{n}</span>
            {"\n"}
          </span>
        );
      })}
      {"  ]),\n  "}
      {k("sig")}: <span className="k">signed on submit</span>
      {"\n}"}
    </pre>
  );
}

/* The right-hand panel: the form event as fetched, or, once someone has
   submitted, their response exactly as the relays stored it. */
function EventListing({ event }: { event: SignedEvent }) {
  const s = (t: string) => <span className="s">"{t}"</span>;
  const k = (t: string) => <span className="k">"{t}"</span>;
  const num = (t: number) => <span className="num">{t}</span>;
  const fieldTags = event.tags.filter((t) => t[0] === "field");
  const shown = event.tags.filter((t) => ["d", "name", "a"].includes(t[0]));
  const relays = event.tags.filter((t) => t[0] === "relay");
  return (
    <pre className="ev">
      {"{\n  "}
      {k("kind")}: {num(event.kind)},{"\n  "}
      {k("pubkey")}: {s(clip(event.pubkey, 24))},{"\n  "}
      {k("created_at")}: {num(event.created_at)},{"\n  "}
      {k("tags")}: [{"\n"}
      {shown.map((t) => (
        <span key={t.join()}>
          {"    ["}
          {t.slice(0, 2).map((v, i) => (
            <span key={i}>
              {i ? ", " : ""}
              {s(clip(v, 40))}
            </span>
          ))}
          ],{"\n"}
        </span>
      ))}
      {fieldTags.map((t, i) => (
        <span key={t[1]}>
          <span className="hl">
            {"    ["}
            {s("field")}, {s(t[1])}, {s(t[2])}, {s(t[3])}, …]
          </span>
          {"  "}
          <span className="marker align-[1px]">{i + 1}</span>
          {"\n"}
        </span>
      ))}
      {relays.length > 0 && (
        <span>
          {"    ["}
          {s("relay")}, {s(relays[0][1])}], …{"\n"}
        </span>
      )}
      {"  ],\n"}
      {event.content && (
        <span>
          {"  "}
          {k("content")}: <span className="hl">{s(clip(event.content, 34))}</span>,{"\n"}
        </span>
      )}
      {"  "}
      {k("sig")}: {s(clip(event.sig, 16))}
      {"\n}"}
    </pre>
  );
}

function Hero() {
  const [sent, setSent] = useState<Sent | null>(null);
  const response = sent?.event ?? null;

  // The page ships a build-time snapshot of the form for an instant first
  // paint, then checks the relays for a newer version, so edits made in
  // Formstr show up without a redeploy. The check is one query per relay;
  // the SDK only loads if the form actually changed.
  const [live, setLive] = useState<LiveForm>(snapshot);
  const touched = useRef(false);
  const pending = useRef<LiveForm | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ev = await currentFormEvent();
      if (cancelled || ev === demoEvent) return;
      const { FormstrSDK } = await loadSdk();
      if (cancelled) return;
      const sdk = new FormstrSDK();
      const form = sdk.normalizeForm(sdkRawTags(ev));
      const html = enhanceFormHtml(sdk.renderHtml(form).html!.form, form as never);
      const next = { form: form as unknown as FormShape, html, event: ev };
      // Never swap the form out from under someone filling it in.
      if (touched.current) pending.current = next;
      else setLive(next);
    };
    const start = () => void check().catch(() => {});
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
    idle(start);
    return () => {
      cancelled = true;
    };
  }, []);
  // The answers so far, before submitting: the event panel shows the
  // response event taking shape as they change.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const drafting = !response && Object.keys(draft).length > 0;
  const onSent = (next: Sent | null) => {
    setSent(next);
    setDraft({});
    // "Send another": a newer version that arrived meanwhile takes over now.
    if (!next) {
      touched.current = false;
      if (pending.current) {
        setLive(pending.current);
        pending.current = null;
      }
    }
  };
  return (
    <div className="sheet">
      <Row className="pt-16 pb-16 lg:pt-24">
        <div className="mb-10 hidden justify-between lg:col-span-12 lg:flex">
          <span className="cap">Formstr · open-source work tools on Nostr</span>
          <span className="cap">Forms · Calendar · Pages · Drive · Mailstr</span>
        </div>
        <span className="cap mb-6 lg:hidden">Formstr · open-source work tools on Nostr</span>

        <h1 className="text-[44px] font-semibold leading-[1] tracking-[-0.04em] text-balance sm:text-[64px] lg:col-span-10 lg:text-[88px]">
          Work tools for people and their agents.
        </h1>
        <p className="mt-8 text-[17px] leading-[1.6] text-ink-2 sm:text-[19px] lg:col-span-6 lg:mt-9">
          Forms, documents, calendars, files and email, built on Nostr, an open protocol. Your work is signed with your
          key and encrypted on your device. The people and AI agents you trust can work with it directly. There are no
          API keys to provision and no integrations to maintain.
        </p>
        <div className="mt-8 flex flex-col gap-3 self-end lg:col-span-5 lg:col-start-8 lg:mt-0">
          <a
            href="#suite"
            className="inline-flex h-[42px] items-center justify-between rounded-[4px] bg-ink px-[18px] text-[14.5px] font-medium text-white"
          >
            Explore the suite <ArrowDown size={16} />
          </a>
          <CopyCommand />
        </div>

        <figure className="mt-16 lg:col-span-12 lg:mt-[72px]">
          <div className="grid border border-line bg-sheet lg:grid-cols-2 [&>*]:min-w-0">
            <div className="p-5 pl-10 sm:p-8 sm:pl-12">
              <div className="mb-[22px] flex justify-between gap-4">
                <span className="cap">What a person sees</span>
              </div>
              <DemoForm live={live} onSent={onSent} onTouch={() => (touched.current = true)} onDraft={setDraft} />
            </div>
            <div className="relative border-t border-line bg-night p-5 sm:p-8 lg:border-t-0 lg:border-l">
              <span className="absolute top-0 left-1/2 z-10 grid h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper font-mono text-[13px] lg:top-1/2 lg:left-0">
                =
              </span>
              <div className="mb-[22px] flex justify-between gap-4" aria-live="polite">
                <span className="cap text-night-mute">
                  {response ? "What the relays received" : drafting ? "What you're about to send" : "What an agent reads"}
                </span>
                <span className="cap text-night-mute">
                  {response ? "kind 1069 · encrypted" : drafting ? "kind 1069 · draft" : "kind 30168 · signed"}
                </span>
              </div>
              {drafting ? <DraftListing values={draft} form={live.form} /> : <EventListing event={response ?? live.event} />}
            </div>
          </div>
          <Figcap>
            {response
              ? "Your response, as stored: ciphertext the form's owner opens in Formstr. This demo also publishes a key that opens it, so every visitor's browser can tally results live."
              : drafting
                ? "Your answers, as the response event they become: one tag per question, encrypted and signed when you submit."
                : "One form, two readers. People get a form. Agents get the signed event it's made of, in a public format any Nostr client can parse, with no Formstr API in between."}
          </Figcap>
        </figure>
      </Row>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — Suite                                                          */
/* ------------------------------------------------------------------ */

type EntryProps = {
  color: string;
  kindLabel: string;
  kinds: string;
  name: string;
  body: string;
  specs: [string, string][];
  url: string;
  plate: ReactNode;
  flush?: boolean;
};

function Entry({ color, kindLabel, kinds, name, body, specs, url, plate, flush }: EntryProps) {
  return (
    <Row className="items-start border-t border-line pt-10 pb-16 first-of-type:border-t-0 lg:pb-[72px]">
      <div className="lg:sticky lg:top-[100px] lg:col-span-3" style={{ "--c": color } as CSSProperties}>
        <div className="cap flex items-center gap-2">
          <i className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
          {kindLabel}
        </div>
        <p className="mt-1.5 font-mono text-[15px]" style={{ color }}>
          {kinds}
        </p>
        <h3 className="mt-6 text-[30px] font-semibold tracking-[-0.028em] lg:mt-7 lg:text-[34px]">{name}</h3>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{body}</p>
        <dl className="mt-5 text-[13px]">
          {specs.map(([dt, dd]) => (
            <div key={dt} className="flex justify-between gap-3 border-t border-line py-2.5">
              <dt className="text-mute">{dt}</dt>
              <dd className="text-right font-mono text-[12.5px]">{dd}</dd>
            </div>
          ))}
        </dl>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1 border-b border-ink pb-0.5 text-sm font-medium"
        >
          Open {name} <ArrowUpRight size={14} />
        </a>
      </div>
      <figure className="mt-8 lg:col-span-9 lg:mt-0">
        <div className={`overflow-hidden border border-line bg-sheet ${flush ? "pt-6 pl-6 sm:pt-10 sm:pl-10" : "p-4 sm:p-10"}`}>
          {plate}
        </div>
      </figure>
    </Row>
  );
}

/* The Formstr plate: the example form's real responses, tallied live by
   /api/results (counts and times only; free text is never shown). Refreshes
   every 30 s while on screen. */
function FormsPlate() {
  const ref = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const now = useNow();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let retried = false;
    const load = async (): Promise<void> => {
      const r = await fetchResults(await currentFormEvent());
      // A refresh where no relay answered keeps the last good numbers.
      if (r) setResults(r);
      setUnavailable(!r);
      // Relays are flaky: if the very first look fails, try once more soon.
      if (!r && !retried) {
        retried = true;
        setTimeout(() => void load(), 3000);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) {
        void load();
        timer = setInterval(load, 30_000);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, []);

  const total = results?.total ?? 0;
  return (
    <div ref={ref}>
      <Win url="formstr.app / site-visit-feedback / responses">
        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-6">
            <h5 className="text-[15px] font-semibold">{(results?.question ?? snapshotQuestion).label}</h5>
            <span className="cap">
              {results
                ? total
                  ? `${total} ${total === 1 ? "response" : "responses"} · live`
                  : "No responses yet"
                : unavailable
                  ? "Results unavailable right now"
                  : "Loading results…"}
            </span>
            <div className="mt-5">
              <ResultBars results={results} />
            </div>
          </div>
          <div className="border-t border-line-2 px-6 py-4 text-[13px] sm:border-t-0 sm:border-l">
            <p className="cap mb-1">Latest</p>
            {results?.recent.length ? (
              results.recent.slice(0, 4).map((r, i) => (
                <div key={`${r.at}-${i}`} className={`flex justify-between gap-3 py-2.5 ${i ? "border-t border-line-2" : ""}`}>
                  <span className="flex items-center gap-2">
                    <i className="h-2 w-2 rounded-full bg-forms" />
                    {(results.question.options.find((o) => o.id === r.choice) ?? { label: r.choice }).label}
                  </span>
                  <small className="font-mono text-[11.5px] text-mute">{now ? ago(r.at, now) : ""}</small>
                </div>
              ))
            ) : (
              <p className="py-2.5 leading-relaxed text-ink-2">
                Nothing yet. The form at the top of this page is this one:{" "}
                <a href="#" className="underline underline-offset-4">
                  answer it
                </a>{" "}
                and watch it land here.
              </p>
            )}
          </div>
        </div>
      </Win>
    </div>
  );
}

function PagesPlate() {
  return (
    <Win url="pages.formstr.app / q4-supplier-review">
      <div className="px-6 pt-8 pb-10 text-[15px] leading-[1.7] text-ink-2 sm:px-14">
        <div className="mb-6 flex items-center justify-between">
          <span className="cap">Encrypted · shared with 2</span>
          <div className="flex">
            {[
              ["PS", "#10b981"],
              ["AI", "#0b0b0c"],
              ["DO", "#3b82f6"],
            ].map(([t, bg]) => (
              <span
                key={t}
                className="-ml-1.5 grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-white font-mono text-[10px] font-semibold text-white"
                style={{ background: bg }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <h4 className="mb-3.5 text-[28px] font-semibold tracking-[-0.02em] text-ink">Q4 supplier review</h4>
        <p>
          Three of our five suppliers met every delivery window this quarter. Two slipped by more than a week, both during
          the port strike in November.
        </p>
        <p className="cap mt-6 mb-1.5">Actions</p>
        <ul className="list-disc pl-[18px] leading-[2.1]">
          <li>
            Renew the Halden contract on current terms{" "}
            <span className="caret" style={{ "--c": "#10b981" } as CSSProperties}>
              <b>Priya</b>
            </span>
          </li>
          <li>
            <span className="bg-ink/10">Ask Norvik for a revised lead-time commitment</span>{" "}
            <span className="caret" style={{ "--c": "#0b0b0c" } as CSSProperties}>
              <b>Agent · drafting</b>
            </span>
          </li>
          <li>Send the site-visit feedback summary to facilities</li>
        </ul>
      </div>
    </Win>
  );
}

function DrivePlate() {
  const files = [
    ["Halden-contract-2027.pdf", "PDF", "#e5484d", "1.8 MB", "blossom.yourco.internal", "Oct 21"],
    ["q4-deliveries.xlsx", "XLS", "#10b981", "412 KB", "blossom.yourco.internal", "Oct 20"],
    ["site-visit-photos.zip", "ZIP", "#8b5cf6", "58.6 MB", "nostr.download", "Oct 18"],
    ["badge-process.md", "DOC", "#3b82f6", "4 KB", "blossom.yourco.internal", "Oct 17"],
  ];
  return (
    <Win url="drive.formstr.app">
      <div className="flex justify-between border-b border-line-2 px-[22px] py-4 text-[13.5px] text-mute">
        <span>
          My Drive / <b className="font-semibold text-ink">Operations</b>
        </span>
        <span className="font-mono text-xs">4 items · 61.2 MB</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px] whitespace-nowrap">
          <thead>
            <tr>
              {["Name", "Size", "Stored on", "Modified"].map((h) => (
                <th key={h} className="cap border-b border-line-2 px-[22px] py-2.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map(([name, x, c, size, where, at]) => (
              <tr key={name}>
                <td className="border-b border-line-2 px-[22px] py-3">
                  <span className="flex items-center gap-3">
                    <span className="ficon" data-x={x} style={{ "--c": c } as CSSProperties} />
                    {name}
                  </span>
                </td>
                <td className="border-b border-line-2 px-[22px] py-3 font-mono text-[12.5px] text-ink-2">{size}</td>
                <td className="border-b border-line-2 px-[22px] py-3 font-mono text-[12.5px] text-ink-2">{where}</td>
                <td className="border-b border-line-2 px-[22px] py-3 font-mono text-[12.5px] text-ink-2">{at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Win>
  );
}

function ShotPlate({ url, src, alt, w, h }: { url: string; src: string; alt: string; w: number; h: number }) {
  return (
    <Win url={url} flush>
      <img src={src} alt={alt} width={w} height={h} loading="lazy" className="block h-auto w-full" />
    </Win>
  );
}

function Suite() {
  return (
    <section id="suite" className="border-t border-line">
      <div className="sheet py-24 lg:py-[120px]">
        <SectionHead
          no="01 — The suite"
          title="Five apps. One key. Everything in an open format."
          lede="Each app stands on its own. They share an identity and a data format, so they also work together, and with anything else that speaks Nostr. Each one is listed with the event kinds it stores your work as."
        />
        <Entry
          color="var(--color-forms)"
          kindLabel="Forms"
          kinds="kind 30168 · 1069"
          name="Formstr"
          body="Surveys and forms with end-to-end encrypted responses, anonymous submissions and AI-assisted building. Only you and the people you add can read the answers."
          specs={[
            ["Address", "formstr.app"],
            ["Responses", "NIP-44 encrypted"],
            ["Source", "nostr-forms · MIT"],
          ]}
          url="https://formstr.app"
          plate={<FormsPlate />}
        />
        <Entry
          color="var(--color-cal)"
          kindLabel="Calendar"
          kinds="kind 31923 · 32678 private"
          name="Calendar"
          body="Events, RSVPs, recurring schedules and booking pages. Private events are encrypted; public ones can be shared with anyone on Nostr."
          specs={[
            ["Address", "calendar.formstr.app"],
            ["Sign-in", "extension · NIP-46"],
            ["Source", "nostr-calendar · MIT"],
          ]}
          url="https://calendar.formstr.app"
          flush
          plate={
            <ShotPlate
              url="calendar.formstr.app"
              src="/images/previews/calendar.webp"
              alt="Formstr Calendar, month view"
              w={1440}
              h={900}
            />
          }
        />
        <Entry
          color="var(--color-pages)"
          kindLabel="Documents"
          kinds="kind 33457"
          name="Pages"
          body="Documents and notes in Markdown, encrypted by default, with live editing for everyone you share with, people and agents alike."
          specs={[
            ["Address", "pages.formstr.app"],
            ["Collaboration", "real-time · multi-writer"],
            ["Source", "nostr-docs"],
          ]}
          url="https://pages.formstr.app"
          plate={<PagesPlate />}
        />
        <Entry
          color="var(--color-drive)"
          kindLabel="Files"
          kinds="kind 34578"
          name="Drive"
          body="File storage where Nostr keeps the index and Blossom servers you choose keep the bytes. Use a public server, or run one inside your own network."
          specs={[
            ["Address", "drive.formstr.app"],
            ["Storage", "Blossom · your choice"],
            ["Source", "formstr-drive · MIT"],
          ]}
          url="https://drive.formstr.app"
          plate={<DrivePlate />}
        />
        <Entry
          color="var(--color-mail)"
          kindLabel="Email"
          kinds="kind 1301 · gift-wrapped"
          name="Mailstr"
          body="A real email address for your Nostr key. Mail sent to you@mailstr.app arrives encrypted to your key and opens in Mailstr or any compatible client."
          specs={[
            ["Address", "mailstr.app"],
            ["Delivery", "NIP-59 gift wrap"],
            ["Source", "nail · MIT"],
          ]}
          url="https://mailstr.app"
          flush
          plate={
            <ShotPlate url="mailstr.app / inbox" src="/images/previews/mailstr.webp" alt="Mailstr inbox" w={1280} h={800} />
          }
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Agents                                                         */
/* ------------------------------------------------------------------ */

function canRender3D() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* The agent figure. The robot still is the figure; the live 3D scene is an
   enhancement layered over it. The scene is only downloaded once the figure
   nears the viewport (and only for visitors who can and want to run it). It
   fades in once it has drawn, and if anything goes wrong (the chunk fails to
   load, or the WebGL context is lost) it's removed and the still remains.

   The canvas gets its own React root, outside <StrictMode>: StrictMode
   remounts components once in development, and react-three-fiber answers an
   unmount by forcing the WebGL context lost 500 ms later, even when the same
   canvas has already remounted. That left a dead canvas in dev. */
function AgentFigure() {
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLAnchorElement>(null);
  // Where the robot looks when you're not interacting: its current thought.
  const gaze = useRef<Point | null>(null);
  const [live, setLive] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [thought, setThought] = useState(0);
  const [paused, setPaused] = useState(false);

  // Think the next thought every few seconds, while the figure is on screen
  // and not being hovered or focused (so a bubble never changes under the
  // pointer). Reduced motion keeps the first thought still.
  useEffect(() => {
    if (!onScreen || paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setThought((t) => (t + 1) % thoughts.length), THOUGHT_MS);
    return () => clearInterval(id);
  }, [onScreen, paused]);

  // Point the robot's gaze at the bubble's tail, just above its head.
  useEffect(() => {
    const s = stage.current?.getBoundingClientRect();
    const b = bubble.current?.getBoundingClientRect();
    if (!s || !b) return;
    gaze.current = {
      x: ((b.left + b.width * 0.15 - s.left) / s.width) * 2 - 1,
      y: -((b.bottom - s.top) / s.height) * 2 + 1,
    };
  }, [thought]);

  useEffect(() => {
    const el = stage.current;
    const mountEl = host.current;
    if (!el || !mountEl || typeof IntersectionObserver === "undefined") return;
    const can3D = canRender3D();

    let root: Root | null = null;
    let render: ((active: boolean) => void) | null = null;
    let visible = false;
    let stopped = false;

    const stop = () => {
      stopped = true;
      setLive(false);
      // Let the still fade back in before the canvas disappears.
      setTimeout(() => root?.unmount(), 500);
    };

    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || !can3D) return;
        near.disconnect();
        import("./three/AgentScene")
          .then(({ default: AgentScene }) => {
            if (stopped) return;
            root = createRoot(mountEl);
            render = (active) =>
              root!.render(
                <AgentScene active={active} gaze={gaze} onReady={() => setLive(true)} onLost={stop} />,
              );
            render(visible);
          })
          .catch(() => {
            // Chunk failed to load: the still simply stays.
          });
      },
      { rootMargin: "400px" },
    );
    // Only animate while the figure is on screen.
    const watch = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      setOnScreen(visible);
      if (!stopped) render?.(visible);
    });
    near.observe(el);
    watch.observe(el);
    return () => {
      stopped = true;
      near.disconnect();
      watch.disconnect();
      root?.unmount();
    };
  }, []);

  return (
    <figure className="lg:col-span-5">
      <div
        ref={stage}
        data-figure="agent"
        data-live={live ? "" : undefined}
        className="stage relative h-[440px] overflow-hidden border border-night-line lg:h-[520px]"
      >
        <img
          src="/images/agent-poster.webp"
          alt="Formstr's agent mascot, a small white robot, waving"
          width={600}
          height={780}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
            live ? "opacity-0" : "opacity-100"
          }`}
        />
        <div
          ref={host}
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-500 ${live ? "opacity-100" : "opacity-0"}`}
        />
        {/* The thought: a link to the app it offers to use. Re-keyed per
            thought so it re-plays its entrance. */}
        <a
          ref={bubble}
          key={thought}
          href={thoughts[thought].url}
          target="_blank"
          rel="noopener noreferrer"
          data-thought={thoughts[thought].app}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="thought group absolute top-[4%] left-[38%] z-10 max-w-[60%] sm:top-[13%] sm:left-[40%] sm:max-w-[56%]"
        >
          <span className="thought-dot absolute -bottom-[14px] left-[12%] h-[11px] w-[11px] rounded-full bg-white" />
          <span className="thought-dot absolute -bottom-[27px] left-[5%] h-[7px] w-[7px] rounded-full bg-white [animation-delay:60ms]" />
          <span className="thought-body block rounded-[16px] bg-white px-4 pt-2.5 pb-2 text-ink shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)] [animation-delay:120ms]">
            <span className="block text-[15px] leading-snug font-medium">{thoughts[thought].text}</span>
            <span className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.06em] text-mute uppercase">
              <i className="h-1.5 w-1.5 rounded-full" style={{ background: thoughts[thought].color }} />
              Open {thoughts[thought].app}
              <ArrowUpRight size={11} className="transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
            </span>
          </span>
        </a>
        <span className="cap absolute bottom-3.5 left-4">Your agent</span>
        <span className="cap absolute right-4 bottom-3.5 normal-case">npub1ag3…k9qz</span>
      </div>
      <Figcap>
        Your agent, with an identity of its own. Every action it takes is signed by its key, so you can always tell
        its work from yours.
      </Figcap>
    </figure>
  );
}

function Session() {
  const tools: [string, string, string, boolean][] = [
    ["create_calendar_event", "#7fb0ff", "Supplier workshop · Thu 10:00", true],
    ["create_form", "#ffa36b", "Workshop feedback · 5 questions", true],
    ["send_mail", "#ff8a8d", "14 recipients", false],
  ];
  return (
    <figure className="mt-8 flex flex-col lg:col-span-7 lg:mt-0">
      <div className="flex flex-1 flex-col border border-night-line bg-night-2 font-mono text-[13px] leading-[1.75] text-[#c9c9c5] sm:text-[13.5px]">
        <div className="flex h-[38px] items-center gap-[18px] border-b border-night-line px-4 text-[11.5px] text-night-mute">
          <span className="text-night-text">session</span>
          <span>mcp.json</span>
        </div>
        <div className="flex-1 overflow-x-auto px-6 py-[22px]">
          <div>
            <span className="text-[#6d6d6a]">$</span> <span className="text-[#f1f1ee]">{MCP_CMD} login</span>
          </div>
          <div className="text-[#6d6d6a]">? Sign in with › Create a new key</div>
          <div>
            <span className="text-[#57c785]">✓</span> New identity npub1ag3…k9qz, stored encrypted in the keystore.
          </div>
          <div className="my-4 border-t border-dashed border-[#2a2a2a]" />
          <div className="grid grid-cols-[auto_1fr] gap-x-3">
            <span className="text-[#6d6d6a]">you ›</span>
            <span className="text-[#f1f1ee]">
              Put Thursday's supplier workshop on my calendar, make a feedback form for it, and email the link to
              everyone who's attending.
            </span>
          </div>
          <div className="my-4 border-t border-dashed border-[#2a2a2a]" />
          {tools.map(([name, c, what, done]) => (
            <div key={name} className="grid grid-cols-[minmax(0,190px)_1fr_auto] gap-3.5 whitespace-nowrap">
              <span style={{ color: c }}>{name}</span>
              <span className="truncate text-[#6d6d6a]">{what}</span>
              <span className={done ? "text-[#57c785]" : "text-[#e8b04b]"}>{done ? "done" : "needs your OK"}</span>
            </div>
          ))}
        </div>
      </div>
      <Figcap>
        Creating things is on by default. Sending, sharing, editing and deleting wait for{" "}
        <span className="font-mono">--allow-writes</span> and an explicit confirmation.
      </Figcap>
    </figure>
  );
}

function Agents() {
  const specs: [string, ReactNode][] = [
    [
      "Its own key",
      "An agent can create its own identity, stored NIP-49 encrypted in the OS keychain, or act for you through a remote signer (NIP-46).",
    ],
    [
      "Guardrails",
      <>
        Outward and destructive actions need <code className="font-mono text-[12.5px] text-night-text">--allow-writes</code>{" "}
        and <code className="font-mono text-[12.5px] text-night-text">confirm: true</code>.
      </>,
    ],
    ["Any model", "Works with any MCP host, including local models through Goose and Ollama."],
    [
      "Install",
      <>
        <code className="font-mono text-[12.5px] text-night-text">{MCP_CMD}</code>
        <br />
        <a href={NPM_MCP} target="_blank" rel="noopener noreferrer" className="underline decoration-night-line underline-offset-4 hover:text-night-text">
          npm
        </a>{" "}
        ·{" "}
        <a href={AGENTS_MD} target="_blank" rel="noopener noreferrer" className="underline decoration-night-line underline-offset-4 hover:text-night-text">
          AGENTS.md
        </a>{" "}
        ·{" "}
        <a href="/llms.txt" className="underline decoration-night-line underline-offset-4 hover:text-night-text">
          llms.txt
        </a>
      </>,
    ],
  ];
  return (
    <section id="agents" className="night bg-night text-night-text">
      <div className="sheet py-24 lg:py-[120px]">
        <SectionHead no="02 — Agents" title="Agents don't need an integration. They can generate their own key." />
        <Row>
          <div className="grid gap-[18px] text-[17px] leading-[1.65] text-[#b9b9b5] lg:col-span-6 lg:col-start-4 lg:-mt-6">
            <p>
              Most software keeps programs out until someone signs off: a developer account, an API key, a review, a
              scope. Nostr doesn't work that way. Every app reads and writes the same signed events over the same open
              protocol, so an agent with a key can do what any other client does. It can read a form's responses, put a
              meeting on a calendar or edit a shared document. And it doesn't have to wait to be issued that key: it
              can create its own identity in one step, or act for you through a remote signer.
            </p>
            <p>
              <span className="font-mono text-[#f1f1ee]">@formstr/mcp</span> packages that for MCP hosts such as
              Claude, Cursor and Goose: more than seventy tools across the suite, set up with one command.
            </p>
          </div>
        </Row>
        <Row className="mt-14 items-stretch lg:mt-[72px]">
          <AgentFigure />
          <Session />
        </Row>
        <Row className="mt-14">
          <div className="grid gap-x-6 border-t border-night-line sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
            {specs.map(([h, p]) => (
              <div key={h} className="pt-[22px]">
                <h4 className="mb-2 text-[15px] font-semibold text-[#f1f1ee]">{h}</h4>
                <p className="text-sm leading-relaxed text-[#a3a3a0]">{p}</p>
              </div>
            ))}
          </div>
        </Row>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Storage                                                        */
/* ------------------------------------------------------------------ */

/* Where data can live, ordered by how much of it you run yourself. Every
   option stores the same thing (ciphertext and a signature), which is the
   point the figure makes: pick any, the last row never changes. */
type StorageChoice = {
  id: string;
  name: string;
  line: string;
  dest: string; // what the destination box shows
  host: string;
  where: string;
  sent: boolean; // does anything leave the device?
};
const storageChoices: StorageChoice[] = [
  {
    id: "device",
    name: "On this device",
    line: "Nothing is published. Your work stays in the browser's local store.",
    dest: "Nothing sent",
    host: "You",
    where: "This device",
    sent: false,
  },
  {
    id: "self",
    name: "Your own relay",
    line: "Run a relay on your own servers: your network, your jurisdiction, your retention rules.",
    dest: "relay.yourco.internal",
    host: "You",
    where: "Your infrastructure",
    sent: true,
  },
  {
    id: "public",
    name: "Relays you choose",
    line: "Any Nostr relays you trust, mixed and matched, for redundancy.",
    dest: "relay.damus.io · nos.lol · …",
    host: "Operators you pick",
    where: "Wherever they run",
    sent: true,
  },
  {
    id: "formstr",
    name: "Formstr Relay",
    line: "We host it, if you'd rather not run anything yourself.",
    dest: "relay.formstr.app",
    host: "Formstr",
    where: "Formstr infrastructure",
    sent: true,
  },
];

function Storage() {
  const [pick, setPick] = useState("self");
  const c = storageChoices.find((s) => s.id === pick)!;
  const rows: [string, ReactNode][] = [
    ["Hosted by", c.host],
    ["Lives in", c.where],
    ["Leaves your device", c.sent ? "Encrypted" : "No"],
    // The constant: whichever option you pick, this row never changes.
    ["Who can read it", <b key="r">Only you, and people you share with</b>],
  ];
  return (
    <section id="storage" className="border-t border-line">
      <div className="sheet py-24 lg:py-[120px]">
        <SectionHead
          no="03 — Storage"
          title="Hosted or self-hosted. Encrypted either way."
          lede="You decide where your work lives: on your device, on a relay you run, on relays you pick, or on ours. Whichever you choose, it's encrypted on your device first, so the host only ever stores ciphertext."
        />
        <Row className="items-stretch">
          <figure className="lg:col-span-12">
            <div className="grid border border-line bg-sheet lg:grid-cols-12">
              {/* The choice */}
              <fieldset className="border-b border-line p-6 lg:col-span-5 lg:border-r lg:border-b-0 lg:p-8">
                <legend className="cap float-left mb-5 w-full">Where should your work live?</legend>
                <div className="clear-both grid gap-2">
                  {storageChoices.map((s) => (
                    <label
                      key={s.id}
                      className="group relative block cursor-pointer rounded-[6px] border border-line bg-white px-4 py-3.5 transition-colors hover:border-faint has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
                    >
                      <input
                        type="radio"
                        name="storage"
                        value={s.id}
                        checked={pick === s.id}
                        onChange={() => setPick(s.id)}
                        className="peer sr-only"
                      />
                      <span className="flex items-center gap-3">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px] border-faint peer-checked:border-ink group-has-[:checked]:border-ink">
                          <span className="h-2 w-2 scale-0 rounded-full bg-ink transition-transform group-has-[:checked]:scale-100" />
                        </span>
                        <span className="text-[15px] font-semibold">{s.name}</span>
                      </span>
                      <span className="mt-1 block pl-7 text-[13.5px] leading-snug text-mute">{s.line}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-5 text-[13px] leading-relaxed text-mute">
                  New accounts start with a default list, the Formstr Relay plus public relays. Change it in any app's
                  settings.
                </p>
              </fieldset>

              {/* What happens */}
              <div className="flex flex-col p-6 lg:col-span-7 lg:p-8" aria-live="polite">
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
                  <div className="rounded-[6px] border border-line bg-white p-4">
                    <span className="cap">Your device</span>
                    <p className="mt-2 flex items-center gap-2 text-[14px] font-medium">
                      <Lock size={14} /> Encrypts with your key
                    </p>
                  </div>
                  {/* On phones the diagram runs top to bottom: a short connector. */}
                  <div className="flex h-8 justify-center sm:hidden" aria-hidden="true">
                    <span className={`border-l ${c.sent ? "border-ink" : "border-dashed border-faint"}`} />
                  </div>
                  {/* The wire. Re-keyed per choice so the packet travels again. */}
                  <div key={c.id} className="relative hidden h-6 w-24 sm:block" aria-hidden="true">
                    <span
                      className={`absolute top-1/2 right-0 left-0 border-t ${
                        c.sent ? "border-ink" : "border-dashed border-faint"
                      }`}
                    />
                    {c.sent && (
                      <span className="packet absolute top-1/2 left-0 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-ink text-white">
                        <Lock size={11} />
                      </span>
                    )}
                  </div>
                  <div
                    className={`rounded-[6px] border p-4 transition-colors ${
                      c.sent ? "border-ink bg-white" : "border-dashed border-faint"
                    }`}
                  >
                    <span className="cap">{c.sent ? "Stored on" : "Network"}</span>
                    <p className="mt-2 truncate font-mono text-[13px]">{c.dest}</p>
                  </div>
                </div>

                <dl className="mt-8 border-t border-ink">
                  {rows.map(([dt, dd]) => (
                    <div key={dt} className="grid grid-cols-[auto_1fr] gap-4 border-b border-line py-3 text-[14.5px]">
                      <dt className="cap pt-0.5">{dt}</dt>
                      <dd className="m-0 text-right">{dd}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 rounded-[6px] bg-night p-4 font-mono text-[12px] leading-relaxed break-all text-night-mute lg:mt-auto">
                  <span className="text-night-text">{c.sent ? `On ${c.dest.split(" ")[0]}:` : "In the local store:"}</span>
                  <br />
                  "content": "AgT7x9Qd2Kf8mPz1rR4vN6wYbH3eL0cJs5Uo9aZ…8B=="
                </div>
              </div>
            </div>
            <Figcap>
              Pick any option: what gets stored is the same ciphertext, readable only with your key. You can mix
              options, too, such as your own relay plus a public one for redundancy.
            </Figcap>
          </figure>
        </Row>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Security                                                       */
/* ------------------------------------------------------------------ */

function Security() {
  const code = (t: string) => <code className="font-mono text-[13px] text-ink">{t}</code>;
  const rows: [string, ReactNode][] = [
    ["Identity", <>A key pair, not an account. Sign in with a browser extension, a remote signer ({code("NIP-46")}) or a local key.</>],
    ["Encryption", <>{code("NIP-44")}, performed on your device. Shared items are delivered with {code("NIP-59")} gift wraps.</>],
    [
      "Data location",
      <>
        Hosted, self-hosted or on your device. See{" "}
        <a href="#storage" className="underline underline-offset-4">
          Storage
        </a>
        .
      </>,
    ],
    ["Files", "Blossom servers you choose, public or self-hosted."],
    ["Audit trail", "Every change is a signed event. Each one says which key, person or agent, made it."],
    [
      "Tracking",
      <>
        No analytics and no advertising.{" "}
        <a href="/privacy-policy" className="underline underline-offset-4">
          Privacy policy
        </a>
      </>,
    ],
  ];
  return (
    <section id="security">
      <div className="sheet py-24 lg:py-[120px]">
        <SectionHead
          no="04 — Security"
          title="Security you can check, not just trust."
          lede="Encryption happens in your browser before anything is sent. Relays store ciphertext and signatures. They can't read your content, and neither can we. The code that does this is open for your security team to review."
        />
        <Row className="items-start">
          <dl className="border-t border-ink lg:col-span-6">
            {rows.map(([dt, dd]) => (
              <div key={dt} className="grid gap-1 border-b border-line py-4 text-[15px] leading-normal sm:grid-cols-[150px_1fr] sm:gap-5">
                <dt className="cap pt-[3px]">{dt}</dt>
                <dd className="m-0 text-ink-2">{dd}</dd>
              </div>
            ))}
          </dl>
          <figure className="mt-12 lg:col-span-5 lg:col-start-8 lg:mt-0">
            <div className="border border-line bg-sheet">
              <div className="px-[22px] py-5">
                <span className="cap">On the relay · kind 1069</span>
                <pre className="mt-2.5 font-mono text-xs leading-[1.65] break-all whitespace-pre-wrap text-faint">
                  "content": "AgT7x9Qd2Kf8mPz1rR4vN6wYbH3eL0cJs5Uo9aZqW1tE8yRbN2mKc4Vh7LpXs0dF3gJ6nQ9uY2iO5wT8rA1zC4vB7eH0kM3pS6…8B=="
                </pre>
              </div>
              <div className="border-t border-dashed border-line bg-white px-[22px] py-5">
                <span className="cap text-ink">On the owner's device</span>
                <div className="mt-3 grid gap-2.5 text-[13.5px]">
                  <div>
                    <span className="block text-xs text-mute">How was the visit?</span>Smooth
                  </div>
                  <div>
                    <span className="block text-xs text-mute">What should we change?</span>Badge pickup took twenty
                    minutes. Could the passes be ready the day before?
                  </div>
                </div>
              </div>
            </div>
            <Figcap>A form response as stored and as read. Only the form owner's key turns one into the other.</Figcap>
          </figure>
        </Row>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — Source                                                         */
/* ------------------------------------------------------------------ */

function Source() {
  const cols = "grid grid-cols-[1fr_auto_20px] gap-6 sm:grid-cols-[2.2fr_3fr_0.8fr_1.2fr_20px]";
  return (
    <section id="source" className="border-t border-line">
      <div className="sheet py-24 lg:py-[120px]">
        <SectionHead
          no="05 — Source"
          title="Built in public, from the first commit."
          lede="Every app is open source and developed in the open on GitHub. Read the code, file an issue or run it yourself."
        />
        <Row>
          <div className="border-t border-ink lg:col-span-12">
            <div className={`${cols} cap py-3`}>
              <span>Repository</span>
              <span className="hidden sm:block">What it is</span>
              <span>Stars</span>
              <span className="hidden sm:block">Last commit</span>
              <span />
            </div>
            {repos.map((r) => {
              const s = stats[r.name];
              return (
                <a
                  key={r.name}
                  href={`${GITHUB}/${r.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${cols} items-baseline border-t border-line py-[18px] text-[15px] transition-colors hover:bg-sheet`}
                >
                  <span className="flex items-baseline font-mono text-[14.5px]">
                    <i className="mr-2.5 inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: r.color }} />
                    {r.name}
                  </span>
                  <span className="hidden text-ink-2 sm:block">{r.what}</span>
                  <span className="font-mono text-[13px] text-mute">{s ? s.stars : "—"}</span>
                  <span className="hidden font-mono text-[13px] text-mute sm:block">{s ? fmtDate(s.pushedAt) : "—"}</span>
                  <ArrowUpRight size={15} className="text-mute" />
                </a>
              );
            })}
          </div>
        </Row>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Close + footer                                                      */
/* ------------------------------------------------------------------ */

function Close() {
  return (
    <section className="border-t border-line">
      <div className="sheet pt-28 pb-20 lg:pt-[140px] lg:pb-24">
        <Row>
          <h2 className="text-[44px] font-semibold leading-none tracking-[-0.04em] sm:text-[60px] lg:col-span-9 lg:text-[72px]">
            Bring Formstr to your organization.
          </h2>
          <div className="mt-10 flex flex-col gap-8 lg:col-span-12 lg:mt-12 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[520px] text-[17px] leading-relaxed text-ink-2 lg:text-lg">
              We'll walk your team through the architecture, the security model and running your own relays and
              storage.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={CONTACT} className="inline-flex h-[42px] items-center rounded-[4px] bg-ink px-[18px] text-[14.5px] font-medium text-white">
                hello@formstr.app
              </a>
              <a href="#suite" className="inline-flex h-[42px] items-center rounded-[4px] border border-ink px-[18px] text-[14.5px] font-medium">
                Try the apps
              </a>
            </div>
          </div>
        </Row>
      </div>
    </section>
  );
}

export function Footer() {
  const links = [
    ["GitHub", GITHUB],
    ["npm", NPM_MCP],
    ["Nostr", "https://nostr.org"],
    ["Privacy", "/privacy-policy"],
    ["llms.txt", "/llms.txt"],
  ];
  return (
    <footer className="border-t border-line">
      <div className="sheet">
        <Row className="items-center gap-y-4 py-6 text-[13px] text-mute lg:h-[72px] lg:py-0">
          <div className="flex items-center gap-3.5 lg:col-span-6">
            <img src="/images/formstr/formstr-logo.svg" alt="Formstr" className="h-[22px]" />
            <span>Open-source work tools on Nostr.</span>
          </div>
          <div className="flex gap-6 lg:col-span-6 lg:justify-self-end">
            {links.map(([label, href]) => (
              <a
                key={label}
                href={href}
                {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="transition-colors hover:text-ink"
              >
                {label}
              </a>
            ))}
          </div>
        </Row>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Suite />
        <Agents />
        <Storage />
        <Security />
        <Source />
        <Close />
      </main>
      <Footer />
    </div>
  );
}

function App({ url, PrivacyPolicy = LazyPrivacyPolicy }: { url?: string; PrivacyPolicy?: ComponentType }) {
  const raw = url ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  // "/privacy-policy/" and "/privacy-policy" are the same page.
  const path = raw.replace(/\/+$/, "") || "/";
  if (path === "/privacy-policy")
    return (
      <Suspense fallback={null}>
        <PrivacyPolicy />
      </Suspense>
    );
  return <Home />;
}

export default App;
