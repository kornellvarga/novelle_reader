import * as THREE from "three";
import { prefersReducedMotion } from "../core/util.ts";
import { loadFeralModel, type LoadedFeralModel } from "./feral-model.ts";

interface RainDrop {
  position: THREE.Vector3;
  speed: number;
}

export class Stage3D {
  readonly el = document.createElement("div");
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly startedAt = performance.now();
  private readonly models: LoadedFeralModel[] = [];
  private readonly flameMeshes: THREE.Mesh[] = [];
  private readonly flameBaseScale = new Map<THREE.Mesh, THREE.Vector3>();
  private readonly tokenMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly rainDrops: RainDrop[] = [];
  private rainGeometry: THREE.BufferGeometry | null = null;
  private candleLight!: THREE.PointLight;
  private windowLight!: THREE.DirectionalLight;
  private raf = 0;
  private pointerX = 0;
  private pointerY = 0;
  private storyScene = "room";
  private tokenActive = false;
  private disposed = false;

  constructor(private readonly bookDir: string) {
    this.el.className = "stage3d";
    this.el.setAttribute("aria-hidden", "true");
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "stage3d-canvas";
    this.el.append(this.renderer.domElement);

    this.buildRoom();
    this.resize();
    window.addEventListener("resize", this.resize);
    if (!prefersReducedMotion()) window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    void this.loadStoryModels();
    this.animate();
  }

  setStoryState(sceneId: string, stateKey?: string | null): void {
    this.storyScene = sceneId;
    this.tokenActive = sceneId === "room" && stateKey === "token";
    this.el.dataset.scene = sceneId;
    this.el.dataset.state = stateKey ?? "";
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.models.forEach((model) => model.dispose());
    this.rainGeometry?.dispose();
    this.renderer.dispose();
  }

  private buildRoom(): void {
    this.scene.background = new THREE.Color("#0c0f0e");
    this.scene.fog = new THREE.FogExp2("#0b0d0c", 0.04);
    this.camera.position.set(0.7, 1.2, 8.6);
    this.camera.lookAt(0, -0.15, -1.4);

    const plaster = new THREE.MeshStandardMaterial({ color: "#2a2b24", roughness: 0.98 });
    const timber = new THREE.MeshStandardMaterial({ color: "#2e1c12", roughness: 0.78 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: "#241711", roughness: 0.72 });
    const iron = new THREE.MeshStandardMaterial({ color: "#1d2321", roughness: 0.5, metalness: 0.62 });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 6.4, 0.22), plaster);
    backWall.position.set(0, 1.1, -3.25);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.4, 8), plaster);
    sideWall.position.set(5.9, 1.1, 0.3);
    sideWall.receiveShadow = true;
    this.scene.add(sideWall);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.48, 0.8);
    floor.receiveShadow = true;
    this.scene.add(floor);
    for (let x = -5.5; x <= 5.5; x += 0.72) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 9.7), iron);
      seam.position.set(x, -1.466, 0.75);
      this.scene.add(seam);
    }

    const readingTable = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.2, 3.25), timber);
    readingTable.position.set(0.25, -0.46, 0.5);
    readingTable.castShadow = true;
    readingTable.receiveShadow = true;
    this.scene.add(readingTable);
    const tableEdge = new THREE.Mesh(new THREE.BoxGeometry(6.95, 0.08, 0.08), iron);
    tableEdge.position.set(0.25, -0.4, 2.14);
    this.scene.add(tableEdge);

    this.buildWindow(timber, iron);
    this.buildFireplace(plaster, iron);

    const ambient = new THREE.HemisphereLight("#99b5bd", "#3a1c0f", 0.72);
    this.scene.add(ambient);
    this.windowLight = new THREE.DirectionalLight("#9ac8dc", 2.2);
    this.windowLight.position.set(-4.5, 3.2, 1.5);
    this.windowLight.target.position.set(0.3, -0.6, -1.2);
    this.windowLight.castShadow = true;
    this.windowLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.windowLight, this.windowLight.target);

    const shelfLight = new THREE.PointLight("#6e9baa", 3.2, 6.2, 1.7);
    shelfLight.position.set(-4.2, 1.2, -0.8);
    this.scene.add(shelfLight);

    this.candleLight = new THREE.PointLight("#ff9c37", 12.5, 9.5, 1.8);
    this.candleLight.position.set(3.55, 0.2, 0.15);
    this.candleLight.castShadow = true;
    this.candleLight.shadow.mapSize.set(512, 512);
    this.scene.add(this.candleLight);
    const readingGlow = new THREE.PointLight("#ffc36c", 4.2, 7, 2);
    readingGlow.position.set(0.8, 1.0, 3.2);
    this.scene.add(readingGlow);
  }

  private buildWindow(timber: THREE.Material, iron: THREE.Material): void {
    const outside = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 3.1),
      new THREE.MeshStandardMaterial({ color: "#0b1820", emissive: "#15303b", emissiveIntensity: 0.34, roughness: 0.6 }),
    );
    outside.position.set(-3.6, 1.65, -3.1);
    this.scene.add(outside);

    const addBeam = (w: number, h: number, x: number, y: number, z = -2.98): void => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), timber);
      beam.position.set(x, y, z);
      beam.castShadow = true;
      this.scene.add(beam);
    };
    addBeam(3.35, 0.18, -3.6, 3.24);
    addBeam(3.35, 0.18, -3.6, 0.06);
    addBeam(0.18, 3.35, -5.2, 1.65);
    addBeam(0.18, 3.35, -2.0, 1.65);
    addBeam(0.11, 3.1, -3.6, 1.65);
    addBeam(3.05, 0.11, -3.6, 1.65);

    for (const side of [-1, 1]) {
      const shutter = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.0, 0.12), timber);
      panel.position.x = side * 1.05;
      shutter.add(panel);
      for (let i = -5; i <= 5; i += 1) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.08), iron);
        slat.position.set(side * 1.05, i * 0.23, 0.09);
        slat.rotation.z = -0.08 * side;
        shutter.add(slat);
      }
      shutter.position.set(-3.6, 1.65, -2.85);
      shutter.rotation.y = side * -0.5;
      this.scene.add(shutter);
    }
    this.buildRain();
  }

  private buildRain(): void {
    const points: number[] = [];
    for (let i = 0; i < 88; i += 1) {
      const drop = {
        position: new THREE.Vector3(-5.0 + Math.random() * 2.8, 0.2 + Math.random() * 2.9, -2.78),
        speed: 0.8 + Math.random() * 1.1,
      };
      this.rainDrops.push(drop);
      points.push(drop.position.x, drop.position.y, drop.position.z, drop.position.x + 0.08, drop.position.y - 0.16, drop.position.z);
    }
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const rain = new THREE.LineSegments(
      this.rainGeometry,
      new THREE.LineBasicMaterial({ color: "#a3c3cf", transparent: true, opacity: 0.38 }),
    );
    this.scene.add(rain);
  }

  private buildFireplace(stone: THREE.Material, iron: THREE.Material): void {
    const fireplace = new THREE.Group();
    const blocks = [
      [2.2, 0.35, 0, 0], [0.34, 2.1, -0.92, 0.85], [0.34, 2.1, 0.92, 0.85], [2.35, 0.28, 0, 1.9],
    ];
    for (const [w, h, x, y] of blocks) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.42), stone);
      block.position.set(x, y, 0);
      fireplace.add(block);
    }
    const grate = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.2), iron);
    grate.position.set(0, -0.2, 0.3);
    fireplace.add(grate);
    const ember = new THREE.PointLight("#ff5b1f", 1.3, 2.5, 2);
    ember.position.set(0, 0.25, 0.65);
    fireplace.add(ember);
    fireplace.position.set(3.85, -1.15, -2.86);
    this.scene.add(fireplace);
  }

  private async loadStoryModels(): Promise<void> {
    try {
      const [bookcase, desk, candle, props] = await Promise.all([
        loadFeralModel(`${this.bookDir}/models/abbey-bookcase.json`),
        loadFeralModel(`${this.bookDir}/models/scriptorium-desk.json`),
        loadFeralModel(`${this.bookDir}/models/native-candle.json`),
        loadFeralModel(`${this.bookDir}/models/seraine-props.json`),
      ]);
      if (this.disposed) return;
      this.models.push(bookcase, desk, candle, props);

      bookcase.root.scale.setScalar(0.011);
      bookcase.root.position.set(-4.65, -1.44, -2.35);
      bookcase.root.rotation.y = 0.08;

      desk.root.scale.setScalar(0.0105);
      desk.root.position.set(-3.05, -1.43, -0.75);
      desk.root.rotation.y = 0.08;

      candle.root.scale.setScalar(0.00215);
      candle.root.position.set(3.42, -0.37, 0.72);
      candle.root.rotation.y = -0.25;

      props.root.scale.setScalar(0.0032);
      props.root.position.set(-2.85, -0.36, 1.18);
      props.root.rotation.y = 0.08;

      for (const mesh of candle.meshes) {
        if (/flame/i.test(mesh.name)) {
          this.flameMeshes.push(mesh);
          this.flameBaseScale.set(mesh, mesh.scale.clone());
        }
      }
      for (const mesh of props.meshes) {
        if (/token|empty_cup/i.test(mesh.name)) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) this.tokenMaterials.push(material);
        }
      }
      this.scene.add(bookcase.root, desk.root, candle.root, props.root);
      this.el.dataset.ready = "true";
    } catch (error) {
      this.el.dataset.ready = "fallback";
      console.warn("The Feral3D room props could not be loaded; the reader remains usable.", error);
    }
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.el.clientWidth || window.innerWidth);
    const height = Math.max(1, this.el.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.fov = width < 760 ? 48 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointerX = event.clientX / window.innerWidth - 0.5;
    this.pointerY = event.clientY / window.innerHeight - 0.5;
  };

  private animate = (): void => {
    this.raf = requestAnimationFrame(this.animate);
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const street = this.storyScene === "street";
    const flicker = 0.86 + Math.sin(elapsed * 9.7) * 0.08 + Math.sin(elapsed * 21.3) * 0.035;
    this.candleLight.intensity = (street ? 6.2 : 12.5) * flicker;
    this.windowLight.intensity = street ? 2.8 : 2.2;
    for (const flame of this.flameMeshes) {
      const base = this.flameBaseScale.get(flame) ?? new THREE.Vector3(1, 1, 1);
      flame.scale.set(base.x, base.y * (0.97 + Math.sin(elapsed * 13 + flame.id) * 0.035), base.z);
      flame.rotation.z = Math.sin(elapsed * 7.1 + flame.id) * 0.045;
    }
    for (const material of this.tokenMaterials) {
      material.emissive.set(this.tokenActive ? "#bb7a1e" : "#000000");
      material.emissiveIntensity = this.tokenActive ? 0.42 + Math.sin(elapsed * 3.2) * 0.12 : 0;
    }
    this.animateRain(1 / 60);

    const targetX = 0.7 + this.pointerX * 0.24;
    const targetY = 1.2 - this.pointerY * 0.13;
    this.camera.position.x += (targetX - this.camera.position.x) * 0.035;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.035;
    this.camera.lookAt(0, -0.15, -1.4);
    this.renderer.render(this.scene, this.camera);
  };

  private animateRain(dt: number): void {
    if (!this.rainGeometry || prefersReducedMotion()) return;
    const positions = this.rainGeometry.getAttribute("position") as THREE.BufferAttribute;
    this.rainDrops.forEach((drop, index) => {
      drop.position.y -= drop.speed * dt;
      drop.position.x += drop.speed * dt * 0.22;
      if (drop.position.y < 0.12) {
        drop.position.y = 3.15;
        drop.position.x = -5.0 + Math.random() * 2.8;
      }
      positions.setXYZ(index * 2, drop.position.x, drop.position.y, drop.position.z);
      positions.setXYZ(index * 2 + 1, drop.position.x + 0.08, drop.position.y - 0.16, drop.position.z);
    });
    positions.needsUpdate = true;
  }
}
