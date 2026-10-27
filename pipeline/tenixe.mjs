// Minimal Tenixe client: streaming chat, per-call key fallback, billing stop.
// Keys come from env TENIXE_KEYS="key1,key2,..." — never write them into files.
const BASE_URL = "https://api.tenixe.com/api/v1";
const list = name => (process.env[name] || "").split(",").map(k => k.trim()).filter(Boolean);
// TENIXE_NEMOTRON_KEYS: keys where nemotron-3-ultra is unlimited. They are never used for other (billed) models.
const keysFor = model => (model === "nemotron-3-ultra" ? [...list("TENIXE_NEMOTRON_KEYS"), ...list("TENIXE_KEYS")] : list("TENIXE_KEYS"));
export const hasKeys = () => list("TENIXE_KEYS").length + list("TENIXE_NEMOTRON_KEYS").length > 0;

export class BillingStop extends Error {}

// Haiku does the work; reasoning models need a large max_tokens or they return nothing.
// EXTRACT_MODELS="nemotron-3-ultra,claude-haiku-5-5" changes the order.
const MAX_TOKENS = { "claude-haiku-5-5": 4000, "deepseek-v4-flash": 24000, "nemotron-3-ultra": 8000 };
// Spotting events among headlines needs judgement → Haiku first. Rewriting article text is easy → unlimited Nemotron first.
export const ORDERS = {
  extract: process.env.EXTRACT_MODELS || "claude-haiku-5-5,nemotron-3-ultra,deepseek-v4-flash",
  describe: process.env.DESCRIBE_MODELS || "nemotron-3-ultra,claude-haiku-5-5",
};
const models = order => order.split(",").map(model => ({ model, maxTokens: MAX_TOKENS[model] ?? 8000 }));

async function chatOnce(key, model, messages, maxTokens) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  let text = "", buf = "", finish = null;
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (p === "[DONE]") continue;
      const e = JSON.parse(p);
      if (e.error) throw new Error(JSON.stringify(e.error));
      text += e.choices?.[0]?.delta?.content ?? "";
      finish = e.choices?.[0]?.finish_reason ?? finish;
    }
  }
  if (!text.trim()) throw new Error(`empty completion (finish=${finish})`);
  return text;
}

const sleep = s => new Promise(r => setTimeout(r, s * 1000));

/** Tries each extractor model on each key until one answers. Billing errors stop the run. */
export async function extract(messages, order = ORDERS.extract) {
  if (!hasKeys()) throw new Error("No keys: set TENIXE_KEYS or TENIXE_NEMOTRON_KEYS");
  let last;
  for (const { model, maxTokens } of models(order)) {
    for (const key of keysFor(model)) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return { model, text: await chatOnce(key, model, messages, maxTokens) };
        } catch (e) {
          last = e;
          if (/unpaid|add credits|wallet/i.test(e.message)) throw new BillingStop(`billing stop on key ${key.slice(0, 8)}: ${e.message.slice(0, 200)}`);
          if (/concurrent_streams_exceeded/i.test(e.message)) { await sleep(6); continue; }
          if (/^(402|429)|quota|rate.?limit|insufficient/i.test(e.message)) break; // next key
          if (/UNAVAILABLE|empty completion|upstream_timeout|^5\d\d/i.test(e.message)) { await sleep(20); continue; }
          break; // other errors: try next key
        }
      }
    }
  }
  throw last;
}
