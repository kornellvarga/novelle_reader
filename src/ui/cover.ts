import { div, h } from "../core/util.ts";
import type { Book } from "../core/types.ts";

export interface CoverCallbacks {
  onBegin(chapterIdx: number): void;
}

export class CoverScreen {
  readonly el: HTMLElement;

  constructor(book: Book, resumeChapterIdx: number | null, cb: CoverCallbacks) {
    this.el = div("cover-screen");
    const inner = div("cover-inner");

    const shelfTag = div("cover-kicker", `${book.meta.seriesTitle} — BOOK ${book.meta.bookNumber} OF FOUR`);
    const title = h("h1", "cover-title", book.meta.title);
    const rule = div("cover-rule");
    const blurb = h("p", "cover-blurb");
    blurb.textContent =
      "He has no name. He will not tell her his face. And by morning, neither of them will remember this happened.";
    const continueLabel = div("cover-continue");
    if (resumeChapterIdx !== null) {
      const resume = h("button", "btn btn-growth cover-resume", `CONTINUE · ${book.chapters[resumeChapterIdx].title}`);
      resume.type = "button";
      resume.addEventListener("click", () => cb.onBegin(resumeChapterIdx));
      continueLabel.append(resume);
    }

    const chapterList = div("chapter-list");
    book.chapters.forEach((ch, i) => {
      const item = h("button", "chapter-item");
      item.type = "button";
      if (i === 0) item.classList.add("featured");
      const num = div("chapter-num", String(i + 1).padStart(2, "0"));
      const name = div("chapter-name", ch.title.toUpperCase());
      const note = div("chapter-note", i === 0 ? "VOICE · ART · INTERACTIVE" : "TEXT");
      item.append(num, name, note);
      item.addEventListener("click", () => cb.onBegin(i));
      chapterList.append(item);
    });

    inner.append(shelfTag, title, rule, blurb, continueLabel, chapterList);
    this.el.append(inner);
  }
}
