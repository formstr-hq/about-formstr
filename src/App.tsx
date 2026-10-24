import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Copy, Lock } from "lucide-react";
import "./index.css";
import repoStats from "./data/repos.json";

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

function Figcap({ n, children }: { n: number; children: ReactNode }) {
  return (
    <figcaption className="figcap">
      <b>Fig. {n}</b>
      <span>{children}</span>
    </figcaption>
  );
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
    ["03", "Security", "/#security"],
    ["04", "Source", "/#source"],
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
/* Hero + Fig. 1                                                       */
/* ------------------------------------------------------------------ */

function FormVignette() {
  const field = "relative mt-[22px]";
  const marker = "marker absolute -left-[22px] top-px";
  return (
    <div className="rounded-md border border-line-2 border-t-4 border-t-forms bg-white px-7 py-[26px]">
      <h4 className="text-xl font-semibold tracking-[-0.01em]">Site visit feedback</h4>
      <p className="mt-1.5 text-[13.5px] text-mute">Two minutes. Answers are encrypted to the facilities team.</p>
      <div className={field}>
        <span className={marker}>1</span>
        <p className="mb-2 text-sm font-medium">
          Your name <span className="text-mail">*</span>
        </p>
        <div className="flex h-[38px] items-center rounded-[4px] border border-line px-3 text-[13.5px] text-ink-2">
          Dana Okafor
        </div>
      </div>
      <div className={field}>
        <span className={marker}>2</span>
        <p className="mb-2 text-sm font-medium">How was the visit?</p>
        <div className="flex gap-2">
          {["Smooth", "Mixed", "Rough"].map((o, i) => (
            <div
              key={o}
              data-on={i === 0 ? "" : undefined}
              className={`opt flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[4px] border px-2.5 text-[13px] sm:px-3 sm:text-[13.5px] ${
                i === 0 ? "border-forms bg-[#fff6f0]" : "border-line"
              }`}
            >
              {o}
            </div>
          ))}
        </div>
      </div>
      <div className={field}>
        <span className={marker}>3</span>
        <p className="mb-2 text-sm font-medium">What should we change?</p>
        <div className="min-h-[70px] rounded-[4px] border border-line px-3 py-2.5 text-[13.5px] leading-normal text-ink-2">
          Badge pickup took twenty minutes. Could the passes be ready the day before?
        </div>
      </div>
      <div className="mt-[22px] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-mute">
          <Lock size={12} /> Response encrypted before sending
        </span>
        <span className="rounded-[4px] bg-ink px-4 py-2 text-[13.5px] font-medium text-white">Submit</span>
      </div>
    </div>
  );
}

function EventListing() {
  const s = (t: string) => <span className="s">"{t}"</span>;
  const k = (t: string) => <span className="k">"{t}"</span>;
  const field = (id: string, type: string, label: string, n: number) => (
    <>
      <span className="hl">
        {"    ["}
        {s("field")}, {s(id)}, {s(type)}, {s(label)}, …]
      </span>
      {"  "}
      <span className="marker align-[1px]">{n}</span>
      {"\n"}
    </>
  );
  return (
    <pre className="ev">
      {"{\n  "}
      {k("kind")}: <span className="num">30168</span>,{"\n  "}
      {k("pubkey")}: {s("3bf0c63fcb93463407af97a5e5ee64fa…")},{"\n  "}
      {k("created_at")}: <span className="num">1761292800</span>,{"\n  "}
      {k("tags")}: [{"\n    "}[{s("d")}, {s("site-visit")}],{"\n    "}[{s("name")}, {s("Site visit feedback")}],{"\n"}
      {field("q1", "text", "Your name", 1)}
      {field("q2", "option", "How was the visit?", 2)}
      {field("q3", "text", "What should we change?", 3)}
      {"  ],\n  "}
      {k("sig")}: {s("a91c4e…07e2")}
      {"\n}"}
    </pre>
  );
}

function Hero() {
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
                <span className="cap hidden sm:inline">formstr.app/f/site-visit</span>
              </div>
              <FormVignette />
            </div>
            <div className="relative border-t border-line bg-night p-5 sm:p-8 lg:border-t-0 lg:border-l">
              <span className="absolute top-0 left-1/2 z-10 grid h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper font-mono text-[13px] lg:top-1/2 lg:left-0">
                =
              </span>
              <div className="mb-[22px] flex justify-between gap-4">
                <span className="cap !text-night-mute">What an agent reads</span>
                <span className="cap !text-night-mute">kind 30168 · signed</span>
              </div>
              <EventListing />
            </div>
          </div>
          <Figcap n={1}>
            One form, two readers. People get a form. Agents get the signed event it's made of, in a public format any
            Nostr client can parse, with no Formstr API in between.
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

function FormsPlate() {
  const bars: [string, number][] = [
    ["Smooth", 15],
    ["Mixed", 7],
    ["Rough", 2],
  ];
  const rows = [
    ["Dana Okafor", "Badge pickup took twenty minutes…", "09:41"],
    ["Anonymous", "Great hosts. Parking was confusing.", "09:12"],
    ["npub1qe3…7xk2", "Lunch was excellent, thank you.", "08:57"],
  ];
  return (
    <Win url="formstr.app / site-visit / responses">
      <div className="grid sm:grid-cols-[1.1fr_1fr]">
        <div className="p-6">
          <h5 className="text-[15px] font-semibold">How was the visit?</h5>
          <span className="cap">24 responses</span>
          <div className="mt-5 grid gap-3 text-[13px]">
            {bars.map(([label, n]) => (
              <div key={label} className="grid grid-cols-[80px_1fr_26px] items-center gap-2.5">
                <span>{label}</span>
                <b className="h-2.5 rounded-[2px] bg-forms" style={{ width: `${(n / 15) * 100}%` }} />
                <span className="text-right font-mono text-xs text-mute">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-line-2 px-6 py-3 text-[13px] sm:border-t-0 sm:border-l">
          {rows.map(([who, what, at], i) => (
            <div key={who} className={`flex justify-between gap-3 py-2.5 ${i ? "border-t border-line-2" : ""}`}>
              <span>
                {who}
                <em className="mt-0.5 block not-italic text-ink-2">{what}</em>
              </span>
              <small className="font-mono text-[11.5px] text-mute">{at}</small>
            </div>
          ))}
        </div>
      </div>
    </Win>
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

/* Fig. 2. The robot still is the figure; the live 3D scene is an
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
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = stage.current;
    const mountEl = host.current;
    if (!el || !mountEl || typeof IntersectionObserver === "undefined" || !canRender3D()) return;

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
        if (!e.isIntersecting) return;
        near.disconnect();
        import("./three/AgentScene")
          .then(({ default: AgentScene }) => {
            if (stopped) return;
            root = createRoot(mountEl);
            render = (active) =>
              root!.render(<AgentScene active={active} onReady={() => setLive(true)} onLost={stop} />);
            render(visible);
          })
          .catch(() => {
            // Chunk failed to load: the still simply stays.
          });
      },
      { rootMargin: "400px" },
    );
    // Only animate while the figure is on screen.
    const onScreen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!stopped) render?.(visible);
    });
    near.observe(el);
    onScreen.observe(el);
    return () => {
      stopped = true;
      near.disconnect();
      onScreen.disconnect();
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
        <span className="cap absolute bottom-3.5 left-4">Your agent</span>
        <span className="cap absolute right-4 bottom-3.5 normal-case">npub1ag3…k9qz</span>
      </div>
      <Figcap n={2}>
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
      <Figcap n={3}>
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
/* 03 — Security                                                       */
/* ------------------------------------------------------------------ */

function Security() {
  const code = (t: string) => <code className="font-mono text-[13px] text-ink">{t}</code>;
  const rows: [string, ReactNode][] = [
    ["Identity", <>A key pair, not an account. Sign in with a browser extension, a remote signer ({code("NIP-46")}) or a local key.</>],
    ["Encryption", <>{code("NIP-44")}, performed on your device. Shared items are delivered with {code("NIP-59")} gift wraps.</>],
    ["Data location", "Relays you choose. Run your own to keep data inside your network."],
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
          no="03 — Security"
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
                <span className="cap !text-ink">On the owner's device</span>
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
            <Figcap n={4}>A form response as stored and as read. Only the form owner's key turns one into the other.</Figcap>
          </figure>
        </Row>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Source                                                         */
/* ------------------------------------------------------------------ */

function Source() {
  const cols = "grid grid-cols-[1fr_auto_20px] gap-6 sm:grid-cols-[2.2fr_3fr_0.8fr_1.2fr_20px]";
  return (
    <section id="source" className="border-t border-line">
      <div className="sheet py-24 lg:py-[120px]">
        <SectionHead
          no="04 — Source"
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
