# NOVELLE Mobile Web UX Plan

Date: 2026-08-27
Scope: make the existing reader correctly handled and comfortably usable in a phone browser without redesigning the product or optimizing every rendering path.

## Current state

The project already has two useful mobile foundations:

- `index.html` includes a responsive viewport meta tag.
- The engine switches the book from a two-page spread to single-page mode below 760 px and uses a wider mobile Three.js camera FOV.

The current experience is still primarily desktop UI compressed into a smaller viewport. The priority is therefore layout, touch ergonomics, safe areas, and mobile-specific placement rather than a full visual redesign.

## P0 — Required for a usable phone-browser experience

### 1. Use the mobile viewport correctly

Files:
- `index.html`
- `src/styles/base.css`

Changes:
- Change viewport metadata to include `viewport-fit=cover`.
- Replace fixed `height: 100%` assumptions with `100dvh` where the app needs to occupy the visible mobile browser viewport.
- Add safe-area CSS variables using `env(safe-area-inset-top/right/bottom/left)`.
- Apply safe-area padding to top and bottom chrome.
- Keep the cover scrollable and avoid trapping content behind browser chrome.

Acceptance:
- iPhone/Android portrait and landscape do not clip controls under notches, status areas, or the home indicator.
- Address-bar expansion/collapse does not leave the reader cropped.

### 2. Stop the book from overlapping the top/bottom chrome

Files:
- `src/styles/book.css`
- `src/styles/ui.css`
- optionally `src/core/engine.ts`

Problem:
The book is absolutely centered at `top: 54%` and sized to `70vh`, while the topbar and bottom controls occupy their own overlay space. On short phone viewports the book and controls can compete for the same vertical area.

Changes:
- Define an explicit reading viewport between the header and controls.
- Center the book inside that available rectangle rather than inside the full screen.
- On mobile, size the single page from available width/height, not simply `94vw` x `70vh`.
- Reduce mobile page padding from the current desktop-biased minimum where necessary while keeping readable margins.

Acceptance:
- No page text, page number, hotspot, or illustration is hidden under chrome at 320x568, 360x800, 390x844, 412x915, and landscape equivalents.

### 3. Replace the wrapped desktop toolbar with a deliberate mobile toolbar

Files:
- `src/ui/controls.ts`
- `src/styles/ui.css`

Current toolbar has seven always-visible actions: PREV, PLAY, NEXT, A−, A+, VOICE, COVER. On phones these wrap unpredictably and the base button height is smaller than a comfortable touch target.

Mobile layout:
- Primary bottom row: PREV | PLAY/PAUSE | NEXT.
- Secondary compact row or overflow sheet: text size, voice, cover.
- Minimum touch target: 44x44 CSS px; prefer ~48 px on the primary controls.
- Use `:active` states in addition to hover states.
- Preserve visible labels; do not make the primary reader controls icon-only.

Acceptance:
- Primary navigation is operable one-handed.
- No accidental presses caused by tightly packed controls.
- Toolbar remains stable instead of wrapping differently across phone widths.

### 4. Make dialogue bubbles and interaction hotspots mobile-aware

Files:
- `src/styles/ui.css`
- `src/styles/scene.css`
- `src/reader/bubbles.ts`
- `src/reader/interactions.ts`

Problem:
Bubbles and hotspots are currently positioned relative to `#fx-anchor`, which follows the desktop art-frame position. On a narrow phone this can put them off-screen, on top of the book, or under the controls.

Mobile behavior:
- Dialogue bubble becomes a centered overlay/toast above the bottom controls with `max-width: calc(100vw - 24px)`.
- Hotspot becomes a fixed/anchored action above the control bar rather than `bottom: -52px` under the art anchor.
- Respect safe-area bottom inset.
- Never obscure the currently narrated sentence when avoidable.

Acceptance:
- Speech bubbles and interaction CTA are always fully visible in portrait and landscape.
- Hotspot remains easy to tap and never sits beneath browser/UI chrome.

### 5. Make the age gate, paywall, and chapter cover phone-friendly

Files:
- `src/styles/ui.css`
- `src/ui/gate.ts`
- `src/ui/paywall.ts`
- `src/ui/cover.ts`

Changes:
- Stack age-gate/paywall actions vertically on narrow screens when required.
- Make modal primary actions full-width or at least 44 px tall.
- Reduce `gate-panel` horizontal padding at small widths.
- Lower the cover title minimum size from the current 56 px when the viewport is very narrow.
- Give chapter rows a minimum 48 px touch height.
- Allow chapter title/note wrapping without horizontal overflow.

Acceptance:
- 320 px wide viewport can use gate, cover, chapter list, and paywall without horizontal scrolling or clipped copy.

## P1 — Strongly recommended mobile UX improvements

### 6. Add swipe page navigation

Files:
- `src/scene/book-view.ts`

Current page-half taps already work on touch devices, but a book UI on mobile strongly invites swiping.

Implement pointer-based swipe handling:
- horizontal distance threshold around 40–60 px;
- reject mostly vertical gestures;
- ignore gestures beginning on `.hotspot`, `.bubble`, buttons, or links;
- swipe left = next; swipe right = previous;
- keep tap-half navigation as fallback;
- do not trigger browser-back behavior from the reader area where practical.

Single-page mode should continue to avoid the heavy 3D page-turn animation.

### 7. Add orientation/visual viewport handling

Files:
- `src/core/engine.ts`

Current relayout uses `window.innerWidth` and a debounced `resize` listener. Improve it by:
- considering `window.visualViewport` where available;
- reacting cleanly to orientation changes;
- preserving chapter/cue/page location through relayout;
- avoiding repeated relayout while browser chrome animates unless effective reading dimensions changed materially.

### 8. Mobile-specific story art placement

Files:
- `src/styles/scene.css`

The fallback `.art-frame` is currently left-positioned and sized as a percentage of viewport width. On phone, use one of these deterministic treatments:
- background/full-stage art behind the book, or
- compact top story-art strip inside the reading viewport.

Do not leave the desktop side-card layout overlapping a single-page book.

## P2 — Performance and polish after the UI is correct

### 9. Lightweight mobile Three.js mode

Files:
- `src/scene/stage3d.ts`

The 3D renderer already caps DPR at 1.5 and widens mobile FOV, which is useful. Later mobile refinements can include:
- cap DPR closer to 1.0–1.25 on small/mobile devices;
- lower or disable shadow maps on low-power devices;
- reduce rain count;
- pause rendering when the document is hidden;
- optionally pause/slow decorative animation while a full-screen cover/gate is visible.

This is not required before the P0 UX work.

## Automated mobile QA

File:
- `scripts/smoke.mjs`

The current smoke suite only runs at 1440x900 and relies heavily on keyboard navigation. Add phone-browser smoke contexts.

Required viewports:
- 320x568
- 360x800
- 390x844
- 412x915
- 844x390 landscape

For each mobile viewport assert:
- age gate fits and both actions are tappable;
- cover/chapter list has no horizontal overflow;
- first chapter uses `.book.single`;
- single page is fully inside the usable reader area;
- primary controls are visible and each touch target is >= 44 px;
- PREV/PLAY/NEXT work by click/tap;
- swipe next/previous works once implemented;
- bubbles/hotspot fit in viewport;
- font resize triggers a valid relayout;
- orientation/resize preserves current reading position;
- no console/page errors.

## Suggested implementation sequence

1. `index.html` + `base.css`: dynamic viewport and safe areas.
2. `ui.css` + `controls.ts`: mobile toolbar and touch target sizing.
3. `book.css` + `engine.ts`: reading-area sizing and relayout synchronization.
4. `ui.css` + scene anchors: bubble/hotspot mobile placement.
5. gate/cover/paywall responsive rules.
6. `book-view.ts`: swipe navigation.
7. `scripts/smoke.mjs`: mobile viewport/touch regression suite.
8. Stage3D mobile performance pass only after UX behavior is correct.

## Definition of done

NOVELLE is mobile-usable when a reader can open the site in Safari/Chrome on a normal phone, pass the age gate, select a chapter, read one page at a time, navigate by tap and/or swipe, use narration and text sizing, trigger an interactive beat, and return to the cover without clipped UI, unreachable controls, accidental overlap, or horizontal scrolling.
