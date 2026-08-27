import { div, h } from "../core/util.ts";

export interface BubbleHandle {
  update(text: string, speakerLabel: string): void;
  hide(): void;
  el: HTMLElement;
}

export class BubbleLayer {
  private box: HTMLDivElement;
  private label: HTMLDivElement;
  private textEl: HTMLDivElement;
  private tail: HTMLDivElement;
  private typeTimer: number | null = null;
  private hideTimer: number | null = null;

  constructor(anchor: HTMLElement) {
    this.box = div("bubble");
    this.label = div("bubble-label");
    this.textEl = div("bubble-text");
    this.tail = div("bubble-tail");
    this.box.append(this.label, this.textEl, this.tail);
    anchor.append(this.box);
    this.box.style.display = "none";
  }

  say(speakerLabel: string, text: string): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    if (this.typeTimer !== null) window.clearInterval(this.typeTimer);
    this.box.style.display = "";
    this.box.classList.remove("bubble-out");
    void this.box.offsetWidth;
    this.box.classList.add("bubble-in");
    this.label.textContent = speakerLabel.toUpperCase();
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 90));
    this.textEl.textContent = "";
    const tick = (): void => {
      i = Math.min(text.length, i + step);
      this.textEl.textContent = text.slice(0, i);
      if (i >= text.length && this.typeTimer !== null) window.clearInterval(this.typeTimer);
    };
    tick();
    this.typeTimer = window.setInterval(tick, 34);
  }

  hold(ms: number): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    if (this.typeTimer !== null) window.clearInterval(this.typeTimer);
    this.typeTimer = null;
    this.box.classList.remove("bubble-in");
    this.box.classList.add("bubble-out");
    window.setTimeout(() => {
      if (!this.box.classList.contains("bubble-in")) this.box.style.display = "none";
    }, 180);
  }
}

export function speakerDisplayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
}

export function makeChapterTitle(chapterTitle: string, bookTitle: string, series: string): HTMLElement {
  const wrap = div("title-block");
  const seriesEl = div("title-series", series.toUpperCase());
  const titleEl = h("h1", "title-main", chapterTitle.toUpperCase());
  const bookEl = div("title-book", bookTitle);
  const rule = div("title-rule");
  wrap.append(seriesEl, titleEl, rule, bookEl);
  return wrap;
}
