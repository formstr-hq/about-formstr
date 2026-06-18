import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  BarChart3,
  FileEdit,
  CalendarDays,
  HardDrive,
  Radio,
  Flower2,
  ArrowRight,
  ArrowUpRight,
  Github,
  ChevronDown,
  KeyRound,
  Globe,
  ShieldCheck,
  Zap,
  Check,
  Lock,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./index.css";
import PrivacyPolicy from "./pages/PrivacyPolicy";

/* Stagger helper: delays a `.reveal` element's transition so grid siblings
   cascade in one after another instead of all at once. */
const rv = (step: number): CSSProperties =>
  ({ "--rd": `${step * 90}ms` }) as CSSProperties;

/* Scroll effects, JS-driven so they work on every browser (incl. iOS Safari,
   which doesn't support CSS scroll-timelines):
   - IntersectionObserver reveals `.reveal` elements as they enter the viewport
   - a passive scroll listener feeds the top progress bar
   Both honor prefers-reduced-motion and degrade gracefully without JS. */
function useScrollFx() {
  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal"),
    );

    let io: IntersectionObserver | undefined;
    if (reduce || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-visible"));
    } else {
      io = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              obs.unobserve(e.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
      );
      els.forEach((el) => io!.observe(el));
    }

    const bar = document.querySelector<HTMLElement>(".scroll-progress");
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        const p = max > 0 ? Math.min(doc.scrollTop / max, 1) : 0;
        bar?.style.setProperty("--scroll", String(p));
      });
    };
    if (!reduce && bar) {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

/* ------------------------------------------------------------------ */
/* Brand glyph — the gear-flower asterisk                              */
/* ------------------------------------------------------------------ */

function Asterisk({
  className = "",
  spin = false,
}: {
  className?: string;
  spin?: boolean;
}) {
  return (
    <svg
      viewBox="-70 -70 140 140"
      className={`${className} ${spin ? "spin-slow" : ""}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="astg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5c00" />
          <stop offset="0.55" stopColor="#ff8a00" />
          <stop offset="1" stopColor="#ffb020" />
        </linearGradient>
      </defs>
      <g fill="url(#astg)">
        <circle cx="0" cy="-30" r="27" />
        <circle cx="26" cy="-15" r="27" />
        <circle cx="26" cy="15" r="27" />
        <circle cx="0" cy="30" r="27" />
        <circle cx="-26" cy="15" r="27" />
        <circle cx="-26" cy="-15" r="27" />
        <circle cx="0" cy="0" r="34" />
      </g>
      <g fill="#ffd98a">
        <rect x="-7" y="-44" width="14" height="88" rx="7" />
        <rect x="-7" y="-44" width="14" height="88" rx="7" transform="rotate(60)" />
        <rect x="-7" y="-44" width="14" height="88" rx="7" transform="rotate(120)" />
      </g>
      <circle r="9" fill="#ff5c00" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* A faux browser address bar for the preview windows                  */
/* ------------------------------------------------------------------ */

function UrlBar({ url, className = "" }: { url: string; className?: string }) {
  const stripped = url.replace(/^https?:\/\//, "");
  const slash = stripped.indexOf("/");
  const host = slash === -1 ? stripped : stripped.slice(0, slash);
  const path = slash === -1 ? "" : stripped.slice(slash);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 font-mono text-[10px] leading-none ring-1 ring-white/10 ${className}`}
    >
      <Lock size={9} className="shrink-0 text-emerald-400" />
      <span className="text-white/30">https://</span>
      <span className="font-semibold text-white/90">{host}</span>
      {path && <span className="text-white/45">{path}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type App = {
  id: string;
  name: string;
  tagline: string;
  color: string;
  url: string | null;
  shot?: string;
  /* constellation position in a 600×600 viewbox */
  x: number;
  y: number;
};

const apps: App[] = [
  {
    id: "formstr",
    name: "Formstr",
    tagline: "Forms",
    color: "#ff5c00",
    url: "https://formstr.app",
    shot: "/images/previews/formstr.png",
    x: 420,
    y: 128,
  },
  {
    id: "pages",
    name: "Pages",
    tagline: "Docs",
    color: "#10b981",
    url: "https://pages.formstr.app",
    shot: "/images/previews/pages.png",
    x: 510,
    y: 332,
  },
  {
    id: "pollerama",
    name: "Pollerama",
    tagline: "Nostr client",
    color: "#f43f5e",
    url: "https://pollerama.fun",
    shot: "/images/previews/pollerama.png",
    x: 402,
    y: 486,
  },
  {
    id: "drive",
    name: "Drive",
    tagline: "Storage",
    color: "#8b5cf6",
    url: "https://drive.formstr.app",
    shot: "/images/previews/drive.png",
    x: 162,
    y: 462,
  },
  {
    id: "calendar",
    name: "Calendar",
    tagline: "Events",
    color: "#3b82f6",
    url: "https://calendar.formstr.app",
    shot: "/images/previews/calendar.png",
    x: 138,
    y: 166,
  },
];

type Product = {
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  url: string | null;
  color: string;
  shot?: string;
  status?: "beta" | "soon";
};

const products: Product[] = [
  {
    name: "Pollerama",
    tagline: "A Playful Nostr Client",
    description:
      "Home to NIP-88, the open polling standard we helped author for Nostr. It's since grown into a fun, full-featured client — notes, articles, movies and more — with real-time polls still at its heart.",
    icon: BarChart3,
    url: "https://pollerama.fun",
    color: "#f43f5e",
    shot: "/images/previews/pollerama.png",
  },
  {
    name: "Formstr Pages",
    tagline: "Private Docs & Notes",
    description:
      "Private, Notion-style notes and documents on Nostr. Keep your knowledge base encrypted and entirely yours — with real-time collaboration when you want it, no central server.",
    icon: FileEdit,
    url: "https://pages.formstr.app",
    color: "#10b981",
    shot: "/images/previews/pages.png",
  },
  {
    name: "Formstr Calendar",
    tagline: "Decentralized Calendar",
    description:
      "Private events, RSVPs, recurring schedules, and Calendly-style booking pages on Nostr — all end-to-end encrypted. No central server keeping a log of who you meet and when.",
    icon: CalendarDays,
    url: "https://calendar.formstr.app",
    color: "#3b82f6",
    shot: "/images/previews/calendar.png",
  },
  {
    name: "Formstr Drive",
    tagline: "Decentralized File Storage",
    description:
      "Upload, organize, and share files with no central authority watching. Nostr for the index, Blossom servers you choose for the bytes. Your files, your servers, your rules.",
    icon: HardDrive,
    url: "https://drive.formstr.app",
    color: "#8b5cf6",
    shot: "/images/previews/drive.png",
  },
  {
    name: "Formstr Relay",
    tagline: "Nostr Relay",
    description:
      "Our own relay, tuned for the Formstr ecosystem. Fast and reliable, optimized for forms, polls, docs, and calendar events.",
    icon: Radio,
    url: null,
    color: "#64748b",
    status: "soon",
  },
  {
    name: "Blossom Server",
    tagline: "Decentralized Blob Storage",
    description:
      "Self-hosted blob storage for the ecosystem. Store and serve media with the Blossom protocol — decentralized, censorship-resistant hosting.",
    icon: Flower2,
    url: null,
    color: "#f43f5e",
    status: "soon",
  },
];

const principles = [
  {
    icon: KeyRound,
    title: "Own your data",
    description:
      "Your work lives on relays you choose, under a key only you hold. No company holds it hostage.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy you can verify",
    description:
      "Encrypted with your keys. Relays store ciphertext they can't read. Not a promise — math.",
  },
  {
    icon: Globe,
    title: "Open & interoperable",
    description:
      "Open protocols, open source. Your forms and docs are readable by any Nostr client. Extend it, remix it, self-host it.",
  },
  {
    icon: Zap,
    title: "Bring your own keys",
    description:
      "Already on Nostr? Sign in with your key. New here? Create one with us in a tap — no email, no password, nothing to ban.",
  },
];

/* ------------------------------------------------------------------ */
/* Constellation hero                                                  */
/* ------------------------------------------------------------------ */

function ConstellationNode({ app, index }: { app: App; index: number }) {
  const left = (app.x / 600) * 100;
  const top = (app.y / 600) * 100;
  const openLeft = app.x > 300; // node on the right → open preview to the left

  return (
    <div
      className="absolute z-10 hover:z-50 focus-within:z-50"
      style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
    >
      <div
        className="group relative z-10 float hover:z-30 focus-within:z-30"
        style={{ animationDelay: `${index * 0.8}s` }}
      >
        <a
          href={app.url ?? "#apps"}
          target={app.url ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md"
        >
          <span className="h-3 w-3 rounded-full" style={{ background: app.color }} />
          <span className="text-sm font-bold text-ink">{app.name}</span>
        </a>

        {/* hover preview — the real screenshot unfolds. padding (not margin)
            bridges the gap so the mouse can travel onto it without it closing */}
        <a
          href={app.url ?? "#apps"}
          target={app.url ? "_blank" : undefined}
          rel="noopener noreferrer"
          className={`pointer-events-none absolute top-1/2 z-30 block w-64 -translate-y-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-focus-within:pointer-events-auto ${
            openLeft ? "right-full pr-3" : "left-full pl-3"
          }`}
        >
          <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center gap-1.5 bg-ink px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ background: app.color }} />
              <span className="h-2 w-2 rounded-full bg-white/30" />
              <span className="h-2 w-2 rounded-full bg-white/30" />
              <UrlBar url={app.url ?? ""} className="ml-1.5" />
            </div>
            {app.shot && (
              <img
                src={app.shot}
                alt={`${app.name} preview`}
                className="h-36 w-full border-y border-black/5 object-cover object-top"
              />
            )}
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-bold text-ink">{app.name}</p>
                <p className="text-xs font-medium" style={{ color: app.color }}>
                  {app.tagline}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                Visit <ArrowUpRight size={13} />
              </span>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

function Constellation() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* glow */}
      <div
        className="absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,138,0,0.18), transparent 70%)",
        }}
      />

      {/* relay links + flowing data pulses */}
      <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full">
        {apps.map((a, i) => (
          <g key={a.id}>
            <line
              x1="300"
              y1="300"
              x2={a.x}
              y2={a.y}
              stroke="#ff5c00"
              strokeOpacity="0.35"
              strokeWidth="1.6"
              strokeDasharray="2 6"
              strokeLinecap="round"
            />
            <circle r="4" fill="#ff5c00">
              <animateMotion
                dur="3.4s"
                repeatCount="indefinite"
                path={`M300 300 L ${a.x} ${a.y}`}
                begin={`${i * 0.6}s`}
              />
            </circle>
          </g>
        ))}
      </svg>

      {/* hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Asterisk className="h-28 w-28 drop-shadow-sm" spin />
      </div>

      {/* nodes */}
      {apps.map((a, i) => (
        <ConstellationNode key={a.id} app={a} index={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile showcase — auto-cycling app preview (constellation is        */
/* desktop-only, so phones get their own interactive demo)             */
/* ------------------------------------------------------------------ */

function MobileShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(
      () => setActive((a) => (a + 1) % apps.length),
      2600,
    );
    return () => clearInterval(id);
  }, [auto]);

  const app = apps[active];

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 bg-ink px-3 py-2.5">
        <span
          className="h-2.5 w-2.5 rounded-full transition-colors"
          style={{ background: app.color }}
        />
        <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        <UrlBar url={app.url ?? ""} className="ml-1.5" />
      </div>

      {/* crossfading real screenshots */}
      <div className="relative aspect-[16/10] overflow-hidden bg-paper">
        {apps.map((a, i) => (
          <img
            key={a.id}
            src={a.shot}
            alt={`${a.name} preview`}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {/* meta + open */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full transition-colors"
            style={{ background: app.color }}
          />
          <div>
            <p className="text-sm font-bold leading-tight text-ink">{app.name}</p>
            <p
              className="text-xs font-semibold transition-colors"
              style={{ color: app.color }}
            >
              {app.tagline}
            </p>
          </div>
        </div>
        <a
          href={app.url ?? "#apps"}
          target={app.url ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
          style={{ background: app.color }}
        >
          Open <ArrowUpRight size={15} />
        </a>
      </div>

      {/* selector chips */}
      <div className="flex flex-wrap gap-2 border-t border-black/5 p-3">
        {apps.map((a, i) => {
          const on = i === active;
          return (
            <button
              key={a.id}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
              style={
                on
                  ? {
                      borderColor: a.color,
                      color: a.color,
                      background: `${a.color}12`,
                    }
                  : { borderColor: "rgba(0,0,0,0.1)", color: "#6b7280" }
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: a.color }}
              />
              {a.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */

function Launcher() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/85"
      >
        Launch an app
        <ChevronDown
          size={15}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-black/10 bg-white p-1.5 shadow-xl">
            {apps.map((a) => (
              <a
                key={a.id}
                href={a.url ?? "#apps"}
                target={a.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.04]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: a.color }}
                />
                <span className="text-sm font-semibold text-ink">{a.name}</span>
                <span className="ml-auto text-xs text-gray-400">{a.tagline}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-black/5 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <a href="/" className="flex items-center gap-2">
          <img src="/images/formstr/formstr-logo.svg" alt="Formstr" className="h-9" />
        </a>
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="https://github.com/formstr-hq"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 transition-colors hover:text-ink"
            aria-label="GitHub"
          >
            <Github size={20} />
          </a>
          <Launcher />
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Product card                                                        */
/* ------------------------------------------------------------------ */

function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const Icon = product.icon;
  const live = !!product.url;

  return (
    <div
      style={rv(index)}
      className="reveal reveal-scale group relative flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      {product.shot ? (
        <div className="relative h-40 overflow-hidden border-b border-black/5 bg-paper">
          {/* tape */}
          <span className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rotate-2 rounded-[2px] bg-amber/40 ring-1 ring-amber/30" />
          <img
            src={product.shot}
            alt={`${product.name} preview`}
            className="h-full w-full rotate-[0.6deg] scale-[1.04] object-cover object-top transition-transform duration-300 group-hover:rotate-0 group-hover:scale-100"
          />
        </div>
      ) : (
        <div
          className="relative flex h-40 items-center justify-center overflow-hidden border-b border-black/5"
          style={{
            background: `linear-gradient(135deg, ${product.color}14, ${product.color}05)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          <Icon size={44} strokeWidth={1.4} style={{ color: product.color }} />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        {product.status && (
          <span className="absolute right-4 top-4 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {product.status === "beta" ? "In beta" : "Coming soon"}
          </span>
        )}
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: `${product.color}18` }}
          >
            <Icon size={18} style={{ color: product.color }} />
          </div>
          <div>
            <h3 className="font-bold leading-tight text-ink">{product.name}</h3>
            <p className="text-xs font-semibold" style={{ color: product.color }}>
              {product.tagline}
            </p>
          </div>
        </div>
        <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-600">
          {product.description}
        </p>
        {live && (
          <a
            href={product.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-primary"
          >
            Open {product.name} <ArrowUpRight size={15} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-grid">
      <div className="absolute inset-0 bg-grid-lg" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-2 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Asterisk className="h-3.5 w-3.5" /> Own it, don't rent it
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.04] tracking-tight text-ink sm:text-6xl">
            Your life's work
            <br />
            shouldn't have
            <br />
            a <span className="text-primary">landlord.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            Forms, docs, calendars, files — the tools your business runs on.
            Encrypted with keys only you hold, on relays you pick —{" "}
            <span className="font-semibold text-ink">
              security you can actually verify.
            </span>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#apps"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              Explore the suite <ArrowRight size={16} />
            </a>
            <a
              href="#privacy"
              className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-black/[0.03]"
            >
              Why it's secure
            </a>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <KeyRound size={15} className="text-primary" />
            Bring your own Nostr key, or create one with us in a tap.
          </p>

          {/* mobile interactive showcase (constellation is desktop-only) */}
          <div className="mt-10 lg:hidden">
            <MobileShowcase />
            <p className="mt-3 text-center text-sm text-gray-400">
              One key, every app. Tap to explore →
            </p>
          </div>
        </div>

        <div className="hidden lg:block">
          <Constellation />
          <p className="mt-2 text-center text-sm text-gray-400">
            One key, every app.{" "}
            <span className="text-gray-500">Hover one to look inside →</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Thesis() {
  const rented = [
    "Your account can be banned — and your company's work with it",
    "Your data — even who you meet and when — gets mined",
    "The tool gets sunset on a roadmap you can't see",
    "Export is locked behind the next pricing tier",
  ];
  const owned = [
    "A key only you hold — nothing to ban",
    "End-to-end encrypted; relays can't read it",
    "Open formats, export anytime, self-host anytime",
    "Free, open source, and interoperable by design",
  ];
  return (
    <section id="thesis" className="border-t border-black/5 bg-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="reveal max-w-2xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-primary-light">
            The thesis
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Right now, you're renting your tools.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/60">
            The forms, docs, calendars, and files your business runs on are its
            most valuable asset — and they live on Big Tech's computers, under
            Big Tech's rules. You can be locked out, mined, or shut down at any
            time. Formstr changes that: your work, your keys, yours to keep.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="reveal reveal-left rounded-2xl border border-white/10 bg-white/[0.03] p-7">
            <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/40">
              <Lock size={16} /> Renting
            </p>
            <ul className="space-y-3.5">
              {rented.map((r) => (
                <li key={r} className="flex gap-3 text-white/55">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                  <span className="leading-relaxed line-through decoration-white/20">
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal reveal-right rounded-2xl border border-primary/30 bg-primary/[0.07] p-7">
            <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-light">
              <KeyRound size={16} /> Owning
            </p>
            <ul className="space-y-3.5">
              {owned.map((o) => (
                <li key={o} className="flex gap-3 text-white/90">
                  <Check
                    size={18}
                    className="mt-0.5 shrink-0 text-primary-light"
                  />
                  <span className="leading-relaxed">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Suite() {
  return (
    <section id="apps" className="border-t border-black/5">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="reveal mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">
            The suite
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            One key. The whole suite is yours.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-600">
            A growing set of decentralized apps — each one replacing a rented
            tool your business relies on today. Sign in once with your Nostr key
            and they all work together.
          </p>
        </div>

        {/* featured — Formstr */}
        <div className="reveal reveal-scale mb-6 grid items-stretch overflow-hidden rounded-2xl border border-black/10 bg-white md:grid-cols-2">
          <div className="flex flex-col justify-center p-8 lg:p-10">
            <div className="mb-4 flex items-center gap-3">
              <Asterisk className="h-10 w-10" />
              <div>
                <h3 className="text-2xl font-bold text-ink">Formstr</h3>
                <p className="text-sm font-semibold text-primary">
                  Decentralized Forms
                </p>
              </div>
            </div>
            <p className="mb-6 leading-relaxed text-gray-600">
              Build surveys and collect responses without giving up your data.
              Full data ownership, anonymous submissions, end-to-end encrypted
              responses, AI-powered form generation, and export whenever you
              want. The flagship of the suite.
            </p>
            <div>
              <a
                href="https://formstr.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink/85"
              >
                Open Formstr <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
          <div className="relative min-h-56 overflow-hidden border-t border-black/5 bg-paper md:border-l md:border-t-0">
            <div className="flex items-center gap-1.5 bg-ink px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
              <UrlBar url="https://formstr.app/c" className="ml-2" />
            </div>
            <img
              src="/images/previews/formstr.png"
              alt="Formstr form builder"
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <ProductCard key={p.name} product={p} index={i % 3} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="border-t border-black/5 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
        <div className="reveal reveal-left">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary-light">
            <ShieldCheck size={16} /> Verifiable security
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Security you can verify.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/65">
            You encrypt with keys only you hold. The relays that store your work
            only ever see ciphertext — they couldn't read it if they tried, and
            neither can we.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-white/65">
            And you can check it yourself: the encryption is open source and
            runs on your device, so security here is something you prove, not
            something you're promised.{" "}
            <span className="font-semibold text-white">
              The only kind of security that's actually real.
            </span>
          </p>
        </div>

        {/* what the relay sees vs what you see */}
        <div className="reveal reveal-right space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/40">
              <Lock size={14} /> What the relay stores
            </p>
            <pre className="overflow-hidden whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-white/35">
{`kind: 30168
content: "AgT7x9Qd2Kf8mPz1rR4vN6wYbH3eL0c
Js5Uo9aZ...8B==" 🔒
sig: 3a7f...e91`}
            </pre>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-primary-light">
            <KeyRound size={15} /> decrypts with your key ↓
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.07] p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary-light">
              <Check size={14} /> What you see
            </p>
            <div className="rounded-lg bg-white/95 p-4 text-ink">
              <p className="text-sm font-bold">Team retro — Q2</p>
              <p className="mt-1 text-xs text-gray-500">
                What should we keep doing?
              </p>
              <div className="mt-2 rounded-md border border-black/10 bg-paper px-3 py-2 text-xs text-gray-600">
                Shipping in the open every week.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltInOpen() {
  const log = [
    { tag: "Jun 2026", text: "Formstr Drive shipped → drive.formstr.app" },
    { tag: "May 2026", text: "Calendar: recurring events + NIP-46 remote signing" },
    { tag: "Apr 2026", text: "Pages: private, Notion-style notes on Nostr" },
    { tag: "Mar 2026", text: "Formstr: AI-powered form generation" },
  ];
  return (
    <section id="open" className="relative overflow-hidden border-t border-black/5 bg-grid">
      <div className="absolute inset-0 bg-grid-lg" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
        <div className="reveal reveal-left">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">
            Built in the open
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Made by people, not a template.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Every app here is open source and built in public. The code and the
            issues are out in the open, with nothing hidden in a black box.
            Read it, file a bug, fork it, or ship a PR.
          </p>
          <p className="mt-4 hand text-2xl text-primary">
            your keys, your data, our open source.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="https://github.com/formstr-hq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink/85"
            >
              <Github size={16} /> See it on GitHub
            </a>
            <span className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-gray-600">
              <Scale size={16} className="text-primary" /> Every repo is MIT
              licensed
            </span>
          </div>
        </div>

        <div className="reveal reveal-right rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
            <span className="ml-2 font-mono text-xs text-gray-400">
              build-log
            </span>
          </div>
          <ul className="divide-y divide-black/5">
            {log.map((l) => (
              <li key={l.tag} className="flex items-start gap-3 px-3 py-3.5">
                <span className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-400">
                  <Check size={14} className="text-emerald-500" />
                  {l.tag}
                </span>
                <span className="text-sm text-ink">{l.text}</span>
              </li>
            ))}
            <li className="flex items-center gap-3 px-3 py-3.5">
              <span className="font-mono text-xs font-semibold text-gray-400">
                next
              </span>
              <span className="text-sm text-gray-400">
                Formstr Relay &amp; Blossom Server — in progress
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section className="border-t border-black/5">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((p, i) => (
            <div key={p.title} className="reveal" style={rv(i)}>
              <p.icon size={26} className="mb-3 text-primary" strokeWidth={1.6} />
              <h3 className="mb-1.5 font-bold text-ink">{p.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Nostr() {
  return (
    <section id="nostr" className="border-t border-black/5 bg-paper">
      <div className="reveal mx-auto max-w-2xl px-6 py-20 text-center">
        <Asterisk className="mx-auto mb-6 h-12 w-12" />
        <h2 className="text-3xl font-bold tracking-tight text-ink">
          Built on Nostr
        </h2>
        <p className="mt-4 leading-relaxed text-gray-600">
          Nostr is a simple, open protocol for censorship-resistant,
          decentralized communication. Your identity is a key pair. Your data
          lives on relays you choose. No company controls your account or your
          content — which is exactly why we build on it.
        </p>
        <a
          href="https://nostr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary-light"
        >
          Learn about Nostr <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Asterisk className="h-9 w-9" />
            <div>
              <p className="font-mono text-lg font-bold italic">form*</p>
              <p className="text-sm text-white/50">Own it, don't rent it.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
            <a
              href="mailto:hello@formstr.app"
              className="transition-colors hover:text-white"
            >
              hello@formstr.app
            </a>
            <a
              href="https://github.com/formstr-hq"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://nostr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Nostr
            </a>
            <a
              href="/privacy-policy"
              className="transition-colors hover:text-white"
            >
              Privacy Policy
            </a>
          </div>
        </div>
        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-white/40">
          Decentralized tools on Nostr. Your keys, your data, your work.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Home() {
  useScrollFx();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="scroll-progress" aria-hidden="true" />
      <Navbar />
      <Hero />
      <Thesis />
      <Suite />
      <Privacy />
      <BuiltInOpen />
      <Principles />
      <Nostr />
      <Footer />
    </div>
  );
}

function App({ url }: { url?: string }) {
  const path =
    url ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  if (path === "/privacy-policy") return <PrivacyPolicy />;
  return <Home />;
}

export default App;
