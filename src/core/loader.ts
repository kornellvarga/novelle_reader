import type { Book, Chapter, Cue } from "./types.ts";

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const s = m[0].trim();
    if (s.length > 0) out.push(s);
  }
  return out.length > 0 ? out : [text];
}

export interface LoadedBook {
  book: Book;
  cuesPerChapter: Cue[][];
}

export function cueChapter(chapterIndex: number, chapter: Chapter): Cue[] {
  const cues: Cue[] = [];
  for (const para of chapter.paragraphs) {
    const spoken = para.speaker !== null && para.quotes.length > 0;
    splitSentences(para.text).forEach((text, sentenceIndex) => {
      cues.push({
        chapterIndex,
        paragraphIndex: para.index,
        sentenceIndex,
        text,
        speaker: spoken ? para.speaker : null,
      });
    });
  }
  return cues;
}

export async function loadBook(bookDir: string): Promise<LoadedBook> {
  const res = await fetch(`${bookDir}/book.json`);
  if (!res.ok) throw new Error(`book.json ${res.status}`);
  const book = (await res.json()) as Book;
  if (!Array.isArray(book.chapters) || book.chapters.length === 0) throw new Error("empty book");
  const cuesPerChapter = book.chapters.map((c, i) => cueChapter(i, c));
  return { book, cuesPerChapter };
}
