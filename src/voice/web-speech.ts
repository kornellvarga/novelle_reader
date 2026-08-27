import type { Cue, VoiceSpec } from "../core/types.ts";
import { clamp, estimateMs } from "../core/util.ts";
import type { Narrator, NarratorCallbacks } from "./narrator.ts";

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

export class WebSpeechNarrator implements Narrator {
  readonly available = synth() !== null;
  readonly engineName = "web-speech";
  voices: SpeechSynthesisVoice[] = [];
  private rate = 1;
  private generation = 0;
  private keepAlive: SpeechSynthesisUtterance[] = [];

  async warmup(_voices: Record<string, VoiceSpec>): Promise<void> {
    const s = synth();
    if (!s) return;
    await new Promise<void>((resolve) => {
      const grab = (): void => {
        this.voices = s.getVoices();
        if (this.voices.length > 0) {
          s.onvoiceschanged = null;
          resolve();
        }
      };
      grab();
      if (this.voices.length === 0) {
        s.onvoiceschanged = grab;
        window.setTimeout(() => {
          this.voices = s.getVoices();
          resolve();
        }, 1600);
      }
    });
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  isSpeaking(): boolean {
    return synth()?.speaking ?? false;
  }

  pause(): void {
    try {
      synth()?.pause();
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    try {
      synth()?.resume();
    } catch {
      /* ignore */
    }
  }

  stop(): void {
    this.generation += 1;
    this.keepAlive.length = 0;
    try {
      synth()?.cancel();
    } catch {
      /* ignore */
    }
  }

  private pickVoice(prefer: string[]): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) return null;
    const en = this.voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const pool = en.length > 0 ? en : this.voices;
    for (const p of prefer) {
      const needle = p.toLowerCase();
      const hit =
        pool.find((v) => v.name.toLowerCase().includes(needle)) ??
        pool.find((v) => v.lang.toLowerCase().includes(needle));
      if (hit) return hit;
    }
    return pool[0] ?? null;
  }

  play(cues: Cue[], fromIndex: number, voices: Record<string, VoiceSpec>, cb: NarratorCallbacks): void {
    const s = synth();
    if (!s) return;
    this.stop();
    const gen = ++this.generation;
    this.keepAlive.length = 0;

    const speakFrom = (i: number): void => {
      if (gen !== this.generation) return;
      if (i >= cues.length) {
        cb.onFinish();
        return;
      }
      const cue = cues[i];
      cb.onCueStart(i);

      const spec = (cue.speaker !== null ? voices[cue.speaker] : undefined) ?? voices["narrator"];
      const u = new SpeechSynthesisUtterance(cue.text);
      u.rate = clamp(this.rate * (spec?.rate ?? 1), 0.5, 2);
      u.pitch = clamp(spec?.pitch ?? 1, 0, 2);
      const v = this.pickVoice(spec?.prefer ?? []);
      if (v) u.voice = v;

      let ended = false;
      const advance = (): void => {
        if (ended || gen !== this.generation) return;
        ended = true;
        cb.onCueEnd(i);
        speakFrom(i + 1);
      };

      const watchdog = window.setTimeout(advance, estimateMs(cue.text, u.rate) * 3 + 6000);

      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (gen !== this.generation || ended) return;
        if (e.name === undefined || e.name === "word") cb.onWord(i, e.charIndex);
      };
      u.onend = () => {
        window.clearTimeout(watchdog);
        advance();
      };
      u.onerror = () => {
        window.clearTimeout(watchdog);
        advance();
      };

      this.keepAlive.push(u);
      s.speak(u);
    };

    speakFrom(fromIndex);
  }
}
