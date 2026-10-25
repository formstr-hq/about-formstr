// Build step: snapshot the hero's example form ("Site visit feedback").
//
// The snapshot is only the first paint: the browser checks the relays for a
// newer version right after load (see Hero in src/App.tsx), so edits made in
// Formstr show up without a redeploy. Saved here:
// - the newest signed form event across the relays (a relay that missed an
//   edit still serves the old version, so several are asked),
// - the form normalized and rendered to HTML with @formstr/sdk.
// (Results are computed live in the browser; see fetchResults in src/lib/form.mjs.)
// If the relays can't be reached, the committed src/data/demo-form.json is
// kept and the build carries on.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FormstrSDK } from "@formstr/sdk";
import { verifyEvent } from "nostr-tools";
import { DEMO_FORM, enhanceFormHtml, fetchFormVersions, sdkRawTags } from "../src/lib/form.mjs";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data/demo-form.json");

try {
  // The newest version whose signature checks out.
  const event = (await fetchFormVersions(DEMO_FORM.relays, 8000)).find((e) => verifyEvent(e));
  if (!event) throw new Error("no validly signed form found on relays");
  const sdk = new FormstrSDK();
  const form = sdk.normalizeForm(sdkRawTags(event));
  if (!form.fieldOrder?.length) throw new Error("form has no fields");
  const html = enhanceFormHtml(sdk.renderHtml(form).html.form, form);
  delete form.html;
  fs.writeFileSync(
    out,
    JSON.stringify({ naddr: DEMO_FORM.naddr, fetchedAt: new Date().toISOString(), form, html, event }, null, 2) + "\n",
  );
  console.log(`demo form: snapshot of "${form.name}" (${form.fieldOrder.length} field${form.fieldOrder.length === 1 ? "" : "s"}, ${new Date(event.created_at * 1000).toISOString()})`);
} catch (err) {
  console.warn(`demo form: kept committed ${path.relative(process.cwd(), out)} (${err.message})`);
}
// Relay sockets may linger; don't let them hold the build.
process.exit(0);
