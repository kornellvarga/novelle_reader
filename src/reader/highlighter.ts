import { wordEls, wordIndexForChar } from "./pager.ts";

function clean(scope: ParentNode): void {
  scope.querySelectorAll(".sent.speaking").forEach((el) => el.classList.remove("speaking"));
  scope.querySelectorAll(".w.current").forEach((el) => el.classList.remove("current"));
}

export function applySentence(scope: ParentNode, pidx: number, sidx: number): HTMLSpanElement | null {
  clean(scope);
  const paragraphs = Array.from(scope.querySelectorAll<HTMLParagraphElement>(`.para[data-pidx="${pidx}"]`));
  const sentences = paragraphs.flatMap((para) => Array.from(para.querySelectorAll<HTMLSpanElement>(`.sent[data-sidx="${sidx}"]`)));
  sentences.forEach((sent) => sent.classList.add("speaking"));
  return sentences[0] ?? null;
}

export function applyWord(scope: ParentNode, pidx: number, sidx: number, charIndex: number): void {
  const paragraphs = Array.from(scope.querySelectorAll<HTMLParagraphElement>(`.para[data-pidx="${pidx}"]`));
  const sentences = paragraphs.flatMap((para) => Array.from(para.querySelectorAll<HTMLSpanElement>(`.sent[data-sidx="${sidx}"]`)));
  const sent = [...sentences].reverse().find((candidate) => {
    const first = candidate.querySelector<HTMLElement>(".w")?.dataset.charOffset;
    return first !== undefined && Number(first) <= charIndex;
  }) ?? sentences[0] ?? null;
  if (!sent) return;
  const words = wordEls(sent);
  if (words.length === 0) return;
  const idx = wordIndexForChar(sent, charIndex);
  words.forEach((w, i) => w.classList.toggle("current", i === idx));
}

export function clearAll(scope: ParentNode): void {
  clean(scope);
}
