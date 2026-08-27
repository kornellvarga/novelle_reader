import { div } from "../core/util.ts";

const FLIP_MS = 950;

export interface BookViewCallbacks {
  onManualFlip?(dir: 1 | -1): void;
  onSettled?(spreadIndex: number): void;
}

export class BookView {
  debug = false;
  readonly el: HTMLElement;
  private bookEl: HTMLElement;
  private pageL: HTMLElement;
  private pageR: HTMLElement;
  private numL: HTMLElement;
  private numR: HTMLElement;
  private leafLayer: HTMLElement;
  private pages: HTMLElement[][] = [];
  private cur = -1;
  private animating = false;
  private single = false;
  private cb: BookViewCallbacks;
  private gesture: { pointerId: number; x: number; y: number; at: number } | null = null;
  private suppressClick = false;

  constructor(cb: BookViewCallbacks = {}) {
    this.cb = cb;
    this.el = div("book-wrap");
    const perspective = div("perspective");
    this.bookEl = div("book");
    this.pageL = div("pg pg-l pg-text");
    this.pageR = div("pg pg-r pg-text");
    this.numL = div("pg-num");
    this.numR = div("pg-num");
    this.pageL.append(this.numL);
    this.pageR.append(this.numR);
    this.leafLayer = div("leaf-layer");
    this.bookEl.append(this.pageL, this.pageR, this.leafLayer);
    perspective.append(this.bookEl);
    this.el.append(perspective);

    this.el.addEventListener("click", (e) => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      if ((e.target as HTMLElement).closest(".hotspot, .bubble, button, a")) return;
      const rect = this.bookEl.getBoundingClientRect();
      const dir: 1 | -1 = e.clientX > rect.left + rect.width / 2 ? 1 : -1;
      this.manualFlip(dir, false);
    });

    this.bookEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if ((e.target as HTMLElement).closest(".hotspot, .bubble, button, a")) return;
      this.gesture = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() };
    });
    this.bookEl.addEventListener("pointerup", (e) => {
      const start = this.gesture;
      this.gesture = null;
      if (!start || start.pointerId !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const quickEnough = performance.now() - start.at < 900;
      if (!quickEnough || Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      this.suppressClick = true;
      window.setTimeout(() => { this.suppressClick = false; }, 360);
      this.manualFlip(dx < 0 ? 1 : -1, true);
    });
    this.bookEl.addEventListener("pointercancel", () => { this.gesture = null; });
  }

  get spreadIndex(): number {
    return this.cur;
  }

  get spreadCount(): number {
    return this.single ? this.pages.length : Math.ceil(this.pages.length / 2);
  }

  get isSingle(): boolean {
    return this.single;
  }

  measurePageBox(): { w: number; h: number } {
    const page = this.single ? this.pageR : this.pageL;
    const rect = page.getBoundingClientRect();
    const style = getComputedStyle(page);
    const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return {
      w: Math.max(1, rect.width - horizontal - 2),
      h: Math.max(1, rect.height - vertical),
    };
  }

  setSingle(single: boolean): void {
    if (single === this.single) return;
    this.single = single;
    this.bookEl.classList.toggle("single", single);
    if (this.cur >= 0) this.renderSpread(Math.min(this.cur, this.spreadCount - 1), false);
  }

  setPages(pages: HTMLElement[][]): void {
    this.pages = pages;
    this.cur = -1;
    this.pageL.replaceChildren(this.numL);
    this.pageR.replaceChildren(this.numR);
  }

  showFirst(): void {
    this.renderSpread(0, false);
  }

  canNext(): boolean {
    return this.cur < this.spreadCount - 1;
  }

  canPrev(): boolean {
    return this.cur > 0;
  }

  goto(spread: number, animate = true): void {
    if (this.animating || spread === this.cur) return;
    if (spread < 0 || spread >= this.spreadCount) return;
    const dir: 1 | -1 = spread > this.cur ? 1 : -1;
    const step = Math.abs(spread - this.cur);
    if (animate && !this.single && step === 1) {
      void this.flipAnimated(dir, spread);
    } else {
      this.renderSpread(spread, true);
    }
  }

  private trace(msg: string): void {
    if (this.debug) console.log(`[view] ${msg} cur=${this.cur}`);
  }

  next(animate = true): boolean {
    this.trace(`next(${animate})`);
    if (!this.canNext() || this.animating) return false;
    const target = this.cur + 1;
    if (animate && !this.single) void this.flipAnimated(1, target);
    else this.renderSpread(target, true);
    return true;
  }

  prev(animate = true): boolean {
    this.trace(`prev(${animate})`);
    if (!this.canPrev() || this.animating) return false;
    const target = this.cur - 1;
    if (animate && !this.single) void this.flipAnimated(-1, target);
    else this.renderSpread(target, true);
    return true;
  }

  private manualFlip(dir: 1 | -1, animate: boolean): void {
    const moved = dir === 1 ? this.next(animate) : this.prev(animate);
    if (!moved && this.cb.onManualFlip) this.cb.onManualFlip(dir);
  }

  private fill(page: HTMLElement, num: HTMLElement, idx: number): void {
    page.replaceChildren(...this.pages[idx], num);
    num.textContent = String(idx + 1);
  }

  private renderSpread(k: number, fire: boolean): void {
    this.cur = k;
    if (this.single) {
      this.fill(this.pageR, this.numR, k);
      this.pageL.replaceChildren(this.numL);
      this.numL.textContent = "";
    } else {
      const li = k * 2;
      const ri = k * 2 + 1;
      if (li < this.pages.length) this.fill(this.pageL, this.numL, li);
      else {
        this.pageL.replaceChildren(this.numL);
        this.numL.textContent = "";
      }
      if (ri < this.pages.length) this.fill(this.pageR, this.numR, ri);
      else {
        this.pageR.replaceChildren(this.numR);
        this.numR.textContent = "";
      }
    }
    if (fire && this.cb.onSettled) this.cb.onSettled(k);
  }

  private async flipAnimated(dir: 1 | -1, target: number): Promise<void> {
    this.trace(`flip start dir=${dir} target=${target}`);
    this.animating = true;
    this.leafLayer.replaceChildren();
    const leaf = div("leaf");
    const front = div("pg pg-text leaf-front");
    const back = div("pg pg-text leaf-back");
    leaf.append(front, back);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      this.renderSpread(target, true);
      this.animating = false;
      return;
    }

    let landedNum = "";
    if (dir === 1) {
      const oldRight = Array.from(this.pageR.childNodes).filter((n) => n !== this.numR);
      front.append(...oldRight);
      front.append(this.numR.cloneNode(true));
      const tl = target * 2;
      landedNum = String(tl + 1);
      if (tl < this.pages.length) back.append(...this.pages[tl]);
      const tr = target * 2 + 1;
      if (tr < this.pages.length) this.fill(this.pageR, this.numR, tr);
      else {
        this.pageR.replaceChildren(this.numR);
        this.numR.textContent = "";
      }
      this.leafLayer.append(leaf);
      void leaf.offsetWidth;
      leaf.classList.add("flip-fwd");
    } else {
      const oldLeft = Array.from(this.pageL.childNodes).filter((n) => n !== this.numL);
      front.append(...oldLeft);
      front.append(this.numL.cloneNode(true));
      const li = target * 2;
      if (li < this.pages.length) {
        this.pageL.replaceChildren(...this.pages[li], this.numL);
        this.numL.textContent = String(li + 1);
      } else {
        this.pageL.replaceChildren(this.numL);
        this.numL.textContent = "";
      }
      const tr = target * 2 + 1;
      landedNum = String(tr + 1);
      if (tr < this.pages.length) back.append(...this.pages[tr]);
      this.leafLayer.append(leaf);
      void leaf.offsetWidth;
      leaf.classList.add("flip-bwd");
    }

    await wait(FLIP_MS);
    this.trace(`flip end dir=${dir} target=${target}`);
    if (dir === 1) {
      this.pageL.replaceChildren(...Array.from(back.childNodes), this.numL);
      this.numL.textContent = landedNum;
    } else {
      this.pageR.replaceChildren(...Array.from(back.childNodes), this.numR);
      this.numR.textContent = landedNum;
    }
    this.leafLayer.replaceChildren();
    this.cur = target;
    this.animating = false;
    if (this.cb.onSettled) this.cb.onSettled(target);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}
