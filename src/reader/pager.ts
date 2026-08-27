import type { Chapter, PageArt, Paragraph } from "../core/types.ts";
import { h } from "../core/util.ts";

const SENT_RE = /[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g;
const WORD_RE = /\S+/g;

export interface SentRef {
  el: HTMLSpanElement;
  offsets: number[];
}

const sentRefs = new WeakMap<HTMLParagraphElement, SentRef[]>();

export function buildParagraphEl(p: Paragraph): HTMLParagraphElement {
  const el = h("p", "para");
  el.dataset.pidx = String(p.index);
  if (p.emph) el.classList.add("emph");
  if (p.index === 0) el.classList.add("opening");
  if (p.interactionId !== null) el.classList.add("has-beat");

  const refs: SentRef[] = [];
  let sidx = 0;
  let m: RegExpExecArray | null;
  SENT_RE.lastIndex = 0;
  while ((m = SENT_RE.exec(p.text))) {
    const raw = m[0];
    const sent = h("span", "sent");
    sent.dataset.sidx = String(sidx);
    const offsets: number[] = [];
    let w: RegExpExecArray | null;
    WORD_RE.lastIndex = 0;
    let cursor = 0;
    while ((w = WORD_RE.exec(raw))) {
      if (w.index > cursor) sent.append(document.createTextNode(raw.slice(cursor, w.index)));
      const word = h("span", "w", w[0]);
      offsets.push(w.index);
      sent.append(word);
      cursor = w.index + w[0].length;
    }
    if (cursor < raw.length) sent.append(document.createTextNode(raw.slice(cursor)));
    el.append(sent);
    refs.push({ el: sent, offsets });
    sidx += 1;
  }
  sentRefs.set(el, refs);
  return el;
}

export function sentenceElFor(paraEl: HTMLParagraphElement, sidx: number): HTMLSpanElement | null {
  return paraEl.querySelector<HTMLSpanElement>(`.sent[data-sidx="${sidx}"]`);
}

export function wordIndexForChar(sentEl: HTMLSpanElement, charIndex: number): number {
  const paraEl = sentEl.closest(".para");
  if (!(paraEl instanceof HTMLParagraphElement)) return -1;
  const refs = sentRefs.get(paraEl);
  if (!refs) return -1;
  const ref = refs.find((r) => r.el === sentEl);
  if (!ref || ref.offsets.length === 0) return -1;
  let idx = 0;
  for (let i = 0; i < ref.offsets.length; i++) {
    if (ref.offsets[i] <= charIndex) idx = i;
    else break;
  }
  return idx;
}

export function wordEls(sentEl: HTMLSpanElement): HTMLElement[] {
  return Array.from(sentEl.querySelectorAll<HTMLElement>(".w"));
}

export interface PageLayout {
  pages: HTMLElement[][];
  pageOfPara: number[];
}

export interface PageBox {
  w: number;
  h: number;
}

function buildPageArtEl(art: PageArt): HTMLElement {
  const figure = h("figure", "page-illustration");
  figure.dataset.artId = art.id;
  const image = h("img", "page-illustration-image");
  image.src = art.image;
  image.alt = art.alt;
  image.loading = "eager";
  image.decoding = "async";
  figure.append(image);
  if (art.caption) figure.append(h("figcaption", "page-illustration-caption", art.caption));
  return figure;
}

export function layoutChapter(chapter: Chapter, fontPx: number, titleNode: Node, box: PageBox): PageLayout {
  const holder = h("div", "pg-box pg-text");
  holder.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;margin:0;width:${box.w}px;height:${box.h}px;`;
  holder.style.fontSize = `${fontPx}px`;
  document.body.append(holder);

  const titleWrap = h("div", "chapter-head");
  titleWrap.append(titleNode);
  titleWrap.style.fontSize = `${fontPx}px`;
  holder.append(titleWrap);

  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [titleWrap];
  let pageIndex = 0;
  const pageOfPara: number[] = [];
  const artAfter = new Map<number, PageArt[]>();
  const artStarts = new Set<number>();
  for (const art of chapter.pageArt ?? []) {
    const items = artAfter.get(art.afterParagraph) ?? [];
    items.push(art);
    artAfter.set(art.afterParagraph, items);
    if (art.fromParagraph !== undefined) artStarts.add(art.fromParagraph);
  }
  for (const p of chapter.paragraphs) {
    if (artStarts.has(p.index) && current.length > 0) {
      pages.push(current);
      current = [];
      pageIndex = pages.length;
      holder.replaceChildren();
    }
    const el = buildParagraphEl(p);
    el.style.fontSize = `${fontPx}px`;
    holder.append(el);
    if (holder.scrollHeight > holder.clientHeight + 1 && current.length > 0) {
      el.remove();
      pages.push(current);
      current = [el];
      pageIndex = pages.length;
      holder.replaceChildren(el);
    } else {
      current.push(el);
    }
    pageOfPara[p.index] = pageIndex;

    for (const art of artAfter.get(p.index) ?? []) {
      if (current.length > 0) pages.push(current);
      current = [];
      holder.replaceChildren();
      pages.push([buildPageArtEl(art)]);
      pageIndex = pages.length;
    }
  }
  if (current.length > 0 && pages[pages.length - 1] !== current) pages.push(current);
  if (pages.length === 0) pages.push([]);

  holder.remove();
  for (const page of pages) for (const el of page) el.remove();
  return { pages, pageOfPara };
}
