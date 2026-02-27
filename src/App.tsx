import {
  FileText,
  BarChart3,
  FileEdit,
  CalendarDays,
  HardDrive,
  Cpu,
  Radio,
  Flower2,
  ArrowRight,
  Github,
  ExternalLink,
  Shield,
  Globe,
  Lock,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./index.css";

type Product = {
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  url: string | null;
  color: string;
  logo?: string;
  screenshot?: string;
  comingSoon?: boolean;
};

const products: Product[] = [
  {
    name: "Formstr",
    tagline: "Decentralized Forms",
    description:
      "A privacy-first alternative to Google Forms. Create surveys, collect responses, and own your data — all powered by Nostr. Supports anonymous submissions, encrypted responses, AI-powered form generation, and data export.",
    icon: FileText,
    url: "https://formstr.app",
    color: "#6366f1",
    logo: "/images/formstr/logo-192.png",
    screenshot: "/images/formstr/background.png",
  },
  {
    name: "Pollerama",
    tagline: "Decentralized Polling",
    description:
      "Create single or multiple-choice polls on Nostr with real-time results. NIP-88 compliant and interoperable with any compatible Nostr client. No sign-ups, no tracking — just polls.",
    icon: BarChart3,
    url: "https://pollerama.fun",
    color: "#f59e0b",
    logo: "/images/pollerama/icon.png",
    screenshot: "/images/pollerama/polls-screenshot.png",
  },
  {
    name: "Formstr Pages",
    tagline: "Collaborative Documents",
    description:
      "Real-time collaborative document editing built on Nostr. Multiple users can edit Markdown documents simultaneously with conflict-free replication using CRDTs — no central server required.",
    icon: FileEdit,
    url: "https://pages.formstr.app",
    color: "#10b981",
    logo: "/images/formstr-pages/logo.png",
  },
  {
    name: "Formstr Calendar",
    tagline: "Decentralized Calendar",
    description:
      "Manage events, send RSVPs, and coordinate schedules on Nostr. Supports public and private events with end-to-end encryption, recurring events, and drag-and-drop scheduling.",
    icon: CalendarDays,
    url: "https://calendar.formstr.app",
    color: "#3b82f6",
    logo: "/images/formstr-calendar/logo.png",
    screenshot: "/images/formstr-calendar/calendar-icon.svg",
  },
  {
    name: "Formstr Drive",
    tagline: "Decentralized File Storage",
    description:
      "A decentralized alternative to Google Drive. Upload, organize, and share files using Nostr for indexing and Blossom servers for storage. Your files, your servers, your rules.",
    icon: HardDrive,
    url: null,
    color: "#8b5cf6",
  },
  {
    name: "NRPC",
    tagline: "Nostr RPC Services",
    description:
      "Backend services over Nostr events. Schedule reminders, automate posts, send DMs, and run ecash giveaways — all through a simple RPC protocol built on Nostr.",
    icon: Cpu,
    url: null,
    color: "#ec4899",
  },
  {
    name: "Formstr Relay",
    tagline: "Nostr Relay",
    description:
      "Our own Nostr relay optimized for Formstr ecosystem events. Fast, reliable, and tuned for forms, polls, docs, and calendar data.",
    icon: Radio,
    url: null,
    color: "#64748b",
    comingSoon: true,
  },
  {
    name: "Blossom Server",
    tagline: "Decentralized Blob Storage",
    description:
      "Self-hosted blob storage server for the Formstr ecosystem. Store and serve files with the Blossom protocol — decentralized, censorship-resistant media hosting.",
    icon: Flower2,
    url: null,
    color: "#f43f5e",
    comingSoon: true,
  },
];

const principles = [
  {
    icon: Shield,
    title: "Own Your Data",
    description:
      "Your data lives on Nostr relays you choose. No company holds your information hostage.",
  },
  {
    icon: Globe,
    title: "Open & Interoperable",
    description:
      "Built on open protocols and standards. Everything is open-source — extend, remix, or self-host.",
  },
  {
    icon: Lock,
    title: "Private by Default",
    description:
      "Anonymous submissions, encrypted responses, and end-to-end encrypted events. Privacy isn't an add-on.",
  },
  {
    icon: Zap,
    title: "No Sign-ups",
    description:
      "No accounts, no passwords, no email verification. Just your Nostr keys and you're ready to go.",
  },
];

function ProductCard({ product }: { product: Product }) {
  const Icon = product.icon;
  const isComingSoon = product.comingSoon;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-lg">
      {product.screenshot && (
        <div
          className="relative h-40 overflow-hidden border-b border-gray-100"
          style={{ backgroundColor: `${product.color}08` }}
        >
          <img
            src={product.screenshot}
            alt={`${product.name} preview`}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-6">
        {isComingSoon && (
          <span className="absolute top-4 right-4 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
            Coming Soon
          </span>
        )}
        <div className="mb-4 flex items-center gap-3">
          {product.logo ? (
            <img
              src={product.logo}
              alt={`${product.name} logo`}
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${product.color}15` }}
            >
              <Icon size={20} style={{ color: product.color }} />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold leading-tight text-gray-900">
              {product.name}
            </h3>
            <p
              className="text-sm font-medium"
              style={{ color: product.color }}
            >
              {product.tagline}
            </p>
          </div>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {product.description}
        </p>
        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 transition-colors hover:text-primary"
          >
            Visit <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2">
            <img
              src="/images/formstr/formstr-logo.svg"
              alt="formstr"
              className="h-7"
            />
          </a>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/formstr-hq"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 transition-colors hover:text-gray-900"
            >
              <Github size={20} />
            </a>
            <a
              href="https://formstr.app"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Try Formstr
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <h1 className="mb-6 text-5xl leading-tight font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Decentralized tools
            <br />
            <span className="text-primary">for everyday use.</span>
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-gray-600">
            We build privacy-first alternatives to the tools you use daily —
            forms, docs, calendars, file storage, and more. All built on{" "}
            <a
              href="https://nostr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition-colors hover:decoration-primary"
            >
              Nostr
            </a>
            , the open protocol for a censorship-resistant internet.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://formstr.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Get Started <ArrowRight size={16} />
            </a>
            <a
              href="#products"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Explore Products
            </a>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p) => (
              <div key={p.title}>
                <p.icon
                  size={24}
                  className="mb-3 text-primary"
                  strokeWidth={1.5}
                />
                <h3 className="mb-1 text-sm font-semibold text-gray-900">
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-t border-gray-100">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-gray-900">
              Our Products
            </h2>
            <p className="max-w-xl text-gray-600">
              A growing suite of decentralized applications — each replacing a
              centralized tool you rely on today.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.name} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Built on Nostr */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900">
              Built on Nostr
            </h2>
            <p className="mb-6 leading-relaxed text-gray-600">
              Nostr is a simple, open protocol that enables censorship-resistant
              and decentralized communication. Your identity is a key pair. Your
              data lives on relays you choose. No company controls your account
              or your content.
            </p>
            <a
              href="https://nostr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-light"
            >
              Learn about Nostr <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <img
                src="/images/formstr/formstr-logo.svg"
                alt="formstr"
                className="h-6"
              />
              <p className="mt-2 text-sm text-gray-500">
                Decentralized tools on Nostr.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a
                href="mailto:hello@formstr.app"
                className="transition-colors hover:text-gray-900"
              >
                hello@formstr.app
              </a>
              <a
                href="https://github.com/formstr-hq"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-gray-900"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
