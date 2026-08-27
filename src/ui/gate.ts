import { div, h } from "../core/util.ts";

export class AgeGate {
  readonly el: HTMLElement;
  private onPass: () => void;

  constructor(onPass: () => void) {
    this.onPass = onPass;
    this.el = div("gate");
    const panel = div("gate-panel");

    const tag = h("span", "tag tag-heat", "18+");
    const head = h("h2", "gate-head", "This one's adult.");
    const body = h("p", "gate-body");
    body.textContent =
      "Explicit content. You need to be 18. We check once, we don't keep your ID, we don't tell anyone.";

    const row = div("gate-row");
    const yes = h("button", "btn btn-growth", "I'M 18+");
    yes.type = "button";
    const no = h("button", "btn", "BACK");
    no.type = "button";
    no.addEventListener("click", () => {
      window.location.href = "https://feralicious.com";
    });
    yes.addEventListener("click", () => {
      try {
        window.localStorage.setItem("novelle:gate", "1");
      } catch {
        /* storage unavailable */
      }
      this.el.classList.add("gone");
      window.setTimeout(() => this.el.remove(), 240);
      this.onPass();
    });
    row.append(yes, no);

    const brand = div("gate-brand", "NOVELLE · A FERALICIOUS SHELF");
    panel.append(tag, head, body, row, brand);
    this.el.append(panel);
  }
}
