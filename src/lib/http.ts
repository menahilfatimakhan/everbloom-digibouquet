import type { BouquetState } from '../builder/state/schema';
import { encodeState } from '../builder/state/encode';

export interface CreateLinkResponse {
  id: string;
  url: string;
}

/**
 * Builds the share link. The bouquet travels *inside* the URL as a compressed
 * token rather than as a key into server-side storage.
 *
 * This replaced a POST to /api/links that returned a short id, which was broken
 * two ways at once. The route stored the bouquet through the KV adapter, which
 * ships as an in-memory Map — every serverless invocation gets a fresh, empty
 * one, so a link was dead before the recipient could open it. And it built its
 * URL from `request.url`, which the Vercel adapter reports as
 * `https://localhost`, so the link handed to the sender pointed at their own
 * machine.
 *
 * A self-contained token fixes both and needs no provisioning: nothing is
 * stored, so nothing can be lost, links never expire, and they survive
 * redeploys. The origin comes from the page the sender is actually on, so it
 * cannot disagree with where they are.
 *
 * The cost is URL length — about 570 characters for a typical bouquet and
 * ~2100 for the worst case (a maximum-length message plus a dense signature
 * doodle), both well inside browser and messaging-app limits.
 */
export async function createShareLink(state: BouquetState): Promise<CreateLinkResponse> {
  const token = encodeState(state);
  if (!token) throw new Error('Could not encode this bouquet');
  return { id: token, url: new URL(`/r/${token}`, window.location.origin).toString() };
}
