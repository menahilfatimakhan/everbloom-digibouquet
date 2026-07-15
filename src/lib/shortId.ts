import { customAlphabet } from 'nanoid';

// Unambiguous URL-safe alphabet (no 0/O/1/l/I) for ids people might read aloud.
const nanoid = customAlphabet('23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', 8);

export function generateShortId(): string {
  return nanoid();
}
