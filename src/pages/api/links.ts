import type { APIRoute } from 'astro';
import { CARD_LIMITS, MAX_BLOOMS, MIN_BLOOMS, isValidBouquetState, totalBloomCount } from '../../builder/state/schema';
import { generateShortId } from '../../lib/shortId';
import { getKv } from '../../lib/kv';

export const prerender = false;

const MAX_PAYLOAD_BYTES = 20_000;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * The only write path in the app. Stores the bouquet+card state once,
 * keyed by a short id — no auth, no update/delete, matching the locked
 * scope (immutable, unlimited-view, no tracking).
 */
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!isValidBouquetState(parsed)) return badRequest('Invalid bouquet state');

  const total = totalBloomCount(parsed);
  if (total < MIN_BLOOMS || total > MAX_BLOOMS) return badRequest(`Bloom count must be ${MIN_BLOOMS}-${MAX_BLOOMS}`);

  const { card } = parsed;
  if (
    card.greeting.length > CARD_LIMITS.greeting ||
    card.message.length > CARD_LIMITS.message ||
    card.signature.length > CARD_LIMITS.signature
  ) {
    return badRequest('Card field exceeds length limit');
  }

  const id = generateShortId();
  const kv = getKv();
  await kv.set(id, JSON.stringify({ id, state: parsed, createdAt: Date.now() }));

  const url = new URL(`/r/${id}`, request.url).toString();
  return new Response(JSON.stringify({ id, url }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
