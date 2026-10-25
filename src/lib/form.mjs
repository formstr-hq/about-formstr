// The hero's example form ("Site visit feedback"), shared by the build
// (scripts/fetch-form.mjs) and the browser. Plain JS so the build script can
// run it without a compile step; types are in ./form.d.mts.

export const DEMO_FORM = {
  naddr: "naddr1qvzqqqr4mqpzqyaxkc63zw2fq3y0nmzl8w40g3jefqynqlz3ut9l9ehm0d8vrzx2qqyrjvpjxvenvcfcpsj7sk",
  pubkey: "13a6b6351139490448f9ec5f3baaf446594809307c51e2cbf2e6fb7b4ec188ca",
  id: "902336a8",
  // Checked for the current version. Several, because a relay that missed an
  // edit still serves the old one.
  relays: ["wss://relay.formstr.app", "wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
};

/* Responses from this page are signed with this key and NIP-44 encrypted
   to the form's pubkey, the SDK's anonymous-response scheme with a fixed key
   instead of a one-time one. The conversation key is the same from either
   side, so they open with the form's secret (the Formstr app's responses
   view, as usual) or with this secret, published here on purpose so any
   browser can show results live. Responses on this demo form are meant to be
   readable by anyone. Responses sent some other way aren't counted. */
export const DEMO_RESULTS_KEY = {
  secret: "b3dfb24c316f84145d1af42a05ebec26d2967a6cc2a73f833aed2ce8d5b2a226",
  pubkey: "5db4ad6ddf4eb33b710bce344e8663a29689738a1bb153129276e1e383f83e02",
};

/* One REQ against one relay. Resolves with the events it sent and whether
   it actually finished answering (EOSE): a relay that errors, refuses or
   times out has told us nothing, which is different from "no matches".
   Works in browsers and Node 22+. */
export function queryRelay(relay, filter, ms = 6000) {
  return new Promise((resolve) => {
    const events = [];
    let ws;
    let answered = false;
    const finish = () => {
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      resolve({ events, answered });
    };
    const timer = setTimeout(finish, ms);
    try {
      ws = new WebSocket(relay);
    } catch {
      return finish();
    }
    ws.onopen = () => ws.send(JSON.stringify(["REQ", "q", filter]));
    ws.onmessage = (m) => {
      const [type, , event] = JSON.parse(m.data);
      if (type === "EVENT") events.push(event);
      if (type === "EOSE") {
        answered = true;
        finish();
      }
      // e.g. "rate-limited": the relay won't answer this subscription.
      if (type === "CLOSED") finish();
    };
    // A relay that refuses or drops the connection is done, not slow.
    ws.onerror = finish;
    ws.onclose = finish;
  });
}

/* Every version of the form event the relays hold, newest first, unverified:
   the caller takes the newest one whose signature checks out (a forged
   "newer" version from one relay mustn't hide a genuine one from another). */
export async function fetchFormVersions(relays = DEMO_FORM.relays, ms) {
  const filter = { kinds: [30168], authors: [DEMO_FORM.pubkey], "#d": [DEMO_FORM.id] };
  const found = (await Promise.all(relays.map((r) => queryRelay(r, filter, ms)))).flatMap((r) => r.events);
  const unique = new Map(found.filter((e) => e.pubkey === DEMO_FORM.pubkey).map((e) => [e.id, e]));
  return [...unique.values()].sort((a, b) => b.created_at - a.created_at);
}

/* The raw tags @formstr/sdk's normalizeForm expects for a public form. */
export const sdkRawTags = (event) => [...event.tags, ["pubkey", event.pubkey]];

const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/* The question the results tally: the form's first choice field, read
   straight from the event's tags (["field", id, "option", label, optionsJSON, …]). */
export function talliedQuestion(event) {
  for (const t of event.tags) {
    if (t[0] !== "field" || t[2] !== "option") continue;
    try {
      const options = JSON.parse(t[4] || "[]").map((o) => ({ id: o[0], label: stripHtml(o[1]) }));
      if (options.length) return { id: t[1], label: stripHtml(t[3]), options };
    } catch {
      /* malformed options: try the next field */
    }
  }
  return null;
}

const escapeHtml = (s) => s.replace(/&(?!(?:[a-z]+|#\d+);)/gi, "&amp;");

/* The SDK renders neutral HTML, but labels aren't tied to their inputs, the
   required flag isn't rendered, and paragraph fields come out as one-line
   inputs. Fix those from the form's own field metadata, so the pass follows
   whatever fields the form has. (Fixed upstream in formstr-hq/nostr-forms#513;
   this goes once that ships.) */
export function enhanceFormHtml(html, form) {
  let h = escapeHtml(html);
  for (const id of form.fieldOrder) {
    const f = form.fields[id];
    const req = f.config?.required ? " required" : "";
    const input = `<input type="text" name="${id}" />`;
    if (h.includes(input)) {
      h = h.replace(
        new RegExp(`<label>([^<]*)</label>(\\s*)${input.replace(/[/]/g, "\\/")}`),
        (_, label, gap) =>
          `<label for="q-${id}">${label}</label>${gap}` +
          (f.config?.renderElement === "paragraph"
            ? `<textarea id="q-${id}" name="${id}" rows="3"${req}></textarea>`
            : `<input type="text" id="q-${id}" name="${id}" autocomplete="off"${req} />`),
      );
    } else if (f.options) {
      h = h.replace(
        `<div class="option-group">\n          <div class="option-label">`,
        `<div class="option-group" role="radiogroup" aria-labelledby="q-${id}"${f.config?.required ? ' aria-required="true"' : ""}>\n          <div class="option-label" id="q-${id}">`,
      );
      if (req)
        h = h.replace(
          `<input type="radio" name="${id}" value="${f.options[0].id}" />`,
          `<input type="radio" name="${id}" value="${f.options[0].id}" required />`,
        );
    }
  }
  return h.replace(/\n\s*\n/g, "\n").trim();
}

const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g), (b) => parseInt(b, 16));

/* Decrypt a response sent from this page, with the published results key. */
export async function decryptResponse(event) {
  const { nip44 } = await import("nostr-tools");
  const conv = nip44.v2.utils.getConversationKey(hexToBytes(DEMO_RESULTS_KEY.secret), DEMO_FORM.pubkey);
  return JSON.parse(nip44.v2.decrypt(event.content, conv));
}

/* The live tally, computed right here: the responses from every relay the
   form lists (relays are flaky and don't all hold every response, so their
   answers are combined), each signature-checked and decrypted with the
   results key. `form` is the current, verified form event (for the question
   and relays). Returns null when no relay answered at all: that's "couldn't
   check", not "no responses". Counts only; free text is never returned. */
export async function fetchResults(form, { includes } = {}) {
  const { verifyEvent } = await import("nostr-tools");
  const question = talliedQuestion(form);
  if (!question) return null;
  const optionIds = new Set(question.options.map((o) => o.id));
  const listed = form.tags.filter((t) => t[0] === "relay").map((t) => t[1]);
  const relays = (listed.length ? listed : DEMO_FORM.relays).slice(0, 8);
  // Only responses sent from this page (signed with the results key).
  const filter = {
    kinds: [1069],
    authors: [DEMO_RESULTS_KEY.pubkey],
    "#a": [`30168:${DEMO_FORM.pubkey}:${DEMO_FORM.id}`],
    limit: 1000,
  };
  const answers = await Promise.all(relays.map((r) => queryRelay(r, filter)));
  if (!answers.some((a) => a.answered)) return null;
  const seen = new Map();
  for (const ev of answers.flatMap((a) => a.events)) seen.set(ev.id, ev);

  const counts = Object.fromEntries(question.options.map((o) => [o.id, 0]));
  const counted = [];
  for (const ev of seen.values()) {
    // Anyone can publish to a relay: only correctly signed responses count.
    if (ev.kind !== 1069 || ev.pubkey !== DEMO_RESULTS_KEY.pubkey || !verifyEvent(ev)) continue;
    let answers;
    try {
      answers = await decryptResponse(ev);
    } catch {
      continue;
    }
    const choice = answers.find((t) => t[0] === "response" && t[1] === question.id)?.[2];
    if (!optionIds.has(choice)) continue;
    counts[choice]++;
    counted.push({ id: ev.id, choice, at: ev.created_at });
  }
  counted.sort((a, b) => b.at - a.at);
  return {
    question,
    total: counted.length,
    counts,
    recent: counted.slice(0, 6).map(({ choice, at }) => ({ choice, at })),
    ...(includes ? { includes: counted.some((c) => c.id === includes) } : {}),
    updatedAt: Math.floor(Date.now() / 1000),
  };
}
