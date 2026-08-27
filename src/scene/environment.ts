import { div } from "../core/util.ts";
import { hasPainter, paintPlaceholder } from "./placeholders.ts";
import { Stage3D } from "./stage3d.ts";

const IMAGE_EXT = ["png", "webp", "jpg", "jpeg"] as const;
const MOTION_EXT = ["webm", "mp4", "gif"] as const;

function loadFirst(urls: string[], motion: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = (): void => {
      if (i >= urls.length) {
        resolve(null);
        return;
      }
      const url = urls[i++];
      if (motion && (url.endsWith(".webm") || url.endsWith(".mp4"))) {
        const v = document.createElement("video");
        v.oncanplay = () => resolve(url);
        v.onerror = tryNext;
        v.src = url;
        return;
      }
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}

export interface SceneSpec {
  id: string;
  alt: string;
}

export class Environment {
  readonly root: HTMLElement = div("stage");
  private bookDir: string;
  private artHost: HTMLElement;
  private caption: HTMLElement;
  private stage3d: Stage3D;
  private token = 0;

  constructor(bookDir: string) {
    this.bookDir = bookDir.replace(/\/$/, "");
    this.stage3d = new Stage3D(this.bookDir);
    this.buildStage(this.root);
    this.artHost = this.root.querySelector<HTMLElement>(".art-media")!;
    this.caption = this.root.querySelector<HTMLElement>(".art-caption")!;
  }

  dispose(): void {
    this.stage3d.dispose();
  }

  private buildStage(stage: HTMLElement): void {
    const artFrame = div("art-frame");
    artFrame.dataset.depth = "0.7";
    artFrame.id = "art-anchor";
    const media = div("art-media");
    const cap = div("art-caption");
    artFrame.append(media, cap);

    const atmosphere = div("room-atmosphere");
    stage.append(this.stage3d.el, atmosphere, artFrame);
  }

  async setScene(spec: SceneSpec, stateKey?: string | null): Promise<void> {
    const myToken = ++this.token;
    const base = stateKey ? `${spec.id}-${stateKey}` : spec.id;

    this.stage3d.setStoryState(spec.id, stateKey);

    this.caption.textContent = spec.alt;

    const imageUrls = IMAGE_EXT.map((e) => `${this.bookDir}/art/scenes/${base}.${e}`);
    const foundImage = await loadFirst(imageUrls, false);
    if (myToken !== this.token) return;
    if (foundImage) {
      this.renderImage(foundImage, spec.alt);
      return;
    }

    const motionUrls = MOTION_EXT.map((e) => `${this.bookDir}/art/motion/${base}.${e}`);
    const foundMotion = await loadFirst(motionUrls, true);
    if (myToken !== this.token) return;
    if (foundMotion) {
      this.renderMotion(foundMotion, spec.alt);
      return;
    }

    if (!stateKey && !hasPainter(`${spec.id}`)) {
      this.renderEmpty();
      return;
    }
    this.renderProcedural(stateKey ? `${spec.id}:${stateKey}` : spec.id);
  }

  clearScene(): void {
    this.token += 1;
    this.artHost.replaceChildren();
    this.caption.textContent = "";
  }

  private renderImage(url: string, alt: string): void {
    this.artHost.replaceChildren();
    const img = new Image();
    img.alt = alt;
    img.className = "art-img";
    img.src = url;
    this.artHost.append(img);
  }

  private renderMotion(url: string, alt: string): void {
    this.artHost.replaceChildren();
    if (url.endsWith(".gif")) {
      const img = new Image();
      img.alt = alt;
      img.className = "art-img";
      img.src = url;
      this.artHost.append(img);
      return;
    }
    const v = document.createElement("video");
    v.className = "art-img";
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute("aria-label", alt);
    v.src = url;
    void v.play().catch(() => undefined);
    this.artHost.append(v);
  }

  private renderEmpty(): void {
    this.artHost.replaceChildren();
    this.artHost.append(div("art-empty"));
  }

  private renderProcedural(key: string): void {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 800;
    canvas.className = "art-img";
    paintPlaceholder(canvas, key);
    this.artHost.replaceChildren(canvas);
  }
}
