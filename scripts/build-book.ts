import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Book, Chapter, Paragraph, QuoteSpan, SceneSlot, InteractionBeat, PageArt } from "../src/core/types.ts";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";

interface AnnScene {
  id: string;
  matchFrom: string;
  alt: string;
  states?: Record<string, { image?: string; motion?: string; alt?: string }>;
}
interface AnnInteraction {
  id: string;
  matchAt: string;
  promptLabel: string;
  setState: string;
  gate: boolean;
}
interface AnnSpeaker {
  match: string;
  speaker: string;
}
interface AnnPageArt {
  id: string;
  matchFrom?: string;
  matchAfter: string;
  image: string;
  alt: string;
  caption?: string;
}
interface AnnChapter {
  matchHeading: string;
  scenes: AnnScene[];
  interactions: AnnInteraction[];
  speakers: AnnSpeaker[];
  pageArt?: AnnPageArt[];
}
interface AnnBook {
  meta: { slug: string; title: string; seriesTitle: string; bookNumber: number; adult: boolean; sourceFile: string };
  voices: Record<string, { speaker: string; pitch: number; rate: number; prefer: string[] }>;
  chapters: AnnChapter[];
}

function clean(text: string): string {
  return text
    .replace(/[*_]+/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmph(raw: string): boolean {
  const t = raw.trim();
  return t.length > 4 && t.startsWith("*") && t.endsWith("*") && !t.slice(1, -1).includes("*");
}

function quoteSpans(cleaned: string): QuoteSpan[] {
  const spans: QuoteSpan[] = [];
  const re = /"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    if (m[1].trim().length > 0) spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

function fail(msg: string): never {
  console.error(`[build-book] ${msg}`);
  process.exit(1);
}

function findUnique(paragraphs: Paragraph[], snippet: string, what: string): number {
  const needle = clean(snippet).toLowerCase();
  const hits = paragraphs.filter((p) => p.text.toLowerCase().includes(needle));
  if (hits.length !== 1) fail(`${what}: "${snippet}" matched ${hits.length} paragraphs (need exactly 1)`);
  return hits[0].index;
}

const annPath = process.argv[2] ?? "annotations/the-hush.json";
const ann: AnnBook = JSON.parse(readFileSync(resolve(root, annPath), "utf8"));
const manuscript = readFileSync(resolve(root, "manuscripts", ann.meta.sourceFile), "utf8");

const lines = manuscript.split(/\r?\n/);
type RawChunk = { heading: string | null; body: string[] };
const chunks: RawChunk[] = [{ heading: null, body: [] }];
for (const line of lines) {
  if (line.startsWith("## ")) chunks.push({ heading: line.slice(3).trim(), body: [] });
  else chunks[chunks.length - 1].body.push(line);
}

const frontMatter = chunks[0];
const contentNoteLines = frontMatter.body
  .filter((l) => l.trim().startsWith("*") && l.trim().length > 20)
  .map((l) => l.trim().replace(/^\*|\*$/g, "").trim());
const contentNote = contentNoteLines[contentNoteLines.length - 1] ?? "";

const chapters: Chapter[] = [];

for (const chunk of chunks.slice(1)) {
  const heading = chunk.heading;
  if (heading === null) continue;
  const annCh = ann.chapters.find((c) => clean(c.matchHeading).toLowerCase() === clean(heading).toLowerCase());
  if (!annCh) {
    console.warn(`[build-book] no annotations for chapter "${chunk.heading}" — including plain`);
  }

  const rawParas: string[] = [];
  let cur: string[] = [];
  for (const line of chunk.body) {
    const t = line.trim();
    if (t === "" || t === "---") {
      if (cur.length) rawParas.push(cur.join(" "));
      cur = [];
    } else if (t !== chunk.heading) {
      cur.push(t);
    }
  }
  if (cur.length) rawParas.push(cur.join(" "));

  const paragraphs: Paragraph[] = rawParas.map((raw, i) => ({
    index: i,
    text: clean(raw),
    emph: isEmph(raw),
    speaker: null,
    quotes: [],
    interactionId: null,
  }));

  const scenes: SceneSlot[] = (annCh?.scenes ?? []).map((s) => {
    const from = findUnique(paragraphs, s.matchFrom, `scene ${s.id}`);
    const states: SceneSlot["states"] = {};
    for (const [key, val] of Object.entries(s.states ?? {})) states[key] = { image: val.image, motion: val.motion };
    return { id: s.id, fromParagraph: from, image: s.states ? undefined : undefined, alt: s.alt, states };
  });

  const interactions: InteractionBeat[] = (annCh?.interactions ?? []).map((it) => ({
    id: it.id,
    paragraphIndex: findUnique(paragraphs, it.matchAt, `interaction ${it.id}`),
    promptLabel: it.promptLabel,
    setState: it.setState,
    gate: it.gate,
  }));
  const pageArt: PageArt[] = (annCh?.pageArt ?? []).map((art) => ({
    id: art.id,
    fromParagraph: art.matchFrom ? findUnique(paragraphs, art.matchFrom, `page art ${art.id} start`) : undefined,
    afterParagraph: findUnique(paragraphs, art.matchAfter, `page art ${art.id}`),
    image: art.image,
    alt: art.alt,
    caption: art.caption,
  }));
  for (const it of interactions) {
    const target = paragraphs[it.paragraphIndex];
    if (target) target.interactionId = it.id;
  }

  for (const sp of annCh?.speakers ?? []) {
    const idx = findUnique(paragraphs, sp.match, `speaker "${sp.speaker}"`);
    paragraphs[idx].speaker = sp.speaker;
  }

  for (const p of paragraphs) p.quotes = quoteSpans(p.text);

  chapters.push({
    id: clean(heading).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: heading,
    paragraphs,
    scenes,
    interactions,
    pageArt,
  });
}

if (chapters.length === 0) fail("no chapters parsed from manuscript");

const book: Book = {
  meta: {
    slug: ann.meta.slug,
    title: ann.meta.title,
    seriesTitle: ann.meta.seriesTitle,
    bookNumber: ann.meta.bookNumber,
    adult: ann.meta.adult,
    contentNote,
  },
  voices: ann.voices,
  chapters,
};

const outDir = resolve(root, "public", "books", book.meta.slug);
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "book.json"), JSON.stringify(book, null, 2));

let words = 0;
for (const c of chapters) for (const p of c.paragraphs) words += p.text.split(/\s+/).length;
console.log(
  `[build-book] ${book.meta.slug}.json — ${chapters.length} chapter(s), ${words} words. ` +
    chapters.map((c) => `${c.title}(${c.paragraphs.length}p, ${c.scenes.length} scenes, ${c.interactions.length} beats, ${c.pageArt.length} art)`).join(" · "),
);
