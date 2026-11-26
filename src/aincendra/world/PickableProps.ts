import * as THREE from 'three';
import type { InteractableSpec, PickablePropKind } from '../core/types';

export interface PickablePropSpec {
  id: string;
  title: string;
  subtitle: string;
  propKind: PickablePropKind;
  position: [number, number, number];
  lines: string[];
  radius?: number;
}

interface PickableInstance {
  spec: PickablePropSpec;
  root: THREE.Group;
  spinner: THREE.Object3D;
  beaconRing: THREE.Mesh;
  baseSpinnerY: number;
  phase: number;
  collected: boolean;
  collectAnim: number; // 0 -> 1 fade/rise out after pickup
}

/**
 * Procedural Pickable Prop System:
 * Builds grounded 3–5 part composite 3D items (Mana Crystals, Brass Astrolabes,
 * Vaelcrest Cargo Seals, Dispatch Scrolls, Copper Ingots, Herb Satchels) with
 * subtle idle rotation, a crisp ground proximity ring, and smooth pickup vanish.
 */
export class PickablePropSystem {
  public readonly group = new THREE.Group();
  private readonly instances: PickableInstance[] = [];
  private readonly byId = new Map<string, PickableInstance>();
  private readonly disposables: Array<{ dispose: () => void }> = [];

  // Shared materials
  private readonly matBrass: THREE.MeshStandardMaterial;
  private readonly matIron: THREE.MeshStandardMaterial;
  private readonly matOak: THREE.MeshStandardMaterial;
  private readonly matParchment: THREE.MeshStandardMaterial;
  private readonly matCrimsonWax: THREE.MeshStandardMaterial;
  private readonly matTealLeather: THREE.MeshStandardMaterial;
  private readonly matManaCrystal: THREE.MeshStandardMaterial;
  private readonly matGroundRingCyan: THREE.MeshBasicMaterial;
  private readonly matGroundRingAmber: THREE.MeshBasicMaterial;

  // Shared geometries
  private readonly ringGeo: THREE.RingGeometry;
  private readonly plinthGeo: THREE.CylinderGeometry;
  private readonly crystalMainGeo: THREE.OctahedronGeometry;
  private readonly crystalSideGeo: THREE.OctahedronGeometry;
  private readonly gimbalRingGeo: THREE.TorusGeometry;
  private readonly cofferBodyGeo: THREE.BoxGeometry;
  private readonly cofferLidGeo: THREE.BoxGeometry;
  private readonly sealMedallionGeo: THREE.CylinderGeometry;
  private readonly scrollBodyGeo: THREE.CylinderGeometry;
  private readonly scrollCapGeo: THREE.CylinderGeometry;
  private readonly ingotGeo: THREE.CylinderGeometry;
  private readonly satchelBodyGeo: THREE.BoxGeometry;
  private readonly vialGeo: THREE.CylinderGeometry;

  private elapsed = 0;

  constructor(specs: PickablePropSpec[]) {
    this.group.name = 'Elarion_Pickable_Props';

    this.matBrass = new THREE.MeshStandardMaterial({
      color: 0xc98b4e,
      roughness: 0.28,
      metalness: 0.86,
    });
    this.matIron = new THREE.MeshStandardMaterial({
      color: 0x353c45,
      roughness: 0.45,
      metalness: 0.8,
    });
    this.matOak = new THREE.MeshStandardMaterial({
      color: 0x6b472f,
      roughness: 0.78,
      metalness: 0.04,
    });
    this.matParchment = new THREE.MeshStandardMaterial({
      color: 0xebe0c6,
      roughness: 0.88,
      metalness: 0.0,
    });
    this.matCrimsonWax = new THREE.MeshStandardMaterial({
      color: 0xa6312d,
      roughness: 0.48,
      metalness: 0.08,
    });
    this.matTealLeather = new THREE.MeshStandardMaterial({
      color: 0x2f6b64,
      roughness: 0.72,
      metalness: 0.06,
    });
    this.matManaCrystal = new THREE.MeshStandardMaterial({
      color: 0x7ae3f5,
      emissive: 0x2da6bd,
      emissiveIntensity: 1.35,
      roughness: 0.16,
      metalness: 0.15,
    });
    this.matGroundRingCyan = new THREE.MeshBasicMaterial({
      color: 0x7de2f0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.matGroundRingAmber = new THREE.MeshBasicMaterial({
      color: 0xe6b385,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.ringGeo = new THREE.RingGeometry(0.36, 0.44, 24);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.plinthGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.14, 8);
    this.crystalMainGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.crystalMainGeo.scale(0.68, 1.55, 0.68);
    this.crystalSideGeo = new THREE.OctahedronGeometry(0.1, 0);
    this.crystalSideGeo.scale(0.65, 1.35, 0.65);

    this.gimbalRingGeo = new THREE.TorusGeometry(0.22, 0.022, 8, 24);
    this.cofferBodyGeo = new THREE.BoxGeometry(0.42, 0.22, 0.28);
    this.cofferLidGeo = new THREE.BoxGeometry(0.44, 0.07, 0.3);
    this.sealMedallionGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12);

    this.scrollBodyGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.44, 12);
    this.scrollCapGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.04, 12);
    this.ingotGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.34, 4);
    this.ingotGeo.rotateY(Math.PI / 4);
    this.satchelBodyGeo = new THREE.BoxGeometry(0.32, 0.24, 0.2);
    this.vialGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.18, 10);

    this.disposables.push(
      this.matBrass,
      this.matIron,
      this.matOak,
      this.matParchment,
      this.matCrimsonWax,
      this.matTealLeather,
      this.matManaCrystal,
      this.matGroundRingCyan,
      this.matGroundRingAmber,
      this.ringGeo,
      this.plinthGeo,
      this.crystalMainGeo,
      this.crystalSideGeo,
      this.gimbalRingGeo,
      this.cofferBodyGeo,
      this.cofferLidGeo,
      this.sealMedallionGeo,
      this.scrollBodyGeo,
      this.scrollCapGeo,
      this.ingotGeo,
      this.satchelBodyGeo,
      this.vialGeo
    );

    specs.forEach((spec, idx) => {
      const inst = this.createInstance(spec, idx * 1.15);
      this.instances.push(inst);
      this.byId.set(spec.id, inst);
      this.group.add(inst.root);
    });
  }

  private createInstance(spec: PickablePropSpec, phase: number): PickableInstance {
    const root = new THREE.Group();
    root.name = `Pickable_${spec.id}`;
    root.position.set(spec.position[0], spec.position[1], spec.position[2]);

    const isManaTheme = spec.propKind === 'mana-crystal' || spec.propKind === 'brass-astrolabe';
    const beaconRing = new THREE.Mesh(
      this.ringGeo,
      isManaTheme ? this.matGroundRingCyan : this.matGroundRingAmber
    );
    beaconRing.position.y = 0.015;
    root.add(beaconRing);

    const spinner = new THREE.Group();
    let baseSpinnerY = 0.26;

    switch (spec.propKind) {
      case 'mana-crystal': {
        const plinth = new THREE.Mesh(this.plinthGeo, this.matIron);
        plinth.position.y = 0.07;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        root.add(plinth);

        const collar = new THREE.Mesh(this.gimbalRingGeo, this.matBrass);
        collar.rotation.x = Math.PI / 2;
        collar.scale.setScalar(0.85);
        collar.position.y = 0.16;
        root.add(collar);

        baseSpinnerY = 0.42;
        spinner.position.y = baseSpinnerY;
        const mainShard = new THREE.Mesh(this.crystalMainGeo, this.matManaCrystal);
        mainShard.castShadow = true;
        const sideA = new THREE.Mesh(this.crystalSideGeo, this.matManaCrystal);
        sideA.position.set(0.11, -0.05, 0.04);
        sideA.rotation.z = -0.35;
        const sideB = new THREE.Mesh(this.crystalSideGeo, this.matManaCrystal);
        sideB.position.set(-0.1, -0.06, -0.05);
        sideB.rotation.z = 0.32;
        spinner.add(mainShard, sideA, sideB);
        break;
      }

      case 'brass-astrolabe': {
        const stand = new THREE.Mesh(this.plinthGeo, this.matOak);
        stand.position.y = 0.07;
        stand.castShadow = true;
        stand.receiveShadow = true;
        root.add(stand);

        baseSpinnerY = 0.44;
        spinner.position.y = baseSpinnerY;
        const outerRing = new THREE.Mesh(this.gimbalRingGeo, this.matBrass);
        outerRing.castShadow = true;
        const innerRing = new THREE.Mesh(this.gimbalRingGeo, this.matBrass);
        innerRing.scale.setScalar(0.76);
        innerRing.rotation.y = Math.PI / 2.4;
        innerRing.rotation.x = 0.45;
        const coreGem = new THREE.Mesh(this.crystalSideGeo, this.matManaCrystal);
        coreGem.scale.setScalar(0.7);
        spinner.add(outerRing, innerRing, coreGem);
        break;
      }

      case 'cargo-seal': {
        const body = new THREE.Mesh(this.cofferBodyGeo, this.matOak);
        body.position.y = 0.11;
        body.castShadow = true;
        body.receiveShadow = true;
        const lid = new THREE.Mesh(this.cofferLidGeo, this.matIron);
        lid.position.y = 0.25;
        lid.castShadow = true;
        root.add(body, lid);

        baseSpinnerY = 0.34;
        spinner.position.y = baseSpinnerY;
        const medallion = new THREE.Mesh(this.sealMedallionGeo, this.matBrass);
        medallion.rotation.x = Math.PI / 2;
        const wax = new THREE.Mesh(this.sealMedallionGeo, this.matCrimsonWax);
        wax.scale.set(0.65, 1.3, 0.65);
        wax.rotation.x = Math.PI / 2;
        spinner.add(medallion, wax);
        break;
      }

      case 'dispatch-scroll': {
        const tray = new THREE.Mesh(this.plinthGeo, this.matIron);
        tray.scale.set(1.2, 0.45, 0.9);
        tray.position.y = 0.03;
        tray.receiveShadow = true;
        root.add(tray);

        baseSpinnerY = 0.24;
        spinner.position.y = baseSpinnerY;
        const tube = new THREE.Mesh(this.scrollBodyGeo, this.matParchment);
        tube.rotation.z = Math.PI / 2;
        tube.rotation.y = 0.35;
        tube.castShadow = true;
        const capL = new THREE.Mesh(this.scrollCapGeo, this.matBrass);
        capL.rotation.z = Math.PI / 2;
        capL.position.set(-0.21, 0, 0);
        const capR = new THREE.Mesh(this.scrollCapGeo, this.matBrass);
        capR.rotation.z = Math.PI / 2;
        capR.position.set(0.21, 0, 0);
        const ribbon = new THREE.Mesh(this.scrollCapGeo, this.matCrimsonWax);
        ribbon.rotation.z = Math.PI / 2;
        ribbon.scale.set(0.95, 1.4, 0.95);
        spinner.add(tube, capL, capR, ribbon);
        break;
      }

      case 'copper-ingot': {
        const tray = new THREE.Mesh(this.plinthGeo, this.matIron);
        tray.scale.set(1.3, 0.45, 1.3);
        tray.position.y = 0.03;
        tray.receiveShadow = true;
        root.add(tray);

        baseSpinnerY = 0.19;
        spinner.position.y = baseSpinnerY;
        const bar1 = new THREE.Mesh(this.ingotGeo, this.matBrass);
        bar1.rotation.z = Math.PI / 2;
        bar1.position.set(0, -0.02, 0.08);
        bar1.castShadow = true;
        const bar2 = new THREE.Mesh(this.ingotGeo, this.matBrass);
        bar2.rotation.z = Math.PI / 2;
        bar2.position.set(0, -0.02, -0.08);
        bar2.castShadow = true;
        const bar3 = new THREE.Mesh(this.ingotGeo, this.matBrass);
        bar3.rotation.z = Math.PI / 2;
        bar3.position.set(0, 0.1, 0);
        bar3.castShadow = true;
        spinner.add(bar1, bar2, bar3);
        break;
      }

      case 'herb-satchel': {
        baseSpinnerY = 0.18;
        spinner.position.y = baseSpinnerY;
        const bag = new THREE.Mesh(this.satchelBodyGeo, this.matTealLeather);
        bag.castShadow = true;
        bag.receiveShadow = true;
        const clasp = new THREE.Mesh(this.sealMedallionGeo, this.matBrass);
        clasp.rotation.x = Math.PI / 2;
        clasp.scale.setScalar(0.65);
        clasp.position.set(0, 0.02, 0.11);
        const vial = new THREE.Mesh(this.vialGeo, this.matManaCrystal);
        vial.position.set(0.11, 0.13, 0);
        vial.rotation.z = -0.25;
        spinner.add(bag, clasp, vial);
        break;
      }
    }

    root.add(spinner);

    return {
      spec,
      root,
      spinner,
      beaconRing,
      baseSpinnerY,
      phase,
      collected: false,
      collectAnim: 0,
    };
  }

  public toInteractables(): InteractableSpec[] {
    return this.instances.map((inst) => ({
      id: inst.spec.id,
      title: inst.spec.title,
      subtitle: inst.spec.subtitle,
      category: 'Item',
      promptAction: 'Pick Up',
      lines: inst.spec.lines,
      position: inst.spec.position,
      radius: inst.spec.radius ?? 2.8,
      labelHeight: 1.05,
      pickable: true,
    }));
  }

  public collect(id: string): boolean {
    const inst = this.byId.get(id);
    if (!inst || inst.collected) return false;
    inst.collected = true;
    inst.collectAnim = 0.001;
    inst.beaconRing.visible = false;
    return true;
  }

  public update(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);
    this.elapsed += clampedDt;

    for (const inst of this.instances) {
      if (inst.collected) {
        if (inst.root.visible) {
          inst.collectAnim += clampedDt * 4.2;
          const t = Math.min(1, inst.collectAnim);
          const s = Math.max(0.01, 1 - t);
          inst.root.scale.setScalar(s);
          inst.spinner.position.y = inst.baseSpinnerY + t * 0.45;
          inst.spinner.rotation.y += clampedDt * 9.0;
          if (t >= 1) {
            inst.root.visible = false;
          }
        }
        continue;
      }

      const t = this.elapsed * 2.1 + inst.phase;
      inst.spinner.rotation.y += clampedDt * 1.15;
      inst.spinner.position.y = inst.baseSpinnerY + Math.sin(t) * 0.045;
      const ringScale = 0.94 + Math.sin(t * 1.4) * 0.08;
      inst.beaconRing.scale.setScalar(ringScale);
    }
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
