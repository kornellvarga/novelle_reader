import { div } from "../core/util.ts";
import type { InteractionBeat } from "../core/types.ts";

export class InteractionLayer {
  private hotspot: HTMLDivElement;
  private current: InteractionBeat | null = null;
  private consumed = new Set<string>();
  private onTrigger: (beat: InteractionBeat) => void;

  constructor(anchor: HTMLElement, onTrigger: (beat: InteractionBeat) => void) {
    this.onTrigger = onTrigger;
    this.hotspot = div("hotspot");
    this.hotspot.setAttribute("role", "button");
    this.hotspot.setAttribute("tabindex", "0");
    const pulse = div("hotspot-pulse");
    this.hotspot.append(pulse);
    anchor.append(this.hotspot);
    this.hotspot.style.display = "none";
    this.hotspot.addEventListener("click", () => this.fire());
    this.hotspot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.fire();
      }
    });
  }

  private fire(): void {
    if (!this.current) return;
    const beat = this.current;
    this.consumed.add(beat.id);
    this.current = null;
    this.hotspot.style.display = "none";
    this.onTrigger(beat);
  }

  offer(beat: InteractionBeat, promptLabel: string): boolean {
    if (this.consumed.has(beat.id)) return false;
    this.current = beat;
    this.hotspot.style.display = "";
    let labelEl = this.hotspot.querySelector<HTMLDivElement>(".hotspot-label");
    if (!labelEl) {
      labelEl = div("hotspot-label");
      this.hotspot.append(labelEl);
    }
    labelEl.textContent = promptLabel;
    return true;
  }

  isConsumed(id: string): boolean {
    return this.consumed.has(id);
  }

  clear(): void {
    this.current = null;
    this.hotspot.style.display = "none";
  }
}
