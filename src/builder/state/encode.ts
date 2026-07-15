import { compressToEncodedURIComponent } from 'lz-string';
import type { BouquetState } from './schema';

/** Compact, URL-safe token for the full builder state — no backend required to restore it. */
export function encodeState(state: BouquetState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}
