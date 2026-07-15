import type { BouquetState } from '../builder/state/schema';

export interface CreateLinkResponse {
  id: string;
  url: string;
}

export async function createShareLink(state: BouquetState): Promise<CreateLinkResponse> {
  const res = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    throw new Error(`Failed to create share link (${res.status})`);
  }
  return res.json();
}
