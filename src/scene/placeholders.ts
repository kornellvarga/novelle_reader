export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const painters = new Map<string, Painter>();

function register(key: string, p: Painter): void {
  painters.set(key, p);
}

export function hasPainter(key: string): boolean {
  return painters.has(key);
}

export function paintPlaceholder(canvas: HTMLCanvasElement, key: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const hgt = canvas.height;
  const painter = painters.get(key);
  if (painter) {
    painter(ctx, w, hgt);
    return;
  }
  vignette(ctx, w, hgt, "#101210", "#060706");
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, inner: string, outer: string): void {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.1, w * 0.5, h * 0.5, w * 0.85);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

register("room", (ctx, w, h) => {
  vignette(ctx, w, h, "#1a1712", "#080907");
  const wx = w * 0.18;
  const wy = h * 0.1;
  const ww = w * 0.64;
  const wh = h * 0.44;
  ctx.fillStyle = "#0c1216";
  ctx.fillRect(wx, wy, ww, wh);
  ctx.strokeStyle = "rgba(233, 234, 228, 0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(160, 185, 200, 0.16)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 26; i++) {
    const rx = wx + Math.random() * ww;
    const ry = wy + Math.random() * wh;
    const rl = 14 + Math.random() * 26;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - rl * 0.22, ry + rl);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(w * 0.72, h * 0.86, 8, w * 0.72, h * 0.86, w * 0.55);
  glow.addColorStop(0, "rgba(255, 176, 32, 0.34)");
  glow.addColorStop(1, "rgba(255, 176, 32, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#141210";
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  ctx.fillStyle = "rgba(233, 234, 228, 0.75)";
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.78, w * 0.05, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(w * 0.57, h * 0.78, w * 0.1, h * 0.02);
});

register("room:token", (ctx, w, h) => {
  ctx.fillStyle = "#070807";
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.3;
  const brass = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
  brass.addColorStop(0, "#e8b64d");
  brass.addColorStop(0.55, "#a97f28");
  brass.addColorStop(1, "#5e4514");
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40, 28, 8, 0.7)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI * 0.92);
  ctx.fillStyle = "rgba(45, 30, 10, 0.85)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.05, 0, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(r * 0.32, -r * 0.07, r * 0.34, r * 0.14);
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 220, 140, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.35 + i * 0.07), Math.random() * 6, Math.random() * 6);
    ctx.stroke();
  }
});

register("street", (ctx, w, h) => {
  vignette(ctx, w, h, "#11161c", "#05070a");
  const lampX = w * 0.68;
  const lampY = h * 0.3;
  const halo = ctx.createRadialGradient(lampX, lampY, 4, lampX, lampY, w * 0.4);
  halo.addColorStop(0, "rgba(255, 196, 90, 0.4)");
  halo.addColorStop(1, "rgba(255, 196, 90, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.fillStyle = "rgba(180, 195, 205, 0.13)";
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const l = 20 + Math.random() * 36;
    ctx.fillRect(x, y, 1.2, l);
  }
  const fx = w * 0.38;
  const fh = h * 0.34;
  ctx.fillStyle = "#04050a";
  ctx.beginPath();
  ctx.moveTo(fx - w * 0.09, h * 0.82);
  ctx.quadraticCurveTo(fx - w * 0.085, h * 0.82 - fh * 0.62, fx, h * 0.82 - fh);
  ctx.quadraticCurveTo(fx + w * 0.085, h * 0.82 - fh * 0.62, fx + w * 0.09, h * 0.82);
  ctx.closePath();
  ctx.fill();
});
