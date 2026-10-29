// Vercel serverless function: POST /api/plan
// Calls Google Gemini with the user's event details and returns a clean plan.
// The API key stays on the server (GEMINI_API_KEY env var).
import { normalizeInput, sanitizePlan, buildPrompt, buildRefinePrompt } from '../lib/plan-core.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ENDPOINT = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const RETRYABLE = new Set([429, 500, 503]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries when Gemini is busy (429/5xx), with a short backoff.
export async function callGemini(prompt, key, fetchImpl = fetch, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await callGeminiOnce(prompt, key, fetchImpl);
    } catch (err) {
      if (i >= attempts || !RETRYABLE.has(err.status)) throw err;
      console.warn(`[api/plan] Gemini busy (${err.status}), retry ${i}/${attempts - 1}`);
      await wait(1000 * 2 ** (i - 1) + Math.random() * 500);
    }
  }
}

async function callGeminiOnce(prompt, key, fetchImpl) {
  const res = await fetchImpl(ENDPOINT(MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    const err = new Error(`Gemini request failed (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  const json = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  return JSON.parse(json);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'The AI service is not configured on the server.', code: 'NO_KEY' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const input = normalizeInput(body.input);
  const isRefine = body.mode === 'refine';
  if (isRefine && (!body.plan || !String(body.message || '').trim())) {
    return res.status(400).json({ error: 'A plan and a change request are needed to refine.' });
  }

  try {
    const prompt = isRefine
      ? buildRefinePrompt(input, sanitizePlan(body.plan, input), body.message)
      : buildPrompt(input);
    const raw = await callGemini(prompt, key);
    const plan = sanitizePlan(raw, input);
    if (!plan.budget.length || !plan.timeline.length) throw new Error('The AI returned an incomplete plan.');
    return res.status(200).json({ plan, source: 'gemini', model: MODEL });
  } catch (err) {
    console.error('[api/plan]', err?.message || err);
    return res.status(502).json({ error: 'The AI could not create a plan right now. Please try again.', code: 'AI_ERROR' });
  }
}
