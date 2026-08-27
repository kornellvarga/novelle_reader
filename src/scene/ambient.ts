import { prefersReducedMotion } from "../core/util.ts";

export type AmbientKind = "rain" | "candle";

export interface AmbientHandle {
  stop(): void;
}

export function startRain(canvas: HTMLCanvasElement): AmbientHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop(): void {} };
  const sync = (): void => {
    if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
    if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;
  };
  const resize = sync;
  window.addEventListener("resize", resize);
  if (prefersReducedMotion()) {
    const once = (): void => {
      sync();
      drawStatic(ctx, canvas);
    };
    requestAnimationFrame(once);
    return {
      stop(): void {
        window.removeEventListener("resize", resize);
      },
    };
  }
  let raf = 0;
  let running = true;
  interface Drop {
    x: number;
    y: number;
    len: number;
    speed: number;
    alpha: number;
  }
  const drops: Drop[] = Array.from({ length: 90 }, () => spawn(canvas, true));
  const loop = (): void => {
    if (!running) return;
    sync();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of drops) {
      d.y += d.speed;
      d.x += d.speed * 0.28;
      if (d.y > canvas.height + 20) Object.assign(d, spawn(canvas, false));
      ctx.strokeStyle = `rgba(190, 210, 220, ${d.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.28, d.y - d.len);
      ctx.stroke();
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return {
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}

function spawn(canvas: HTMLCanvasElement, initial: boolean): { x: number; y: number; len: number; speed: number; alpha: number } {
  return {
    x: Math.random() * canvas.width,
    y: initial ? Math.random() * canvas.height : -30,
    len: 12 + Math.random() * 18,
    speed: 5 + Math.random() * 6,
    alpha: 0.08 + Math.random() * 0.16,
  };
}

function drawStatic(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.strokeStyle = "rgba(190, 210, 220, 0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const len = 12 + Math.random() * 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.28, y - len);
    ctx.stroke();
  }
}

export function startFlame(canvas: HTMLCanvasElement, glow: HTMLElement): AmbientHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop(): void {} };
  const reduced = prefersReducedMotion();
  const sync = (): void => {
    if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
    if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;
  };
  const resize = sync;
  window.addEventListener("resize", resize);

  if (reduced) {
    const once = (): void => {
      sync();
      drawFlame(ctx, canvas.width / 2, canvas.height * 0.84, 0.8);
      glow.style.opacity = "0.75";
    };
    requestAnimationFrame(once);
    return {
      stop(): void {
        window.removeEventListener("resize", resize);
      },
    };
  }

  let raf = 0;
  let t = Math.random() * 100;
  let running = true;
  const loop = (): void => {
    if (!running) return;
    sync();
    t += 0.09;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const wobble =
      Math.sin(t * 1.7) * 1.4 +
      Math.sin(t * 3.9 + 1.3) * 0.9 +
      (Math.random() - 0.5) * 0.7;
    const life = 0.72 + Math.sin(t * 2.3) * 0.06 + Math.sin(t * 5.1) * 0.04;
    drawFlame(ctx, canvas.width / 2 + wobble, canvas.height * 0.84, life);
    glow.style.opacity = String(0.62 + Math.sin(t * 1.3) * 0.07 + Math.random() * 0.05);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return {
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, baseY: number, life: number): void {
  const hgt = 52 * life;
  const wid = 17 * (0.9 + life * 0.15);
  const grad = ctx.createRadialGradient(x, baseY - hgt * 0.45, 2, x, baseY - hgt * 0.45, hgt * 1.2);
  grad.addColorStop(0, "rgba(255, 244, 205, 1)");
  grad.addColorStop(0.35, "rgba(255, 176, 32, 0.8)");
  grad.addColorStop(0.7, "rgba(255, 120, 20, 0.35)");
  grad.addColorStop(1, "rgba(255, 100, 10, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, baseY - hgt - 9);
  ctx.quadraticCurveTo(x + wid, baseY - hgt * 0.5, x, baseY);
  ctx.quadraticCurveTo(x - wid, baseY - hgt * 0.5, x, baseY - hgt - 9);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 250, 230, 0.95)";
  ctx.beginPath();
  ctx.ellipse(x, baseY - hgt * 0.28, wid * 0.32, hgt * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(90, 60, 25, 0.9)";
  ctx.fillRect(x - 9, baseY, 18, 5);
}
