// Optional AI layer: asks a free OpenRouter model to explain, in plain
// language, why a task is at risk and suggest one action. It is an add-on:
// the rule-based score always works without it, and every failure returns
// null so the caller can simply show nothing.
//
// Privacy: only structured facts are sent (status, priority, hours left,
// workload counts, reason codes). No titles, descriptions, names or emails.

const crypto = require('crypto');

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY || '';
// comma-separated list, tried in order; free models are often rate limited
const MODELS = (process.env.OPENROUTER_MODEL ||
  'google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3-ultra-550b-a55b:free')
  .split(',').map((m) => m.trim()).filter(Boolean);

const TIMEOUT_MS = 18000;
const CACHE_TTL_MS = 6 * 3600 * 1000;
const MAX_CALLS_PER_MIN = 10;

const cache = new Map();     // `${taskId}:${lang}` -> { sig, text, model, at }
const inflight = new Map();  // same key -> Promise
let recentCalls = [];

const isEnabled = () => Boolean(API_KEY) && MODELS.length > 0;

function budgetAvailable(now = Date.now()) {
  recentCalls = recentCalls.filter((t) => now - t < 60000);
  return recentCalls.length < MAX_CALLS_PER_MIN;
}

const LANG_NAME = { th: 'Thai', en: 'English' };

function buildMessages(facts, lang) {
  return [
    {
      role: 'system',
      content:
        'You help a team lead understand why a task may miss its due date. ' +
        `Reply in ${LANG_NAME[lang] || 'English'}. Write two short sentences explaining the risk, ` +
        'then one concrete suggested action starting with a verb. Use only the facts given and ' +
        'do not invent details such as names or numbers. Plain text only, no markdown, under 60 words.',
    },
    { role: 'user', content: JSON.stringify(facts) },
  ];
}

async function callModel(model, messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      // reasoning models spend part of the budget on thinking, so leave headroom
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1200 }),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim().length < 20) return { error: 'empty' };
    return { text: text.trim().replace(/\*\*/g, '') };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

// task: { id, status, priority }, risk: { level, reasons }, ctx: facts from the route
async function explainRisk(task, risk, facts, lang = 'th') {
  if (!isEnabled() || !risk || risk.level === 'low') return null;

  const key = `${task.id}:${lang}`;
  const sig = crypto.createHash('sha1').update(JSON.stringify([facts, risk.reasons])).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.sig === sig && Date.now() - hit.at < CACHE_TTL_MS) {
    return { text: hit.text, model: hit.model, cached: true };
  }
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    const messages = buildMessages({ ...facts, riskLevel: risk.level, reasons: risk.reasons }, lang);
    for (const model of MODELS) {
      if (!budgetAvailable()) return null;
      recentCalls.push(Date.now());
      const out = await callModel(model, messages);
      if (out.text) {
        cache.set(key, { sig, text: out.text, model, at: Date.now() });
        return { text: out.text, model, cached: false };
      }
      console.warn(`[ai] ${model} failed: ${out.error}`);
    }
    return null;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

module.exports = { explainRisk, isEnabled, MODELS };
