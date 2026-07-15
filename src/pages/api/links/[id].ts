import type { APIRoute } from 'astro';
import { getKv } from '../../../lib/kv';

export const prerender = false;

/** Read-only lookup — no update/delete endpoints exist for this resource. */
export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  const record = await getKv().get(id);
  if (!record) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(record, { status: 200, headers: { 'Content-Type': 'application/json' } });
};
