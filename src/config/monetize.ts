/**
 * Monetization wiring for NOVELLE (PRODUCT_MODEL.md v0.3 amendment).
 *
 * The free sample is the first FREE_CHAPTERS chapters of each book.
 * Reaching past them shows the upsell moment instead of a dead end.
 */
export const MONETIZE = {
  /** Chapters readable without any unlock, per book. */
  freeChapters: 1,
  /** Where "Continue reading" sends people. Swap to the live Amazon URL on launch day. */
  buyUrl: "https://kdp.amazon.com",
  /** Shown on the card so the brand loop closes back to the site. */
  siteUrl: "https://feralicious.games",
  buyLabel: "Get the book — $0.99 launch price",
} as const;

/** True when the given chapter index is inside the free sample. */
export function isFreeChapter(chapterIdx: number): boolean {
  return chapterIdx < MONETIZE.freeChapters;
}
