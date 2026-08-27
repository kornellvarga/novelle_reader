import { div, h } from "../core/util.ts";
import { MONETIZE } from "../config/monetize.ts";

/**
 * Upsell moment shown when a reader flips past the free sample.
 * Same visual family as the age gate: dark veil, one panel, two choices.
 */
export class PaywallCard {
  readonly el: HTMLElement;

  constructor(bookTitle: string, onClose: () => void) {
    this.el = div("paywall");
    const panel = div("gate-panel");

    const tag = h("span", "tag tag-heat", "FREE SAMPLE ENDS HERE");
    const head = h("h2", "gate-head", "The flame goes further.");
    const body = h("p", "gate-body");
    body.textContent = `You've read to the edge of the free sample of ${bookTitle}. ` +
      "The full book keeps burning — and the saga is already complete.";

    const row = div("gate-row");
    const buy = h("button", "btn btn-growth", MONETIZE.buyLabel.toUpperCase());
    buy.type = "button";
    buy.addEventListener("click", () => {
      window.open(MONETIZE.buyUrl, "_blank", "noopener");
    });

    const later = h("button", "btn", "KEEP BROWSING");
    later.type = "button";
    later.addEventListener("click", () => {
      this.el.classList.add("gone");
      window.setTimeout(() => this.el.remove(), 240);
      onClose();
    });
    row.append(buy, later);

    const brand = div("gate-brand", "NOVELLE · A FERALICIOUS SHELF");
    panel.append(tag, head, body, row, brand);
    this.el.append(panel);
  }
}
