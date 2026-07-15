# The `BouquetState` schema

Defined in `src/builder/state/schema.ts`. This one object is the entire bouquet + card — it's what gets compressed into a shareable URL token (`encode.ts`/`decode.ts`) and it's the exact payload stored server-side at `POST /api/links`. Both paths use the identical shape on purpose (see `docs/architecture.md`).

```ts
interface BouquetState {
  v: number;                     // schema version — decode.ts rejects tokens newer than SCHEMA_VERSION
  blooms: { species: string; qty: number }[]; // species id -> content/flowers.json; total qty is 6-10
  greenery: string | null;       // greenery id -> content/greenery.json
  arrangementSeed: number;       // drives the procedural layout — same seed always renders the same bouquet
  occasion: string | null;       // occasion preset id, informational only, never restricts flower choice
  presentation: {
    type: 'wrap' | 'vase';
    wrap: string | null;         // id -> content/presentation.json .wraps
    vase: string | null;         // id -> content/presentation.json .vases
    ribbon: string | null;       // id -> content/presentation.json .ribbons
    theme: string;               // id -> content/presentation.json .themes
  };
  card: {
    greeting: string;
    message: string;
    signature: string;
    font: string;                // id -> content/cardFonts.json
    doodle: string | null;       // SVG path `d` data drawn on a 300x100 signature pad, or null
  };
}
```

## Changing the schema later
Bump `SCHEMA_VERSION` in `schema.ts` whenever the shape changes in a way that would break decoding an old URL token or an old stored record. `decode.ts` already refuses to decode a token whose `v` is newer than what the running code supports, so old shared links degrade to "start fresh" instead of crashing — but there's currently no migration path for *old* tokens under a *new* schema (v1 -> v2). If that's ever needed, add a migration step in `decode.ts` keyed off `v` before validating.
