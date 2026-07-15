import { decompressFromEncodedURIComponent } from 'lz-string';
import { isValidBouquetState, SCHEMA_VERSION, type BouquetState } from './schema';

/**
 * Reverses encodeState. Returns null on any failure (corrupt token, JSON
 * error, wrong shape, or an unrecognized future schema version) rather than
 * throwing — callers treat a null decode as "start fresh."
 */
export function decodeState(token: string): BouquetState | null {
  try {
    const json = decompressFromEncodedURIComponent(token);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!isValidBouquetState(parsed)) return null;
    if (parsed.v > SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}
