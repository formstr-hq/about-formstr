# About page: design prototype

This design is now built into `src/`. The folder keeps the original static prototype and
the generators for two shipped assets:

- `poster.html` renders `public/images/agent-poster.webp`, the still shown in Fig. 2
  before or instead of the 3D scene. Capture it at 600×780 with a transparent background.
- `og.html` renders `public/og-image.png` at 1200×630.

To view the prototype, run `python3 -m http.server 4174` from the repo root and open
<http://localhost:4174/design/about.html>.

| File | What it is |
| --- | --- |
| `about.html` | The full page, static HTML/CSS |
| `agent-scene.js` | Fig. 2: the robot, in plain three.js |
| `assets/` | `robot.glb` (meshopt, ~76 KB gzipped), the Calendar design render, the Mailstr inbox |
| `shots/` | `about-hero.png`, `about-full.png` |

## Concept: a spec sheet for the suite

The page reads like a technical document, not a landing page. It's set in IBM Plex Sans and
Mono on paper, with hairline margins, numbered sections and numbered figures. It deliberately
avoids the usual generated-page tropes: no gradient glows, glass orbs, "NEW" pills,
icon-feature grids, checkmark trust rows, stat counters or fake logos.

Everything shown is a real artifact:

- **Fig. 1** (hero): one form, two readers. On the left, the form as a person sees it. On
  the right, the signed kind-30168 event an agent reads, with numbered markers linking each
  field to its tag. The tag shape (`["field", id, type, label, …]`) matches
  `agent/src/services/forms/fieldCodec.ts`. This one figure carries the pitch: the data is
  open, so agents need no API.
- **01 Suite** is a catalog. Each app is listed by the event kinds it stores
  (Forms 30168/1069, Calendar 31923/32678, Pages 33457, Drive 34578, Mailstr 1301 in a NIP-59
  wrap, all taken from common-packages), with a short spec list and a product plate.
  The Calendar plate is the team's own hi-fi design file (`nostr-calendar/designs/redesign/01`).
  Mailstr is the real inbox. Forms, Pages and Drive are HTML vignettes of the real UI with
  believable content. The Pages plate shows a person and an agent editing together.
- **02 Agents** (dark): "Agents don't need an integration. They need a key." It pairs the
  robot (Fig. 2) with a realistic `@formstr/mcp` session (Fig. 3) using real tool names and
  the real write-gate behavior.
- **03 Security** is a spec table for security reviewers (identity, NIP-44, NIP-59, data location,
  Blossom, audit trail, tracking), plus Fig. 4: a kind-1069 response as ciphertext and as read.
- **04 Source** lists the actual repos with live star counts and last-commit dates from the
  GitHub API (as of 2026-10-24). The real build should fetch these at build time.

Color is used only for app identity (each app's hue appears in its kind label and its UI).
Everything else is ink on paper.

## Notes

- The old copy said "every repo is MIT licensed", but on GitHub only nostr-forms,
  nostr-calendar, nostr-polls, formstr-drive, nail and ncache carry a license. nostr-docs and
  common-packages don't. The page now says only "open source" for those two. Adding LICENSE files
  would let it say more.
- Polls (nostr-polls) appears in the source table but not the catalog. Add a sixth entry if
  it should be featured.
- 3D cost: the robot is the only model. It loads after the page and animates only while
  on screen. No HDR, fonts or post-processing.
