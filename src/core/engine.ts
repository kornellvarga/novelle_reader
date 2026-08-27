import type { Book, Cue, SceneSlot, VoiceSpec } from "./types.ts";
import { loadBook } from "./loader.ts";
import { Environment } from "../scene/environment.ts";
import { BookView } from "../scene/book-view.ts";
import { BubbleLayer, makeChapterTitle, speakerDisplayName } from "../reader/bubbles.ts";
import { InteractionLayer } from "../reader/interactions.ts";
import { layoutChapter } from "../reader/pager.ts";
import * as hl from "../reader/highlighter.ts";
import { TimerNarrator } from "../voice/narrator.ts";
import { WebSpeechNarrator } from "../voice/web-speech.ts";
import type { Narrator } from "../voice/narrator.ts";
import { ControlsBar } from "../ui/controls.ts";
import { CoverScreen } from "../ui/cover.ts";
import { AgeGate } from "../ui/gate.ts";
import { PaywallCard } from "../ui/paywall.ts";
import { isFreeChapter } from "../config/monetize.ts";
import { estimateMs } from "./util.ts";

export interface Settings {
  voice: boolean;
  rate: number;
  font: number;
}

const FONT_MIN = 14;
const FONT_MAX = 23;
const FONT_STEP = 1.5;
const FLIP_MS = 950;

function gatePassed(): boolean {
  try {
    return window.localStorage.getItem("novelle:gate") === "1";
  } catch {
    return false;
  }
}

let ENGINE_SEQ = 0;

export class Engine {
  private readonly iid = ++ENGINE_SEQ;
  book!: Book;
  private cuesPerChapter: Cue[][] = [];
  private env!: Environment;
  private view!: BookView;
  private bubbles!: BubbleLayer;
  private beats!: InteractionLayer;
  private chrome!: ControlsBar;
  private speech!: WebSpeechNarrator;
  private timerN!: TimerNarrator;
  private narrator!: Narrator;
  private debug = false;

  playing = false;
  private chapterIdx = 0;
  private cueIndex = 0;
  private settings: Settings = { voice: true, rate: 1, font: 17 };

  private pageOfPara: number[] = [];
  private pageFirstPara: number[] = [];
  private pageLastPara: number[] = [];
  private activeSceneId: string | null = null;
  private sceneState: string | null = null;
  private coverEl: HTMLElement | null = null;
  private resizeTimer = 0;
  private gateWasPlaying = false;
  private lastLayoutW = 0;

  async mount(appRoot: HTMLElement): Promise<void> {
    const loaded = await loadBook("books/the-hush");
    this.book = loaded.book;
    this.cuesPerChapter = loaded.cuesPerChapter;
    this.loadPersisted();
    if (new URL(window.location.href).searchParams.has("debug")) {
      console.log(`[engine#${this.iid}] mount`);
    }

    this.env = new Environment("books/the-hush");
    appRoot.append(this.env.root);

    this.view = new BookView({
      onManualFlip: () => {
        if (this.playing) this.pauseAll();
      },
      onSettled: (k) => this.onSettled(k),
    });
    this.view.debug = true;
    this.env.root.append(this.view.el);

    const anchor = document.createElement("div");
    anchor.id = "fx-anchor";
    this.env.root.append(anchor);
    this.bubbles = new BubbleLayer(anchor);
    this.beats = new InteractionLayer(anchor, (beat) => this.onBeatTriggered(beat));

    this.speech = new WebSpeechNarrator();
    this.timerN = new TimerNarrator();
    await this.speech.warmup(this.book.voices as unknown as Record<string, VoiceSpec>);
    this.narrator = this.pickNarrator();
    this.debug = new URL(window.location.href).searchParams.has("debug");
    if (this.debug) {
      Object.defineProperty(window, "__novelle", {
        value: {
          settings: (): Settings => ({ ...this.settings }),
          narrator: (): string => this.narrator.engineName,
          voices: (): number => this.speech.voices.length,
          speechAvailable: (): boolean => this.speech.available,
          cueIndex: (): number => this.cueIndex,
          cueCount: (): number => this.cues.length,
          spread: (): number => this.view.spreadIndex,
        },
        configurable: true,
      });
    }

    this.chrome = new ControlsBar({
      onPrev: () => this.view.prev(),
      onNext: () => this.handleNext(),
      onTogglePlay: () => this.togglePlay(),
      onToggleVoice: () => this.toggleVoice(),
      onFont: (d) => this.changeFont(d),
      onCover: () => this.toCover(),
    });
    this.chrome.setVoice(this.settings.voice);
    appRoot.append(this.chrome.el);

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("keydown", (e) => this.onKey(e));

    if (!gatePassed()) {
      const gate = new AgeGate(() => this.showCover());
      appRoot.append(gate.el);
    } else {
      this.showCover();
    }
  }

  private get cues(): Cue[] {
    return this.cuesPerChapter[this.chapterIdx];
  }

  private get scope(): HTMLElement {
    return this.view.el;
  }

  private showCover(): void {
    if (this.coverEl) return;
    let hasProgress = false;
    try {
      hasProgress = window.localStorage.getItem("novelle:pos") !== null;
    } catch {
      /* ignore */
    }
    const cover = new CoverScreen(this.book, hasProgress, { onBegin: (i) => this.beginChapter(i) });
    this.coverEl = cover.el;
    document.getElementById("app")?.append(cover.el);
  }

  private toCover(): void {
    this.pauseAll();
    this.bubbles.hide();
    this.beats.clear();
    this.showCover();
  }

  beginChapter(idx: number, preserveCue = false): void {
    if (this.debug) console.log(`[beginChapter#${this.iid}] idx=${idx} preserveCue=${preserveCue}`);
    if (!preserveCue || this.chapterIdx !== idx) this.cueIndex = 0;
    this.chapterIdx = idx;
    this.cueIndex = Math.max(0, Math.min(this.cueIndex, this.cues.length - 1));
    this.coverEl?.remove();
    this.coverEl = null;

    const ch = this.book.chapters[idx];
    const titleNode = makeChapterTitle(ch.title, this.book.meta.title, this.book.meta.seriesTitle);
    const layout = layoutChapter(ch, this.settings.font, titleNode, this.pageBox());
    this.pageOfPara = layout.pageOfPara;
    this.pageFirstPara = layout.pages.map((page) => {
      const indexes = page.map((el) => Number(el.dataset.pidx)).filter(Number.isFinite);
      return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
    });
    this.pageLastPara = layout.pages.map((page) => {
      const indexes = page.map((el) => Number(el.dataset.pidx)).filter(Number.isFinite);
      return indexes.length ? Math.max(...indexes) : -1;
    });

    this.view.setSingle(window.innerWidth < 760);
    this.view.setPages(layout.pages);
    this.lastLayoutW = window.innerWidth;
    const startSpread = this.cueIndex < this.cues.length ? this.spreadForCue(this.cueIndex) : 0;
    if (startSpread <= 0) this.view.showFirst();
    else this.view.goto(startSpread, false);

    this.refreshScene(true);
    this.updateChrome();
    this.persist();
  }

  private pageBox(): { w: number; h: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const single = vw < 760;
    const bw = single ? Math.min(600, vw * 0.94) : Math.min(980, vw * 0.86);
    const bh = Math.min(660, vh * 0.7);
    const padX = Math.min(50, Math.max(34, vw * 0.0315));
    const padTop = Math.min(58, Math.max(44, vh * 0.05));
    return { w: (single ? bw : bw / 2) - padX * 2 - 2, h: bh - padTop - 34 };
  }

  private togglePlay(): void {
    if (this.playing) this.pauseAll();
    else this.resumePlay();
  }

  private resumePlay(): void {
    if (this.cues.length === 0) return;
    if (this.cueIndex >= this.cues.length) this.cueIndex = 0;
    this.playing = true;
    this.chrome.setPlaying(true);
    const voices = this.book.voices as unknown as Record<string, VoiceSpec>;
    this.narrator.setRate(this.settings.rate);
    this.narrator.play(this.cues, this.cueIndex, voices, {
      onCueStart: (i) => this.onCueStart(i),
      onWord: (i, c) => this.onWord(i, c),
      onCueEnd: () => undefined,
      onFinish: () => this.onFinish(),
    });
  }

  pauseAll(): void {
    this.playing = false;
    this.chrome.setPlaying(false);
    this.narrator.stop();
    this.scope.querySelectorAll(".w.current").forEach((el) => el.classList.remove("current"));
  }

  private onFinish(): void {
    this.playing = false;
    this.chrome.setPlaying(false);
    this.chrome.setReadingInfo(`${this.readInfo()} · END OF CHAPTER`);
  }

  private onCueStart(i: number): void {
    this.cueIndex = i;
    const cue = this.cues[i];
    if (!cue) return;
    if (this.debug) console.log(`[cue#${this.iid} ${i}] p${cue.paragraphIndex}s${cue.sentenceIndex} "${cue.text.slice(0, 40)}"`);
    const desired = this.spreadForCue(i);
    let delay = 0;
    if (desired !== this.view.spreadIndex && desired >= 0) {
      this.view.goto(desired, true);
      delay = FLIP_MS + 60;
    }
    const para = this.book.chapters[this.chapterIdx].paragraphs[cue.paragraphIndex];
    if (this.playing && para?.interactionId && cue.sentenceIndex === 0) {
      const beat = this.currentInteractions().find((b) => b.id === para.interactionId);
      if (beat && !this.beats.isConsumed(beat.id)) {
        window.setTimeout(() => {
          if (!this.beats.isConsumed(beat.id)) {
            this.gateWasPlaying = true;
            this.pauseAll();
            this.beats.offer(beat, beat.promptLabel);
          }
        }, delay);
        return;
      }
    }
    window.setTimeout(() => {
      this.visualizeCue(cue);
      this.offerVisibleBeats();
    }, delay);
    this.updateChrome();
    this.persist();
  }

  private visualizeCue(cue: Cue): void {
    hl.applySentence(this.scope, cue.paragraphIndex, cue.sentenceIndex);
    if (cue.speaker !== null) {
      const label = speakerDisplayName(cue.speaker === "narrator" ? "the house" : cue.speaker);
      this.bubbles.say(label, cue.text);
      this.bubbles.hold(estimateMs(cue.text, this.settings.rate) * 1.6 + 1200);
    } else {
      this.bubbles.hide();
    }
    this.refreshScene(false, cue.paragraphIndex);
  }

  private onWord(i: number, charIndex: number): void {
    if (i !== this.cueIndex || !this.playing) return;
    const cue = this.cues[i];
    if (!cue) return;
    hl.applyWord(this.scope, cue.paragraphIndex, cue.sentenceIndex, charIndex);
  }

  private onBeatTriggered(beat: { setState: string }): void {
    this.sceneState = beat.setState;
    this.refreshScene(true);
    if (this.gateWasPlaying) {
      this.gateWasPlaying = false;
      this.resumePlay();
    }
  }

  private currentInteractions() {
    return this.book.chapters[this.chapterIdx].interactions;
  }

  private spreadForCue(i: number): number {
    const cue = this.cues[i];
    if (!cue) return 0;
    const page = this.pageOfPara[cue.paragraphIndex] ?? 0;
    return this.view.isSingle ? page : Math.floor(page / 2);
  }

  private onSettled(k: number): void {
    if (!this.playing) {
      this.syncCueToSpread(k);
      this.refreshScene(true, this.lastParaForSpread(k));
    } else {
      this.refreshScene(true);
    }
    this.offerVisibleBeats();
    this.updateChrome();
  }

  private lastParaForSpread(k: number): number {
    const pages = this.view.isSingle ? [k] : [k * 2, k * 2 + 1];
    return Math.max(0, ...pages.map((page) => this.pageLastPara[page] ?? -1));
  }

  private offerVisibleBeats(): void {
    const ch = this.book.chapters[this.chapterIdx];
    if (ch.interactions.length === 0) return;
    const visiblePages = this.view.isSingle
      ? [this.view.spreadIndex]
      : [this.view.spreadIndex * 2, this.view.spreadIndex * 2 + 1];
    for (const beat of ch.interactions) {
      if (this.beats.isConsumed(beat.id)) continue;
      const page = this.pageOfPara[beat.paragraphIndex];
      if (page !== undefined && visiblePages.includes(page)) {
        this.beats.offer(beat, beat.promptLabel);
        return;
      }
    }
    this.beats.clear();
  }

  private syncCueToSpread(k: number): void {
    const pages = this.view.isSingle ? [k] : [k * 2, k * 2 + 1];
    const visible = pages.map((page) => this.pageFirstPara[page]).filter((v) => Number.isFinite(v) && v < Number.MAX_SAFE_INTEGER);
    const firstPara = visible.length ? Math.min(...visible) : 0;
    const idx = this.cues.findIndex((c) => c.paragraphIndex >= firstPara);
    this.cueIndex = idx >= 0 ? idx : 0;
    this.persist();
  }

  private refreshScene(force: boolean, paraIndex?: number): void {
    let pi = paraIndex;
    if (pi === undefined) {
      const cue = this.cues[Math.min(this.cueIndex, Math.max(0, this.cues.length - 1))];
      pi = cue?.paragraphIndex ?? 0;
    }
    const scenes = this.book.chapters[this.chapterIdx].scenes as SceneSlot[];
    if (scenes.length === 0) return;
    let slot = scenes[0];
    for (const s of scenes) if (pi >= s.fromParagraph) slot = s;
    const changed = slot.id !== this.activeSceneId;
    if (changed) {
      this.activeSceneId = slot.id;
      this.sceneState = null;
    }
    if (changed || force) {
      void this.env.setScene({ id: slot.id, alt: slot.alt }, this.sceneState);
    }
  }

  private pickNarrator(): Narrator {
    const useSpeech = this.settings.voice && this.speech.available && this.speech.voices.length > 0;
    return useSpeech ? this.speech : this.timerN;
  }

  private toggleVoice(): void {
    this.settings.voice = !this.settings.voice;
    const wasPlaying = this.playing;
    if (wasPlaying) this.pauseAll();
    this.narrator.stop();
    this.narrator = this.pickNarrator();
    this.chrome.setVoice(this.settings.voice);
    if (wasPlaying) this.resumePlay();
    this.persist();
  }

  private changeFont(delta: number): void {
    const next = Math.max(FONT_MIN, Math.min(FONT_MAX, this.settings.font + delta * FONT_STEP));
    if (next === this.settings.font) return;
    this.settings.font = next;
    this.beginChapter(this.chapterIdx, true);
    this.persist();
  }

  private readInfo(): string {
    const ch = this.book.chapters[this.chapterIdx];
    const pct = this.cues.length ? Math.round((this.cueIndex / this.cues.length) * 100) : 0;
    return `${ch.title.toUpperCase()} · ${pct}%`;
  }

  private updateChrome(): void {
    this.chrome.setReadingInfo(`${this.book.meta.title} — ${this.readInfo()}`);
    this.chrome.setProgress(this.cues.length ? this.cueIndex / this.cues.length : 0);
  }

  private paywallShown = false;

  private handleNext(): void {
    const moved = this.view.next();
    if (moved) return;
    // Forward blocked = final spread. If this chapter is part of the free
    // sample, that dead end becomes the upsell moment instead.
    if (!isFreeChapter(this.chapterIdx) || this.paywallShown) return;
    this.paywallShown = true;
    const card = new PaywallCard(this.book.meta.title, () => {
      this.paywallShown = false;
    });
    document.getElementById("app")?.append(card.el);
  }

  private onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === "ArrowRight") this.handleNext();
    else if (e.key === "ArrowLeft") this.view.prev();
    else if (e.key === " ") {
      e.preventDefault();
      this.togglePlay();
    } else if (e.key.toLowerCase() === "v") this.toggleVoice();
  }

  private onResize(): void {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const single = window.innerWidth < 760;
      if (single !== this.view.isSingle || Math.abs(window.innerWidth - this.lastLayoutW) > 80) {
        this.lastLayoutW = window.innerWidth;
        this.view.setSingle(single);
        this.beginChapter(this.chapterIdx, true);
      }
    }, 220);
  }

  private loadPersisted(): void {
    try {
      const raw = window.localStorage.getItem("novelle:v1");
      if (raw) {
        const data = JSON.parse(raw) as { chapter?: number; cue?: number; settings?: Partial<Settings> };
        this.chapterIdx = Math.min(Math.max(0, data.chapter ?? 0), this.book.chapters.length - 1);
        this.cueIndex = Math.max(0, data.cue ?? 0);
        this.settings = {
          voice: data.settings?.voice ?? true,
          rate: data.settings?.rate ?? 1,
          font: Math.max(FONT_MIN, Math.min(FONT_MAX, data.settings?.font ?? 17)),
        };
      }
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    const v = url.searchParams.get("voice");
    if (v === "0") this.settings.voice = false;
    else if (v === "1") this.settings.voice = true;
    const r = Number(url.searchParams.get("rate"));
    if (Number.isFinite(r) && r >= 0.5 && r <= 3) this.settings.rate = r;
  }

  private persist(): void {
    try {
      window.localStorage.setItem(
        "novelle:v1",
        JSON.stringify({ chapter: this.chapterIdx, cue: this.cueIndex, settings: this.settings }),
      );
    } catch {
      /* ignore */
    }
  }
}
