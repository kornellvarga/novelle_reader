import { sentenceElFor, wordEls, wordIndexForChar } from "./pager.ts";

function clean(scope: ParentNode): void {
  scope.querySelectorAll(".sent.speaking").forEach((el) => el.classList.remove("speaking"));
  scope.querySelectorAll(".w.current").forEach((el) => el.classList.remove("current"));
}

export function applySentence(scope: ParentNode, pidx: number, sidx: number): HTMLSpanElement | null {
  clean(scope);
  const para = scope.querySelector<HTMLParagraphElement>(`.para[data-pidx="${pidx}"]`);
  if (!para) return null;
  const sent = sentenceElFor(para, sidx);
  if (!sent) return null;
  sent.classList.add("speaking");
  return sent;
}

export function applyWord(scope: ParentNode, pidx: number, sidx: number, charIndex: number): void {
  const para = scope.querySelector<HTMLParagraphElement>(`.para[data-pidx="${pidx}"]`);
  if (!para) return;
  const sent = sentenceElFor(para, sidx);
  if (!sent) return;
  const words = wordEls(sent);
  if (words.length === 0) return;
  const idx = wordIndexForChar(sent, charIndex);
  words.forEach((w, i) => w.classList.toggle("current", i === idx));
}

export function clearAll(scope: ParentNode): void {
  clean(scope);
}
