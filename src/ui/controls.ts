import { div, h } from "../core/util.ts";

export interface ControlsCallbacks {
  onPrev(): void;
  onNext(): void;
  onTogglePlay(): void;
  onToggleVoice(): void;
  onFont(delta: number): void;
  onCover(): void;
}

export class ControlsBar {
  readonly el: HTMLElement;
  private topInfo: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private playBtn: HTMLButtonElement;
  private voiceBtn: HTMLButtonElement;

  constructor(cb: ControlsCallbacks) {
    this.el = div("chrome");

    const header = div("topbar");
    this.topInfo = div("topbar-info", "NOVELLE");
    const brand = div("topbar-brand", "NOVELLE");
    header.append(brand, this.topInfo);
    const progress = div("progress-line");
    this.progressFill = div("progress-fill");
    progress.append(this.progressFill);
    header.append(progress);

    const footer = div("controls");
    const mkBtn = (label: string, fn: () => void, cls = "btn"): HTMLButtonElement => {
      const b = h("button", cls, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    this.playBtn = mkBtn("PLAY", cb.onTogglePlay, "btn btn-growth btn-play");
    this.voiceBtn = mkBtn("VOICE ON", cb.onToggleVoice);
    footer.append(
      mkBtn("◀ PREV", cb.onPrev),
      this.playBtn,
      mkBtn("NEXT ▶", cb.onNext),
      mkBtn("A−", () => cb.onFont(-1), "btn btn-small"),
      mkBtn("A+", () => cb.onFont(1), "btn btn-small"),
      this.voiceBtn,
      mkBtn("COVER", cb.onCover),
    );

    this.el.append(header, footer);
  }

  setReadingInfo(text: string): void {
    this.topInfo.textContent = text;
  }

  setProgress(fraction: number): void {
    this.progressFill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  setPlaying(playing: boolean): void {
    this.playBtn.textContent = playing ? "PAUSE" : "PLAY";
    this.playBtn.classList.toggle("btn-playing", playing);
  }

  setVoice(on: boolean): void {
    this.voiceBtn.textContent = on ? "VOICE ON" : "VOICE OFF";
    this.voiceBtn.classList.toggle("btn-voice-off", !on);
  }
}
