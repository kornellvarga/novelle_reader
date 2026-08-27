import type { Cue, VoiceSpec } from "../core/types.ts";
import { estimateMs } from "../core/util.ts";

export interface NarratorCallbacks {
  onCueStart(index: number): void;
  onWord(index: number, charIndex: number): void;
  onCueEnd(index: number): void;
  onFinish(): void;
}

export interface Narrator {
  readonly available: boolean;
  readonly engineName: string;
  warmup(voices: Record<string, VoiceSpec>): Promise<void>;
  play(cues: Cue[], fromIndex: number, voices: Record<string, VoiceSpec>, cb: NarratorCallbacks): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  isSpeaking(): boolean;
}

export class TimerNarrator implements Narrator {
  available = true;
  engineName = "timer";
  private timer: number | null = null;
  private running = false;
  private rate = 1;

  async warmup(): Promise<void> {}

  isSpeaking(): boolean {
    return this.running;
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  pause(): void {
    this.stop();
  }

  resume(): void {
    this.running = true;
  }

  play(cues: Cue[], fromIndex: number, _voices: Record<string, VoiceSpec>, cb: NarratorCallbacks): void {
    this.stop();
    this.running = true;
    let i = fromIndex;
    const step = (): void => {
      if (!this.running || i >= cues.length) {
        if (this.running) cb.onFinish();
        return;
      }
      const cue = cues[i];
      cb.onCueStart(i);
      const dur = estimateMs(cue.text, this.rate);
      const wordTimer = window.setInterval(() => {
        if (this.running) cb.onWord(i, Math.floor(Math.random() * cue.text.length));
      }, Math.max(90, dur / Math.max(2, cue.text.split(/\s+/).length)));
      this.timer = window.setTimeout(() => {
        window.clearInterval(wordTimer);
        cb.onCueEnd(i);
        i += 1;
        step();
      }, dur);
    };
    step();
  }
}
