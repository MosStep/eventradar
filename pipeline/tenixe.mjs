// AI client for two OpenAI-compatible providers, with streaming chat, per-call key fallback, billing stop,
// rate-limit backoff and a breaker per provider.
//  - Tenixe (https://api.tenixe.com/api/v1): keys in TENIXE_KEYS / TENIXE_NEMOTRON_KEYS.
//  - AIUnlimit (env AIU_BASE_URL, default https://aiunlimit.thirx.com/api/v1): keys in AIU_KEYS. Its model ids carry a
//    node prefix (rb/, cb/, mr/). Any model id containing "/" is routed to AIUnlimit, everything else to Tenixe.
// Keys are read from env only — never write them into files.
import { errorKind, slidingLimiter } from "./lib.mjs";
const TENIXE_URL = "https://api.tenixe.com/api/v1";
const AIU_URL = "https://aiunlimit.thirx.com/api/v1";
const PROVIDERS = ["tenixe", "aiu"];
const list = name => (process.env[name] || "").split(",").map(k => k.trim()).filter(Boolean);

// Pure routing: which provider serves a model id.
export const providerOf = model => (String(model).includes("/") ? "aiu" : "tenixe");
const baseOf = p => (p === "aiu" ? (process.env.AIU_BASE_URL || AIU_URL).replace(/\/+$/, "") : TENIXE_URL);
// TENIXE_NEMOTRON_KEYS: keys where nemotron-3-ultra is unlimited. They are never used for other (billed) models.
const keysFor = model => {
  if (providerOf(model) === "aiu") return list("AIU_KEYS");
  return model === "nemotron-3-ultra" ? [...list("TENIXE_NEMOTRON_KEYS"), ...list("TENIXE_KEYS")] : list("TENIXE_KEYS");
};
const hasProviderKeys = p => (p === "aiu" ? list("AIU_KEYS").length > 0 : list("TENIXE_KEYS").length + list("TENIXE_NEMOTRON_KEYS").length > 0);
export const hasKeys = () => PROVIDERS.some(hasProviderKeys);
export const aiuOn = () => hasProviderKeys("aiu");
// Parallel workers when a chain starts with AIUnlimit (AIU_CONCURRENCY, default 12).
export const aiuConcurrency = () => Math.max(1, Number(process.env.AIU_CONCURRENCY) || 12);
// AIUnlimit allows 120 requests a minute for the whole account, shared with other programs. Each runner caps its own
// starts with AIU_RPM (default 80; local loop 50, GitHub 30 — see the comments in scripts/loop.ps1 and daily.yml).
const aiuAcquire = slidingLimiter(Number(process.env.AIU_RPM) || 80, 60e3);
// Keys that can run Nemotron, one stream each — the number of batches that can run at the same time.
// Keys that ran out of quota for a model are skipped for the rest of the run (daily keys reset at 13:00 Thai time).
const exhausted = new Set(); // "model|key"
export const nemotronKeys = () => [...new Set(keysFor("nemotron-3-ultra"))].filter(k => !exhausted.has(`nemotron-3-ultra|${k}`));

// Parallel workers for a batch job: a chain that starts with AIUnlimit gets AIU_CONCURRENCY workers (round-robin over
// its keys); a Nemotron chain gets one worker per Nemotron key; anything else runs one worker without a key preference.
const firstModel = order => order.split(",")[0].trim();
export function workersFor(order) {
  const first = firstModel(order);
  if (providerOf(first) === "aiu" && aiuOn()) {
    const ks = list("AIU_KEYS");
    return Array.from({ length: aiuConcurrency() }, (_, i) => ks[i % ks.length]);
  }
  return first.startsWith("nemotron") && nemotronKeys().length ? nemotronKeys() : [null];
}

export class BillingStop extends Error {}
// The provider is busy or out of quota: callers must not count this against the item (busy = true).
export class ProviderDown extends Error { busy = true; }

// Provider rate limits and quota errors in a row trip that provider's breaker: its calls fail at once without a network
// request for the rest of the run. AI is "down" for the run only when every provider with keys is down (or haltAi ran).
const BREAK_AT = 8;
const RATE_BACKOFF = [15, 30, 60]; // seconds to wait before the same call is retried on a rate limit
const consec = { tenixe: 0, aiu: 0 };
const down = { tenixe: null, aiu: null }; // reason string when that provider's breaker tripped
let halted = null; // run-wide stop (run time budget or haltAi)
let budgetOut = false; // halted because the run time budget was used up (not a provider problem)
const activeProviders = () => PROVIDERS.filter(hasProviderKeys);
export const aiDown = () => halted !== null || (activeProviders().length > 0 && activeProviders().every(p => down[p] !== null));
export const aiDownReason = () => halted ?? activeProviders().filter(p => down[p]).map(p => `${p}: ${down[p]}`).join("; ");
export const haltAi = reason => { halted ??= reason; };
export const haltBudget = reason => { budgetOut = true; haltAi(reason); };
// True when the AI steps stopped only because the run time budget ran out (no provider trouble).
export const aiBudgetOut = () => budgetOut;
// True when a provider is busy or out of quota (breakers tripped), ignoring the time budget.
export const aiBusy = () => activeProviders().length > 0 && activeProviders().every(p => down[p] !== null);

const stats = { calls: 0, failed: 0, quota: new Set(), billing: false, by: { tenixe: { calls: 0, failed: 0 }, aiu: { calls: 0, failed: 0 } } };
export const keyStats = () => ({ calls: stats.calls, failed: stats.failed, quota: [...stats.quota], billing: stats.billing,
  keys: new Set([...list("TENIXE_KEYS"), ...list("TENIXE_NEMOTRON_KEYS"), ...list("AIU_KEYS")]).size,
  providers: { tenixe: { ...stats.by.tenixe }, aiu: { ...stats.by.aiu } } });

// Reasoning models need a large max_tokens or they return nothing.
const MAX_TOKENS = { "claude-haiku-5-5": 4000, "deepseek-v4-flash": 24000, "nemotron-3-ultra": 8000,
  "rb/deepseek-v4.1-flash": 24000, "cb/deepseek-v4.1-flash": 24000 };
// Spotting events among headlines needs judgement → Haiku first. Rewriting article text is easy → unlimited Nemotron first.
// With AIU_KEYS set, AIUnlimit comes first in every default chain. Env overrides (EXTRACT_MODELS, ...) still win.
const DEFAULT_ORDERS = aiuOn()
  ? { extract: "rb/deepseek-v4.1-flash,cb/deepseek-v4.1-flash,nemotron-3-ultra",
      describe: "rb/deepseek-v4.1-flash,rb/glm-5.3-flash,nemotron-3-ultra",
      verify: "rb/claude-haiku-5-5,rb/gpt-6-luna,claude-haiku-5-5" }
  : { extract: "claude-haiku-5-5,nemotron-3-ultra,deepseek-v4-flash",
      describe: "nemotron-3-ultra,claude-haiku-5-5",
      verify: "claude-haiku-5-5" }; // the second opinion must come from a different model
export const ORDERS = {
  extract: process.env.EXTRACT_MODELS || DEFAULT_ORDERS.extract,
  describe: process.env.DESCRIBE_MODELS || DEFAULT_ORDERS.describe,
  verify: process.env.VERIFY_MODELS || DEFAULT_ORDERS.verify,
};
const models = order => order.split(",").map(model => ({ model, maxTokens: MAX_TOKENS[model] ?? 8000 }));

// Reads an SSE stream ("data: {choices:[{delta:{content}}]}" lines), or a plain JSON completion if the server sent one.
async function chatOnce(p, key, model, messages, maxTokens) {
  const body = { model, messages, max_tokens: maxTokens, stream: true };
  if (p === "tenixe") body.stream_options = { include_usage: true };
  const res = await fetch(`${baseOf(p)}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  let text = "", finish = null;
  if (/application\/json/i.test(res.headers.get("content-type") || "")) {
    const j = await res.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    text = j.choices?.[0]?.message?.content ?? "";
    finish = j.choices?.[0]?.finish_reason ?? null;
  } else {
    const dec = new TextDecoder();
    let buf = "";
    const eat = line => {
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (data === "[DONE]" || !data) return;
      const e = JSON.parse(data);
      if (e.error) throw new Error(JSON.stringify(e.error));
      text += e.choices?.[0]?.delta?.content ?? "";
      finish = e.choices?.[0]?.finish_reason ?? finish;
    };
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      lines.forEach(eat);
    }
    buf += dec.decode();
    eat(buf);
  }
  if (!text.trim()) throw new Error(`empty completion (finish=${finish})`);
  return text;
}

const sleep = s => new Promise(r => setTimeout(r, s * 1000));

/** Tries each model in the chain on each of its keys until one answers. A provider that is down is skipped. Billing errors stop the run. */
// preferKey: try this key first (parallel workers each own one key; the others are still a fallback).
export async function extract(messages, order = ORDERS.extract, preferKey = null) {
  if (!hasKeys()) throw new Error("No keys: set TENIXE_KEYS, TENIXE_NEMOTRON_KEYS or AIU_KEYS");
  if (aiDown()) throw new ProviderDown(`AI paused: ${aiDownReason()}`);
  let last;
  for (const { model, maxTokens } of models(order)) {
    const p = providerOf(model);
    if (!hasProviderKeys(p) || down[p] !== null || halted !== null) continue; // no keys or busy: next model in the chain
    const off = () => halted !== null || down[p] !== null;
    const ks = keysFor(model).filter(k => !exhausted.has(`${model}|${k}`));
    for (const key of preferKey && ks.includes(preferKey) ? [preferKey, ...ks.filter(k => k !== preferKey)] : ks) {
      if (off()) break;
      // A busy key (the other runner is using the same one-stream Nemotron key) is waited for, up to ~2 minutes,
      // before falling back to keys whose quota may already be spent. A provider rate limit is retried on the same
      // key with backoff (RATE_BACKOFF) before moving on.
      for (let attempt = 1, busy = 0, rate = 0; attempt <= 3; attempt++) {
        if (off()) break;
        try {
          if (p === "aiu") await aiuAcquire();
          stats.calls++; stats.by[p].calls++;
          const text = await chatOnce(p, key, model, messages, maxTokens);
          consec[p] = 0;
          return { model, text };
        } catch (e) {
          last = e;
          stats.failed++; stats.by[p].failed++;
          const kind = errorKind(e.message);
          if (/quota/i.test(e.message)) stats.quota.add(key.slice(0, 8));
          if (kind === "billing") { stats.billing = true; throw new BillingStop(`billing stop on key ${key.slice(0, 8)}: ${e.message.slice(0, 200)}`); }
          if (/concurrent_streams_exceeded/i.test(e.message) && busy < 20) { busy++; attempt--; await sleep(6); continue; }
          if (kind === "rate" || kind === "quota") {
            e.busy = true; // provider-side trouble, not the item's fault
            if (++consec[p] >= BREAK_AT) down[p] ??= `${consec[p]} rate-limit or quota errors in a row`;
          }
          if (kind === "quota") { exhausted.add(`${model}|${key}`); break; } // skip this key from now on
          if (kind === "rate") {
            if (rate < RATE_BACKOFF.length && !off()) { await sleep(RATE_BACKOFF[rate++]); attempt--; continue; }
            break; // still busy after the backoff: next key
          }
          if (/UNAVAILABLE|empty completion|upstream_timeout|^5\d\d/i.test(e.message)) { await sleep(20); continue; }
          break; // other errors: try next key
        }
      }
    }
  }
  if (aiDown()) throw new ProviderDown(`AI paused: ${aiDownReason()}`);
  throw last ?? new ProviderDown("no AI keys left for this run");
}
