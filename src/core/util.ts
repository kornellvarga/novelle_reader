export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function div(cls: string, text?: string): HTMLDivElement {
  return h("div", cls, text);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function estimateMs(text: string, rate: number): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return (words / (2.6 * rate)) * 1000 + 250;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
