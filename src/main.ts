import { Engine } from "./core/engine.ts";
import "./styles/main.css";

async function boot(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;
  const engine = new Engine();
  try {
    await engine.mount(app);
  } catch (err) {
    app.textContent = "The reader failed to open. Reload.";
    console.error(err);
  }
}

void boot();
