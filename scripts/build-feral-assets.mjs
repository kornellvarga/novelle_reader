import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const feralOutput = process.env.FERAL3D_OUTPUT ?? "D:/PROJECT/feral3D/output";
const destination = new URL("../public/books/the-hush/models/", import.meta.url);

const assets = [
  ["native-candle", "Feral3D-Native-Candle.feral3d"],
  ["scriptorium-desk", "Feral-Gothic-Scriptorium-Desk.feral3d"],
  ["abbey-bookcase", "Feral-Gothic-Abbey-Bookcase.feral3d"],
  ["seraine-props", "Feral-Book-One-Seraine-Props.feral3d"],
];

await mkdir(destination, { recursive: true });

for (const [slug, filename] of assets) {
  const source = path.join(feralOutput, filename);
  const archive = await JSZip.loadAsync(await readFile(source));
  const sceneText = await archive.file("scene.json")?.async("text");
  if (!sceneText) throw new Error(`${filename} has no scene.json`);
  const snapshot = JSON.parse(sceneText);
  const scene = snapshot?.scene;
  if (scene?.format !== "feral3d" || scene?.formatVersion !== 1) {
    throw new Error(`${filename} is not a supported Feral3D project`);
  }
  if (!Array.isArray(scene.objects) || !Array.isArray(scene.materials)) {
    throw new Error(`${filename} has incomplete scene data`);
  }

  const bundle = {
    format: "novelle-feral3d-bundle",
    formatVersion: 1,
    source: filename,
    units: scene.units,
    materials: scene.materials.map(({ id, name, color, roughness, metallic }) => ({
      id,
      name,
      color,
      roughness,
      metallic,
    })),
    objects: scene.objects.map((object) => ({
      id: object.id,
      name: object.name,
      visible: object.visible,
      transform: object.transform,
      vertices: object.vertices,
      faces: object.faces,
    })),
  };

  const output = new URL(`${slug}.json`, destination);
  await writeFile(output, `${JSON.stringify(bundle)}\n`, "utf8");
  const faces = bundle.objects.reduce((sum, object) => sum + object.faces.length, 0);
  console.log(`${slug}: ${bundle.objects.length} objects, ${faces} faces`);
}
