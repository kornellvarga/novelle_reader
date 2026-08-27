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
  private moreBtn: HTMLButtonElement;

  constructor(cb: ControlsCallbacks) {
    this.el = div("chrome");
    const scrim = div("control-tools-scrim");
    scrim.addEventListener("click", () => this.setToolsOpen(false));

    const header = div("topbar");
    this.topInfo = div("topbar-info", "NOVELLE");
    const brand = div("topbar-brand", "NOVELLE");
    header.append(brand, this.topInfo);
    const progress = div("progress-line");
    this.progressFill = div("progress-fill");
    progress.append(this.progressFill);
    header.append(progress);

    const footer = div("controls");
    const nav = div("control-nav");
    const tools = div("control-tools");
    tools.id = "reader-tools";
    const mkBtn = (label: string, fn: () => void, cls = "btn", ariaLabel?: string): HTMLButtonElement => {
      const b = h("button", cls, label);
      b.type = "button";
      if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
      b.addEventListener("click", fn);
      return b;
    };
    this.playBtn = mkBtn("PLAY", cb.onTogglePlay, "btn btn-growth btn-play");
    this.voiceBtn = mkBtn("VOICE ON", () => {
      cb.onToggleVoice();
      this.setToolsOpen(false);
    });
    this.moreBtn = mkBtn("TOOLS", () => this.setToolsOpen(!this.el.classList.contains("tools-open")), "btn btn-more");
    this.moreBtn.setAttribute("aria-expanded", "false");
    this.moreBtn.setAttribute("aria-controls", tools.id);
    nav.append(
      mkBtn("◀ PREV", cb.onPrev, "btn", "Previous page"),
      this.playBtn,
      mkBtn("NEXT ▶", cb.onNext, "btn", "Next page"),
      this.moreBtn,
    );
    tools.append(
      mkBtn("A−", () => {
        cb.onFont(-1);
        this.setToolsOpen(false);
      }, "btn btn-small", "Decrease text size"),
      mkBtn("A+", () => {
        cb.onFont(1);
        this.setToolsOpen(false);
      }, "btn btn-small", "Increase text size"),
      this.voiceBtn,
      mkBtn("COVER", () => {
        cb.onCover();
        this.setToolsOpen(false);
      }),
    );
    footer.append(nav, tools);

    this.el.append(scrim, header, footer);

    const syncChromeSize = (): void => {
      document.documentElement.style.setProperty("--reader-top", `${Math.ceil(header.getBoundingClientRect().height)}px`);
      document.documentElement.style.setProperty("--reader-bottom", `${Math.ceil(footer.getBoundingClientRect().height)}px`);
    };
    const observer = new ResizeObserver(syncChromeSize);
    observer.observe(header);
    observer.observe(footer);
    requestAnimationFrame(syncChromeSize);
  }

  private setToolsOpen(open: boolean): void {
    this.el.classList.toggle("tools-open", open);
    this.moreBtn.setAttribute("aria-expanded", String(open));
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
