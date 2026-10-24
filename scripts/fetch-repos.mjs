// Build step: refresh star counts and last-commit dates for the repos listed on
// the about page (Source section). Runs at build time so visitors' browsers
// never call GitHub. If the API is unreachable or rate-limited, the committed
// src/data/repos.json is left as-is and the build carries on.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data/repos.json");
const ORG = "formstr-hq";

try {
  const res = await fetch(`https://api.github.com/orgs/${ORG}/repos?per_page=100`, {
    headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const repos = await res.json();
  const stats = Object.fromEntries(
    repos.map((r) => [r.name, { stars: r.stargazers_count, pushedAt: r.pushed_at, license: r.license?.spdx_id ?? null }]),
  );
  fs.writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), repos: stats }, null, 2) + "\n");
  console.log(`repos: refreshed ${repos.length} repos from GitHub`);
} catch (err) {
  console.warn(`repos: kept committed ${path.relative(process.cwd(), out)} (${err.message})`);
}
