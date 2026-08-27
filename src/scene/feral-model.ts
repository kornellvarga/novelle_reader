import * as THREE from "three";

type Vec2 = [number, number];
type Vec3 = [number, number, number];

interface FeralMaterial {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metallic: number;
}

interface FeralFace {
  vertices: number[];
  uvs: Vec2[];
  materialId: string;
}

interface FeralObject {
  id: string;
  name: string;
  visible: boolean;
  transform: { position: Vec3; rotation: Vec3; scale: Vec3; pivot: Vec3 };
  vertices: Array<{ id: number; position: Vec3 }>;
  faces: FeralFace[];
}

export interface FeralBundle {
  format: "novelle-feral3d-bundle";
  formatVersion: 1;
  source: string;
  materials: FeralMaterial[];
  objects: FeralObject[];
}

export interface LoadedFeralModel {
  root: THREE.Group;
  meshes: THREE.Mesh[];
  dispose(): void;
}

function materialFor(source: FeralMaterial): THREE.MeshStandardMaterial {
  const name = source.name.toLowerCase();
  const glass = name.includes("glass") || name.includes("mirror");
  const flame = name.includes("flame") || name.includes("hot flame");
  const material = new THREE.MeshStandardMaterial({
    name: source.name,
    color: source.color,
    roughness: source.roughness,
    metalness: source.metallic,
    side: THREE.DoubleSide,
    flatShading: true,
    transparent: glass || flame,
    opacity: glass ? 0.48 : flame ? 0.78 : 1,
    depthWrite: !glass && !flame,
  });
  if (flame) {
    material.emissive.set(source.color);
    material.emissiveIntensity = name.includes("blue") ? 1.8 : 2.8;
    material.toneMapped = false;
  }
  if (name.includes("wine") && !name.includes("bottle")) {
    material.emissive.set("#26040b");
    material.emissiveIntensity = 0.18;
  }
  return material;
}

function objectMesh(source: FeralObject, materials: Map<string, THREE.MeshStandardMaterial>): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const materialIds = [...new Set(source.faces.map((face) => face.materialId))];
  const vertexById = new Map(source.vertices.map((vertex) => [vertex.id, vertex.position]));
  const geometry = new THREE.BufferGeometry();
  let vertexCursor = 0;

  for (const face of source.faces) {
    const materialIndex = Math.max(0, materialIds.indexOf(face.materialId));
    const start = vertexCursor;
    for (let i = 1; i < face.vertices.length - 1; i += 1) {
      for (const corner of [0, i, i + 1]) {
        positions.push(...(vertexById.get(face.vertices[corner]) ?? [0, 0, 0]));
        uvs.push(...(face.uvs[corner] ?? [0, 0]));
        vertexCursor += 1;
      }
    }
    geometry.addGroup(start, vertexCursor - start, materialIndex);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  const fallback = new THREE.MeshStandardMaterial({ color: "#6f756e", roughness: 0.8 });
  const objectMaterials = materialIds.map((id) => materials.get(id) ?? fallback);
  const mesh = new THREE.Mesh(geometry, objectMaterials);
  mesh.name = source.name;
  mesh.userData.feralObjectId = source.id;
  mesh.position.set(...source.transform.position);
  mesh.rotation.set(...source.transform.rotation);
  mesh.scale.set(...source.transform.scale);
  mesh.visible = source.visible;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export async function loadFeralModel(url: string): Promise<LoadedFeralModel> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load Feral3D model ${url}`);
  const bundle = (await response.json()) as FeralBundle;
  if (bundle.format !== "novelle-feral3d-bundle" || bundle.formatVersion !== 1) {
    throw new Error(`Unsupported Feral3D bundle ${url}`);
  }

  const materials = new Map(bundle.materials.map((source) => [source.id, materialFor(source)]));
  const root = new THREE.Group();
  root.name = bundle.source;
  const meshes = bundle.objects.map((source) => objectMesh(source, materials));
  root.add(...meshes);

  return {
    root,
    meshes,
    dispose(): void {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        meshMaterials.forEach((material) => material.dispose());
      }
    },
  };
}
