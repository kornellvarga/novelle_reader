# NOVELLE — an interactive reader

*Books that read themselves. A Feralicious category.*

A voice-narrated, page-flipping book that lives on a table in a candlelit 3D room.
The current sentence lights up as it is read, characters speak in bubbles beside
the scene art, and annotated moments wait for a click before the art changes.

**v0.1 vertical slice:** THE HUSH (THE UNNAMED, Book One) — chapter ONE,
"The Gift", fully produced. All eight chapters of Book One are readable as text.

---

## Run

```bash
npm install
npm run dev        # books + vite dev server → http://127.0.0.1:5180
npm run build      # books + typecheck + dist
npm run deploy:web # build + publish → https://novelle.feralicious.games/
npm run test       # headless smoke: layout → story art → 3D room → karaoke → token → street
npm run books      # recompile manuscripts + annotations → public/books/<slug>/book.json
npm run assets:feral # rebuild Book One model bundles from D:/PROJECT/feral3D/output
```

Deep links: `?voice=0` (silent read-along pacing) · `?rate=1.5` · `?debug=1`
(console traces + `window.__novelle` probe).

## Controls

| Input | Action |
|---|---|
| `←` / `→` / click page halves | flip |
| Swipe left / right | flip on touch screens |
| `Space` or PLAY | narrate with karaoke highlight; auto page turns |
| `V` or VOICE | toggle Web Speech narration ↔ silent timer pacing |
| `A−` / `A+` | text size (relayouts, keeps position) |
| Hotspot (e.g. TURN THE TOKEN) | gated interactive beat; changes the scene art |

Progress, chapter and settings persist in `localStorage`. The 18+ gate is
checked once per device, matching BRAND.md copy.

On phones, PREV / PLAY / NEXT remain in a safe-area-aware 48px control tray;
font, voice and cover actions live under TOOLS. Text repaginates when the visual
viewport or orientation changes, and long paragraphs/sentences continue across
pages instead of being clipped.

## Architecture

```
manuscripts/the-hush.md     the manuscript, untouched
annotations/the-hush.json   speakers, scenes, beats — matched by text snippet
scripts/build-book.ts       markdown + annotations → public/books/the-hush/book.json
src/core/                   engine (state, narration flow), loader, types
src/scene/                  Three.js room + Feral3D loader, book view (CSS-3D flip)
src/reader/                 pager (page flow), highlighter, bubbles, interactions
src/voice/                  narrator interface + Web Speech and timer engines
src/ui/                     age gate, cover, controls
```

The Book One room uses editable Feral3D sources for the native candle, Gothic desk,
Abbey bookcase, and Seraine's token/letter/wine props. The browser receives compact
mesh bundles from `public/books/the-hush/models/`; no Feral3D runtime is required.

Design rules: every source file under ~550 lines; manuscripts never edited;
annotations reference paragraphs by unique snippet, not index.

## Art & audio slots

Drop files into `public/books/the-hush/art/` — they override the procedural
placeholders automatically (probed at runtime, no code changes):

```
art/scenes/room.png        room.webp / .jpg also fine
art/scenes/room-token.png  interaction state art (<scene>-<state>)
art/motion/room.gif        or .webm / .mp4 — motion replaces the still
art/pages/*.webp           story-aware full-page illustrations inside the book
```

Scene ids for chapter ONE: `room`, `street`; state: `room` + `token`.
Full-page illustrations are authored through `pageArt` entries in the annotation
file. `matchFrom` can begin a deliberate text/image spread and `matchAfter` places
the illustration directly after its relevant passage.
Recorded narration can later replace Web Speech behind the same narrator
interface (`src/voice/narrator.ts`).

## Feralicious compliance

- Everything opens; the free path is the only path; no coins, ads, telemetry.
- Brand chrome: void/panel/line palette, mono labels, zero border-radius,
  hover-invert buttons. The candlelit scene is content, not chrome.
- 18+ gate with Heat tag; adult content stays behind it.
- Own origin at `https://novelle.feralicious.games/`, embedded sandboxed like the games.

## Integration checklist (when it joins the shelf)

1. `npm run deploy:web` publishes `dist/` to its own origin.
2. `app/catalogue.ts`: new entry, `kind: "BOOK"`, tags `["BOOK","18+"]`, `adult: true`.
3. Env var `NEXT_PUBLIC_NOVELLE_URL`; add origin to `frame-src` in `worker/index.ts`.
4. Category section: NOVELLE.

## Screenshots

`docs/screenshots/` — gate, cover, reading spread, voice+bubble+highlight,
hotspot, token state. Regenerate with the preview server running:
`node scripts/shots.mjs`.
