/**
 * Bloom Assistant server.
 *
 * A thin, stateless proxy between the Bloom app and the OpenAI API:
 *   - the OpenAI API key lives only here, never in the app;
 *   - requests use store: false, so OpenAI keeps no conversation state;
 *   - every request must carry a signed-in Bloom (Supabase) access token;
 *   - each account gets DAILY_LIMIT messages per UTC day;
 *   - replies stream back as server-sent events;
 *   - nothing a person writes is stored or logged. Logs hold only status,
 *     timing and token counts.
 *
 * Env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
 *      OPENAI_MODEL (default gpt-5.5), DAILY_LIMIT (default 40), PORT (default 8080).
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

import OpenAI from 'openai';

import { SYSTEM_PROMPT } from './prompt.mjs';
import { parseChatRequest, toApiMessages } from './validate.mjs';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const PORT = Number(process.env.PORT ?? 8080);
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT ?? 40);
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const MAX_BODY = 200_000;

for (const [name, value] of Object.entries({ OPENAI_API_KEY: process.env.OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY })) {
  if (!value) {
    console.error(`bloom-assistant: ${name} is not set`);
    process.exit(1);
  }
}

const openai = new OpenAI();

// --- auth ------------------------------------------------------------------

/** token hash → { userId, expires }; avoids a round trip on every message. */
const tokenCache = new Map();

async function userIdFor(authorization) {
  const token = /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
  if (!token) return null;
  const key = createHash('sha256').update(token).digest('hex');
  const cached = tokenCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.userId;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  tokenCache.set(key, { userId: user.id, expires: Date.now() + 60_000 });
  if (tokenCache.size > 5000) tokenCache.clear();
  return user.id;
}

// --- daily limit -----------------------------------------------------------
// In memory: resets if the service restarts, which only ever errs in the
// person's favour. Move to the database if the service scales past one copy.

let usageDay = '';
const usage = new Map();

function takeMessage(userId) {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== usageDay) {
    usageDay = day;
    usage.clear();
  }
  const used = usage.get(userId) ?? 0;
  if (used >= DAILY_LIMIT) return false;
  usage.set(userId, used + 1);
  return true;
}

function giveBack(userId) {
  const used = usage.get(userId) ?? 0;
  if (used > 0) usage.set(userId, used - 1);
}

// --- http helpers ----------------------------------------------------------

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('bad json'), { status: 400 });
  }
}

function sse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const REFUSAL_TEXT =
  'I can’t help with that one. If it’s about your health and it feels urgent, please contact a doctor, pharmacist or your local emergency services.';

function friendlyApiError(error) {
  if (error instanceof OpenAI.RateLimitError) return 'Bloom Assistant is busy right now. Please try again in a minute.';
  if (error instanceof OpenAI.APIConnectionError) return 'Bloom Assistant couldn’t connect. Please try again.';
  if (error instanceof OpenAI.APIError && (error.status ?? 0) >= 500) return 'Bloom Assistant is having trouble. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

// --- chat ------------------------------------------------------------------

async function chat(req, res) {
  const userId = await userIdFor(req.headers.authorization);
  if (!userId) return sendJson(res, 401, { error: 'Please sign in to use Bloom Assistant.' });

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, e.status ?? 400, { error: 'Invalid request.' });
  }
  const parsed = parseChatRequest(body);
  if (parsed.error) return sendJson(res, 400, { error: parsed.error });

  if (!takeMessage(userId)) {
    return sendJson(res, 429, { error: `You’ve reached today’s limit of ${DAILY_LIMIT} messages. It resets at midnight (UTC).` });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const started = Date.now();
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    const stream = await openai.responses.create(
      {
        model: MODEL,
        instructions: SYSTEM_PROMPT,
        input: toApiMessages(parsed.messages, parsed.summary),
        max_output_tokens: 8000,
        reasoning: { effort: 'low' },
        store: false,
        stream: true,
        // A hash of the account, never the id itself: lets OpenAI spot abuse.
        safety_identifier: createHash('sha256').update(userId).digest('hex'),
      },
      { signal: abort.signal },
    );

    let final = null;
    let refused = false;
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') sse(res, { type: 'text', text: event.delta });
      else if (event.type === 'response.refusal.delta') refused = true;
      else if (event.type === 'response.completed' || event.type === 'response.incomplete') final = event.response;
      else if (event.type === 'response.failed') throw Object.assign(new Error('response failed'), { status: 500 });
    }
    const stop = refused ? 'refusal' : final?.status === 'incomplete' ? (final.incomplete_details?.reason ?? 'incomplete') : 'end';
    if (refused) sse(res, { type: 'replace', text: REFUSAL_TEXT });
    sse(res, { type: 'done', stop, remaining: Math.max(0, DAILY_LIMIT - (usage.get(userId) ?? 0)) });
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ms: Date.now() - started,
        stop,
        model: final?.model,
        in: final?.usage?.input_tokens,
        cached: final?.usage?.input_tokens_details?.cached_tokens,
        out: final?.usage?.output_tokens,
        summary: !!parsed.summary,
      }),
    );
  } catch (error) {
    if (abort.signal.aborted) return; // the person closed the chat
    giveBack(userId);
    console.error(JSON.stringify({ at: new Date().toISOString(), error: error?.constructor?.name, status: error?.status }));
    sse(res, { type: 'error', message: friendlyApiError(error) });
  } finally {
    res.end();
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true });
  if (req.method === 'POST' && url.pathname === '/v1/chat') {
    chat(req, res).catch((e) => {
      console.error(JSON.stringify({ at: new Date().toISOString(), error: e?.constructor?.name }));
      if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
      else res.end();
    });
    return;
  }
  sendJson(res, 404, { error: 'Not found' });
}).listen(PORT, () => console.log(`bloom-assistant listening on ${PORT}`));
