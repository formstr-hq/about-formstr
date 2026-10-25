// Types for ./form.mjs.
export type NostrEvent = {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
};
export type Question = { id: string; label: string; options: { id: string; label: string }[] };
export type FormLike = {
  fieldOrder: string[];
  fields: Record<string, { options?: { id: string }[]; config?: { required?: boolean; renderElement?: string } }>;
};

export const DEMO_FORM: { naddr: string; pubkey: string; id: string; relays: string[] };
export const DEMO_RESULTS_KEY: { secret: string; pubkey: string };
export type Results = {
  question: Question;
  total: number;
  counts: Record<string, number>;
  recent: { choice: string; at: number }[];
  includes?: boolean;
  updatedAt: number;
};
export function decryptResponse(event: NostrEvent): Promise<string[][]>;
export function fetchResults(form: NostrEvent, opts?: { includes?: string }): Promise<Results | null>;
export function queryRelay(relay: string, filter: object, ms?: number): Promise<{ events: NostrEvent[]; answered: boolean }>;
export function fetchFormVersions(relays?: string[], ms?: number): Promise<NostrEvent[]>;
export function sdkRawTags(event: NostrEvent): string[][];
export function talliedQuestion(event: NostrEvent): Question | null;
export function enhanceFormHtml(html: string, form: FormLike): string;
