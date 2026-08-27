# NOVELLE READER — Knowledge Base

*Compiled 2026-08-25 from `D:/project/feralicious` and `D:/project/THE SMUT`. This is the
standing brief for building the interactive novelle reader as a Feralicious category.*

---

## 1. Feralicious — the platform

**Tagline:** *Software that got out.* An honesty-first home for games, apps and downloads.
Everything opens for free. Feral Coins buy extras or support creators — never access.
The free path always reaches the ending.

### The three promises (from BRAND.md)

1. **Everything opens.** No paywalls; support is a choice.
2. **Nothing is compulsory.** No daily rewards, streaks, timers, loot boxes.
3. **Nothing is judged.** Cozy and filthy sit on the same shelf. The only content line:
   *depiction is permitted, endorsement is not* — cruelty must be treated as cruelty.

### Actual tech stack (repo reality, not the older Django spec in TECHNICAL.md)

| Layer | Choice |
|---|---|
| Site | Next.js 16 + React 19 (`vinext`) server-rendered |
| Build | Vite 8, TypeScript 5.9, Tailwind 4 |
| Hosting | Cloudflare Workers + Pages (`wrangler.jsonc`) |
| Games | `games/<slug>/` — full Vite projects **or** single-file `index.html` games |
| Embedding | Sandboxed `<iframe>` from separate origins, e.g. `https://feral-slash.pages.dev` |

- Catalogue entries: `app/catalogue.ts` → `Project { id, title, kind: "GAME", tags[], adult?, access, support, playUrl }`
- Game origins are whitelisted in `worker/index.ts` under CSP `frame-src`.
- Env vars pattern: `NEXT_PUBLIC_<SLUG>_URL`.
- House rules for compact games: no paywall/coins/accounts/ads/telemetry; failure free;
  brand palette; `border-radius: 0`; mono labels.
- Adult content is **Phase 2** on the platform roadmap; an adult gate copy block already
  exists in BRAND.md ("This one's adult. … We check once, we don't keep your ID.").

### Brand system (must-follow for reader UI chrome)

Palette:

| Role | Hex | Use |
|---|---|---|
| Void | `#0B0C0A` | page background |
| Panel | `#141613` | cards/surfaces |
| Line | `#2A2E28` | borders, always 1px visible |
| Text | `#E9EAE4` | body |
| Muted | `#7C8078` | metadata |
| GROWTH | `#9BFF3D` | accent: links, actions, free things |
| Amber | `#FFB020` | anything costing money |
| Heat | `#FF4D2E` | 18+, warnings |

Type: **Archivo Black** display · **Inter** body · **JetBrains Mono** labels/data.

Visual law: no rounded corners anywhere · no shadows/gradients/glass in UI chrome ·
dense over airy · uppercase mono labels · hover = instant invert to GROWTH background ·
no emoji in interface · max one real profanity per page, usually zero.

*(The reading scene itself is illustration/atmosphere — candlelight warmth lives inside
the art layer, not the chrome.)*

---

## 2. THE SMUT folder — THE UNNAMED series

Dark fantasy erotica, four complete manuscripts (~54,000 words), fully original,
plus series bible and publication pack. Heat 5/5. Adults only.

| Book | Title | Words | Structure |
|---|---|---|---|
| One | THE HUSH | ~11,300 | 7 chapters + epilogue |
| Two | CROWN OF ASH | ~15,400 | 11 chapters + epilogue |
| Three | THE THREAD | ~14,100 | 10 chapters |
| Four | SEVEN STARS | ~13,100 | 10 chapters |

Chapters are `## ` headings (e.g. `## ONE, The Gift`, `## TWO — Candle Row`,
`## EPILOGUE, The Road to Ashwater`). Book One file: `BOOK-ONE_The-Hush.md`.

### World hooks usable by the reader's art direction

- **The Hush** — a pocket of reality where the client is the only real thing.
- **The Ebb** — after: faces/names/places gone; only *shards* survive (heat, a sound,
  a laugh). Grief with no object.
- **The Undersong** — sound-magic; its Price: no listener has birthed a child in 206 years.
- **The Three Prohibitions** — no name · no question · no seed (breaking #3 = the Long Sin).
- **Places** — Cairnmouth rain, Candle Row house (grey stone, no sign), Ashwater,
  rope-walk noise below Seraine's window.
- **Cast ch.1** — Seraine Voss (46, un-aging, grey eyes, burn scar wrist→elbow,
  smells of rain on hot stone), Nine (deliberately unremarkable Vessel), Ansel Bray
  (dry accountant-of-the-House), Ysolde Marren (neat handwriting, patience).

### Chapter ONE "The Gift" — scene map used by v1 annotations

1. Rented room above the rope-walk: sideways autumn rain at the shutter, candle going,
   wine poured not drunk, brass token worn smooth stamped with *an empty cup on its side*.
2. Memory beat: eleven people wanting her dead that morning.
3. The Unnamed lore beat: what she thought of them, what they actually sell.
4. Decision: `"Fine," she told the rain.` → hood up → out into the weather.

**Interactive beat v1:** *"Instead she sat with the brass warming in her fist…"*
→ gated hotspot **TURN THE TOKEN** → scene state swaps to token close-up
(brass, tilted empty-cup stamp) before the story continues.

---

## 3. Product decisions locked for this project

| Decision | Call |
|---|---|
| Tech | Standalone Vite + TypeScript web app at `D:/project/novelle_reader` |
| Rendering | 2.5D: DOM text on CSS-3D flipping pages inside layered painted scene (table, candle, parallax); Three.js upgrade path open |
| Voice | Web Speech API first; pluggable narrator interface so recorded MP3 chapters can slot in later |
| Sync | `onboundary` karaoke highlighting (sentence steady + word pulse), timer fallback |
| Scope v1 | Vertical slice: Book One chapter ONE fully produced (book+table+candle+flip+voice+highlight+bubbles+one interaction) |
| Content pipeline | `scripts/build-book.ts`: manuscript markdown + annotation JSON → `public/books/the-hush/book.json`. Manuscripts never edited; annotations matched by unique text snippet, not fragile indexes |
| Art | Procedural placeholders now; drop-in files in `public/books/the-hush/art/` override automatically (PNG/WebP scenes, GIF/MP4 motion) |
| Compliance | Own 18+ gate with BRAND.md copy; brand chrome; everything opens free; no telemetry; minimal localStorage only for position/settings |
| File discipline | Every source file stays under ~550 lines; split non-destructively when exceeded |

## 4. Later integration checklist (into feralicious)

1. Deploy `novelle_reader/dist` to Cloudflare Pages → own origin.
2. Add env var `NEXT_PUBLIC_NOVELLE_URL` and catalogue entry with `kind: "BOOK"`,
   tags `["BOOK","18+"]`, `adult: true`.
3. Add origin to `frame-src` list in `worker/index.ts`.
4. Reader keeps its internal age gate (platform gate arrives with Phase 2 accounts).
5. Category shelf section: `NOVELLE — books that read themselves` (brand voice review).
