import * as THREE from 'three';
import type { BoxCollider } from '../core/types';

export interface SculptedMaterials {
  sandstone: THREE.Material;
  limestone: THREE.Material;
  timber: THREE.Material;
  darkTimber: THREE.Material;
  iron: THREE.Material;
  copper: THREE.Material;
  glass: THREE.Material;
  manaLamp: THREE.Material;
  warmLantern: THREE.Material;
  slateRoof: THREE.Material;
  brick: THREE.Material;
  foliage: THREE.Material;
  foliageLight: THREE.Material;
  plaster: THREE.Material;
  awningRed: THREE.Material;
  awningGreen: THREE.Material;
  awningBlue: THREE.Material;
  parchment: THREE.Material;
  flowerRed: THREE.Material;
  flowerGold: THREE.Material;
  flowerViolet: THREE.Material;
  bannerTeal: THREE.Material;
  bannerOchre: THREE.Material;
}

export class ElarionSculptedBuilders {
  private readonly group: THREE.Group;
  private readonly boxColliders: BoxCollider[];
  private readonly raycastTargets: THREE.Object3D[];
  private readonly disposables: Array<{ dispose: () => void }>;
  private readonly mats: SculptedMaterials;

  // Cached shared BufferGeometries for Iris Xe draw-call & VRAM efficiency
  private readonly lampPlinthGeo: THREE.LatheGeometry;
  private readonly lampPostGeo: THREE.LatheGeometry;
  private readonly lampGlassCageGeo: THREE.CylinderGeometry;
  private readonly lampCoreGeo: THREE.OctahedronGeometry;
  private readonly lampFinialGeo: THREE.ConeGeometry;
  private readonly lampBracketGeo: THREE.BoxGeometry;

  private readonly barrelBodyGeo: THREE.LatheGeometry;
  private readonly barrelHoopGeo: THREE.TorusGeometry;
  private readonly barrelLidGeo: THREE.CylinderGeometry;

  private readonly crateCoreGeo: THREE.BoxGeometry;
  private readonly crateStileGeo: THREE.BoxGeometry;
  private readonly crateBraceGeo: THREE.BoxGeometry;

  private readonly planterRingGeo: THREE.CylinderGeometry;
  private readonly planterSoilGeo: THREE.CylinderGeometry;
  private readonly trunkGeo: THREE.CylinderGeometry;
  private readonly branchGeo: THREE.CylinderGeometry;
  private readonly canopyMainGeo: THREE.IcosahedronGeometry;
  private readonly canopySideGeo: THREE.IcosahedronGeometry;

  private readonly benchLegGeo: THREE.BoxGeometry;
  private readonly benchSlatGeo: THREE.BoxGeometry;

  private readonly wheelRimGeo: THREE.TorusGeometry;
  private readonly wheelHubGeo: THREE.CylinderGeometry;
  private readonly wheelSpokeGeo: THREE.CylinderGeometry;

  private readonly flowerBoxGeo: THREE.BoxGeometry;
  private readonly flowerTuftGeo: THREE.IcosahedronGeometry;
  private readonly pennantGeo: THREE.ConeGeometry;
  private readonly urnGeo: THREE.LatheGeometry;
  private readonly shrubGeo: THREE.IcosahedronGeometry;
  private readonly palletGeo: THREE.BoxGeometry;
  private readonly clothBoltGeo: THREE.CylinderGeometry;

  constructor(
    group: THREE.Group,
    boxColliders: BoxCollider[],
    raycastTargets: THREE.Object3D[],
    disposables: Array<{ dispose: () => void }>,
    mats: SculptedMaterials
  ) {
    this.group = group;
    this.boxColliders = boxColliders;
    this.raycastTargets = raycastTargets;
    this.disposables = disposables;
    this.mats = mats;

    // 1. Lathe Street Lamp Profile
    this.lampPlinthGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.32, 0.0),
        new THREE.Vector2(0.30, 0.14),
        new THREE.Vector2(0.24, 0.24),
        new THREE.Vector2(0.26, 0.44),
        new THREE.Vector2(0.18, 0.54),
        new THREE.Vector2(0.0, 0.54),
      ],
      10
    );
    this.lampPostGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.15, 0.54),
        new THREE.Vector2(0.11, 0.85),
        new THREE.Vector2(0.085, 2.2),
        new THREE.Vector2(0.13, 2.34),
        new THREE.Vector2(0.075, 2.45),
        new THREE.Vector2(0.075, 3.35),
        new THREE.Vector2(0.18, 3.48),
        new THREE.Vector2(0.22, 3.56),
        new THREE.Vector2(0.0, 3.56),
      ],
      10
    );
    this.lampGlassCageGeo = new THREE.CylinderGeometry(0.19, 0.15, 0.42, 6);
    this.lampCoreGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.lampFinialGeo = new THREE.ConeGeometry(0.26, 0.28, 6);
    this.lampBracketGeo = new THREE.BoxGeometry(0.04, 0.44, 0.04);

    // 2. Lathe Barrel Stave Profile
    this.barrelBodyGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.31, 0.0),
        new THREE.Vector2(0.36, 0.22),
        new THREE.Vector2(0.39, 0.46),
        new THREE.Vector2(0.36, 0.70),
        new THREE.Vector2(0.31, 0.92),
        new THREE.Vector2(0.28, 0.92),
        new THREE.Vector2(0.28, 0.86),
        new THREE.Vector2(0.0, 0.86),
      ],
      12
    );
    this.barrelHoopGeo = new THREE.TorusGeometry(0.368, 0.024, 6, 14);
    this.barrelLidGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12);

    // 3. Crate Unit Geometries (scaled per crate)
    this.crateCoreGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
    this.crateStileGeo = new THREE.BoxGeometry(1.0, 0.11, 1.0);
    this.crateBraceGeo = new THREE.BoxGeometry(0.09, 1.05, 0.98);

    // 4. Tree Planter & Sculpted Canopy
    this.planterRingGeo = new THREE.CylinderGeometry(0.96, 1.06, 0.52, 8);
    this.planterSoilGeo = new THREE.CylinderGeometry(0.84, 0.84, 0.44, 8);
    this.trunkGeo = new THREE.CylinderGeometry(0.17, 0.26, 2.3, 8);
    this.branchGeo = new THREE.CylinderGeometry(0.08, 0.13, 1.15, 7);
    this.canopyMainGeo = this.createJitteredCanopy(1.38, 1);
    this.canopySideGeo = this.createJitteredCanopy(0.96, 1);

    // 5. Bench Parts
    this.benchLegGeo = new THREE.BoxGeometry(0.56, 0.44, 0.09);
    this.benchSlatGeo = new THREE.BoxGeometry(0.13, 0.055, 1.82);

    // 6. Spoked Cart Wheel
    this.wheelRimGeo = new THREE.TorusGeometry(0.46, 0.055, 7, 16);
    this.wheelHubGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10);
    this.wheelSpokeGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.88, 6);

    // 7. Vibrant Prop Geometries (Flower Boxes, Bunting, Shrub Urns, Pallets, Cloth Bolts)
    this.flowerBoxGeo = new THREE.BoxGeometry(1.15, 0.24, 0.34);
    this.flowerTuftGeo = new THREE.IcosahedronGeometry(0.16, 0);
    this.pennantGeo = new THREE.ConeGeometry(0.18, 0.38, 3);
    this.urnGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.28, 0.0),
        new THREE.Vector2(0.22, 0.12),
        new THREE.Vector2(0.36, 0.38),
        new THREE.Vector2(0.40, 0.56),
        new THREE.Vector2(0.33, 0.56),
        new THREE.Vector2(0.0, 0.48),
      ],
      10
    );
    this.shrubGeo = this.createJitteredCanopy(0.48, 1);
    this.palletGeo = new THREE.BoxGeometry(1.75, 0.14, 1.35);
    this.clothBoltGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.68, 8);

    disposables.push(
      this.lampPlinthGeo,
      this.lampPostGeo,
      this.lampGlassCageGeo,
      this.lampCoreGeo,
      this.lampFinialGeo,
      this.lampBracketGeo,
      this.barrelBodyGeo,
      this.barrelHoopGeo,
      this.barrelLidGeo,
      this.crateCoreGeo,
      this.crateStileGeo,
      this.crateBraceGeo,
      this.planterRingGeo,
      this.planterSoilGeo,
      this.trunkGeo,
      this.branchGeo,
      this.canopyMainGeo,
      this.canopySideGeo,
      this.benchLegGeo,
      this.benchSlatGeo,
      this.wheelRimGeo,
      this.wheelHubGeo,
      this.wheelSpokeGeo,
      this.flowerBoxGeo,
      this.flowerTuftGeo,
      this.pennantGeo,
      this.urnGeo,
      this.shrubGeo,
      this.palletGeo,
      this.clothBoltGeo
    );
  }

  private createJitteredCanopy(radius: number, detail: number): THREE.IcosahedronGeometry {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n = 1 + 0.12 * Math.sin(vx * 3.1 + vy * 2.3) * Math.cos(vz * 2.7);
      pos.setXYZ(i, vx * n, vy * (n * 0.88), vz * n);
    }
    geo.computeVertexNormals();
    return geo;
  }

  public addSculptedStreetLamp(x: number, baseY: number, z: number): void {
    const lamp = new THREE.Group();
    lamp.position.set(x, baseY, z);

    const plinth = new THREE.Mesh(this.lampPlinthGeo, this.mats.sandstone);
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const post = new THREE.Mesh(this.lampPostGeo, this.mats.iron);
    post.castShadow = true;

    const core = new THREE.Mesh(this.lampCoreGeo, this.mats.manaLamp);
    core.position.y = 3.78;

    const cap = new THREE.Mesh(this.lampFinialGeo, this.mats.copper);
    cap.position.y = 4.10;
    cap.castShadow = true;

    lamp.add(plinth, post, core, cap);

    // 4 slim iron lantern corner ribs
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const rib = new THREE.Mesh(this.lampBracketGeo, this.mats.iron);
      rib.position.set(Math.cos(ang) * 0.18, 3.78, Math.sin(ang) * 0.18);
      lamp.add(rib);
    }

    this.group.add(lamp);
    this.boxColliders.push({
      minX: x - 0.28,
      maxX: x + 0.28,
      minY: baseY,
      maxY: baseY + 4.1,
      minZ: z - 0.28,
      maxZ: z + 0.28,
    });
  }

  public addSculptedBarrel(x: number, baseY: number, z: number): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const body = new THREE.Mesh(this.barrelBodyGeo, this.mats.timber);
    body.castShadow = true;
    body.receiveShadow = true;

    const lid = new THREE.Mesh(this.barrelLidGeo, this.mats.darkTimber);
    lid.position.y = 0.87;

    g.add(body, lid);

    for (const [hy, hs] of [
      [0.14, 0.94],
      [0.46, 1.05],
      [0.78, 0.94],
    ]) {
      const hoop = new THREE.Mesh(this.barrelHoopGeo, this.mats.iron);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      hoop.scale.set(hs, hs, 1);
      g.add(hoop);
    }

    this.group.add(g);
    this.raycastTargets.push(body);
    this.boxColliders.push({
      minX: x - 0.39,
      maxX: x + 0.39,
      minY: baseY,
      maxY: baseY + 0.92,
      minZ: z - 0.39,
      maxZ: z + 0.39,
    });
  }

  public addSculptedCrate(x: number, baseY: number, z: number, s = 0.85, rotY = 0): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.rotation.y = rotY;
    g.scale.setScalar(s);

    const core = new THREE.Mesh(this.crateCoreGeo, this.mats.timber);
    core.position.y = 0.5;
    core.castShadow = true;
    core.receiveShadow = true;

    const topStile = new THREE.Mesh(this.crateStileGeo, this.mats.darkTimber);
    topStile.position.y = 0.945;
    const botStile = new THREE.Mesh(this.crateStileGeo, this.mats.darkTimber);
    botStile.position.y = 0.055;

    const braceF = new THREE.Mesh(this.crateBraceGeo, this.mats.darkTimber);
    braceF.position.set(0, 0.5, 0);
    braceF.rotation.z = 0.78;
    braceF.scale.set(0.85, 0.9, 1.0);

    g.add(core, topStile, botStile, braceF);
    this.group.add(g);
    this.raycastTargets.push(core);

    const half = s * 0.5;
    this.boxColliders.push({
      minX: x - half,
      maxX: x + half,
      minY: baseY,
      maxY: baseY + s,
      minZ: z - half,
      maxZ: z + half,
    });
  }

  public addSculptedTreePlanter(x: number, baseY: number, z: number, scale = 1.0): void {
    const tree = new THREE.Group();
    tree.position.set(x, baseY, z);

    const planter = new THREE.Mesh(this.planterRingGeo, this.mats.sandstone);
    planter.position.y = 0.26;
    planter.castShadow = true;
    planter.receiveShadow = true;

    const soil = new THREE.Mesh(this.planterSoilGeo, this.mats.darkTimber);
    soil.position.y = 0.27;

    const trunk = new THREE.Mesh(this.trunkGeo, this.mats.darkTimber);
    trunk.position.y = 0.45 + 1.15 * scale;
    trunk.scale.setScalar(scale);
    trunk.castShadow = true;

    const b1 = new THREE.Mesh(this.branchGeo, this.mats.darkTimber);
    b1.position.set(0.38 * scale, 2.35 * scale, 0.2 * scale);
    b1.rotation.z = -0.62;
    b1.scale.setScalar(scale);

    const b2 = new THREE.Mesh(this.branchGeo, this.mats.darkTimber);
    b2.position.set(-0.35 * scale, 2.45 * scale, -0.22 * scale);
    b2.rotation.z = 0.58;
    b2.scale.setScalar(scale);

    const c1 = new THREE.Mesh(this.canopyMainGeo, this.mats.foliage);
    c1.position.set(0, 2.95 * scale, 0);
    c1.scale.setScalar(scale);
    c1.castShadow = true;

    const c2 = new THREE.Mesh(this.canopySideGeo, this.mats.foliageLight);
    c2.position.set(0.75 * scale, 3.25 * scale, 0.35 * scale);
    c2.scale.setScalar(scale);
    c2.castShadow = true;

    const c3 = new THREE.Mesh(this.canopySideGeo, this.mats.foliage);
    c3.position.set(-0.68 * scale, 3.4 * scale, -0.32 * scale);
    c3.scale.setScalar(scale * 0.92);
    c3.castShadow = true;

    tree.add(planter, soil, trunk, b1, b2, c1, c2, c3);
    this.group.add(tree);

    this.boxColliders.push({
      minX: x - 0.96,
      maxX: x + 0.96,
      minY: baseY,
      maxY: baseY + 2.8,
      minZ: z - 0.96,
      maxZ: z + 0.96,
    });
  }

  public addSculptedBench(x: number, baseY: number, z: number, rotY = 0): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.rotation.y = rotY;

    for (const lz of [-0.72, 0.72]) {
      const leg = new THREE.Mesh(this.benchLegGeo, this.mats.iron);
      leg.position.set(0, 0.22, lz);
      leg.castShadow = true;
      g.add(leg);
    }

    for (const sx of [-0.17, 0.0, 0.17]) {
      const slat = new THREE.Mesh(this.benchSlatGeo, this.mats.timber);
      slat.position.set(sx, 0.46, 0);
      slat.castShadow = true;
      slat.receiveShadow = true;
      g.add(slat);
    }

    for (const by of [0.64, 0.80]) {
      const back = new THREE.Mesh(this.benchSlatGeo, this.mats.timber);
      back.position.set(-0.24, by, 0);
      back.rotation.z = Math.PI / 2 - 0.14;
      back.castShadow = true;
      g.add(back);
    }

    this.group.add(g);
    const halfX = Math.abs(Math.cos(rotY)) * 0.34 + Math.abs(Math.sin(rotY)) * 0.95;
    const halfZ = Math.abs(Math.sin(rotY)) * 0.34 + Math.abs(Math.cos(rotY)) * 0.95;
    this.boxColliders.push({
      minX: x - halfX,
      maxX: x + halfX,
      minY: baseY,
      maxY: baseY + 0.9,
      minZ: z - halfZ,
      maxZ: z + halfZ,
    });
  }

  public addSpokedWheel(parent: THREE.Object3D, x: number, y: number, z: number, scale = 1.0): void {
    const w = new THREE.Group();
    w.position.set(x, y, z);
    w.scale.setScalar(scale);

    const rim = new THREE.Mesh(this.wheelRimGeo, this.mats.darkTimber);
    rim.castShadow = true;
    const hub = new THREE.Mesh(this.wheelHubGeo, this.mats.iron);
    hub.rotation.x = Math.PI / 2;
    w.add(rim, hub);

    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(this.wheelSpokeGeo, this.mats.timber);
      spoke.rotation.z = (i * Math.PI) / 4;
      w.add(spoke);
    }
    parent.add(w);
  }

  public addMerchantCart(x: number, baseY: number, z: number, rotY = 0): void {
    const cart = new THREE.Group();
    cart.position.set(x, baseY, z);
    cart.rotation.y = rotY;

    const bedGeo = new THREE.BoxGeometry(2.5, 0.18, 1.35);
    const sideGeo = new THREE.BoxGeometry(2.5, 0.55, 0.08);
    const frontGeo = new THREE.BoxGeometry(0.08, 0.55, 1.35);
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.045, 1.45, 6);
    const sackGeo = new THREE.DodecahedronGeometry(0.32, 1);
    this.disposables.push(bedGeo, sideGeo, frontGeo, shaftGeo, sackGeo);

    const bed = new THREE.Mesh(bedGeo, this.mats.timber);
    bed.position.y = 0.52;
    bed.castShadow = true;
    bed.receiveShadow = true;

    const sideL = new THREE.Mesh(sideGeo, this.mats.darkTimber);
    sideL.position.set(0, 0.85, 0.64);
    const sideR = new THREE.Mesh(sideGeo, this.mats.darkTimber);
    sideR.position.set(0, 0.85, -0.64);
    const back = new THREE.Mesh(frontGeo, this.mats.darkTimber);
    back.position.set(-1.21, 0.85, 0);

    for (const sz of [-0.46, 0.46]) {
      const shaft = new THREE.Mesh(shaftGeo, this.mats.darkTimber);
      shaft.rotation.z = Math.PI / 2 - 0.12;
      shaft.position.set(1.85, 0.45, sz);
      cart.add(shaft);
    }

    for (const [sx, sy, sz] of [
      [-0.55, 0.82, -0.22],
      [-0.50, 0.82, 0.25],
      [0.15, 0.82, 0.05],
      [-0.20, 1.12, -0.05],
    ]) {
      const sack = new THREE.Mesh(sackGeo, this.mats.parchment);
      sack.scale.set(1.1, 0.72, 0.9);
      sack.position.set(sx, sy, sz);
      sack.castShadow = true;
      cart.add(sack);
    }

    cart.add(bed, sideL, sideR, back);

    this.addSpokedWheel(cart, -0.82, 0.46, 0.74, 0.98);
    this.addSpokedWheel(cart, -0.82, 0.46, -0.74, 0.98);
    this.addSpokedWheel(cart, 0.82, 0.39, 0.74, 0.82);
    this.addSpokedWheel(cart, 0.82, 0.39, -0.74, 0.82);

    this.group.add(cart);
    const hx = Math.abs(Math.cos(rotY)) * 1.45 + Math.abs(Math.sin(rotY)) * 0.85;
    const hz = Math.abs(Math.sin(rotY)) * 1.45 + Math.abs(Math.cos(rotY)) * 0.85;
    this.boxColliders.push({
      minX: x - hx,
      maxX: x + hx,
      minY: baseY,
      maxY: baseY + 1.35,
      minZ: z - hz,
      maxZ: z + hz,
    });
  }

  public addMarketStall(
    x: number,
    baseY: number,
    z: number,
    rotY: number,
    canopyVariant: 'red' | 'green' | 'blue'
  ): void {
    const stall = new THREE.Group();
    stall.position.set(x, baseY, z);
    stall.rotation.y = rotY;

    const counterGeo = new THREE.BoxGeometry(3.1, 0.92, 1.05);
    const lipGeo = new THREE.BoxGeometry(3.26, 0.1, 1.18);
    const postGeo = new THREE.CylinderGeometry(0.065, 0.075, 2.75, 7);
    const beamGeo = new THREE.BoxGeometry(3.35, 0.12, 0.12);
    const canopyGeo = new THREE.BoxGeometry(3.48, 0.08, 2.35);
    const lanternGeo = new THREE.OctahedronGeometry(0.14, 0);
    this.disposables.push(counterGeo, lipGeo, postGeo, beamGeo, canopyGeo, lanternGeo);

    const counter = new THREE.Mesh(counterGeo, this.mats.timber);
    counter.position.set(0, 0.46, 0.15);
    counter.castShadow = true;
    counter.receiveShadow = true;

    const lip = new THREE.Mesh(lipGeo, this.mats.darkTimber);
    lip.position.set(0, 0.95, 0.15);

    stall.add(counter, lip);

    for (const [px, pz, ph] of [
      [-1.48, -0.75, 2.85],
      [1.48, -0.75, 2.85],
      [-1.48, 0.72, 2.45],
      [1.48, 0.72, 2.45],
    ]) {
      const post = new THREE.Mesh(postGeo, this.mats.darkTimber);
      post.position.set(px, ph * 0.5, pz);
      post.scale.y = ph / 2.75;
      post.castShadow = true;
      stall.add(post);
    }

    const frontBeam = new THREE.Mesh(beamGeo, this.mats.darkTimber);
    frontBeam.position.set(0, 2.42, 0.72);
    const backBeam = new THREE.Mesh(beamGeo, this.mats.darkTimber);
    backBeam.position.set(0, 2.82, -0.75);

    const canopyMat =
      canopyVariant === 'red'
        ? this.mats.awningRed
        : canopyVariant === 'green'
        ? this.mats.awningGreen
        : this.mats.awningBlue;
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 2.66, 0.05);
    canopy.rotation.x = 0.27;
    canopy.castShadow = true;

    const lantern = new THREE.Mesh(lanternGeo, this.mats.warmLantern);
    lantern.position.set(1.15, 2.15, 0.74);

    // Wares on counter (bolted fabric / parchment / brass jars)
    const wareA = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.34, 8), this.mats.copper);
    wareA.position.set(-0.75, 1.17, 0.12);
    const wareB = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.34), this.mats.parchment);
    wareB.position.set(0.35, 1.11, 0.18);
    this.disposables.push(wareA.geometry, wareB.geometry);

    stall.add(frontBeam, backBeam, canopy, lantern, wareA, wareB);
    this.group.add(stall);
    this.raycastTargets.push(counter);

    const hx = Math.abs(Math.cos(rotY)) * 1.65 + Math.abs(Math.sin(rotY)) * 0.88;
    const hz = Math.abs(Math.sin(rotY)) * 1.65 + Math.abs(Math.cos(rotY)) * 0.88;
    this.boxColliders.push({
      minX: x - hx,
      maxX: x + hx,
      minY: baseY,
      maxY: baseY + 2.6,
      minZ: z - hz,
      maxZ: z + hz,
    });
  }

  public addAstrolabeMonument(x: number, baseY: number, z: number): void {
    const mon = new THREE.Group();
    mon.position.set(x, baseY, z);

    const step1 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.34, 8), this.mats.limestone);
    step1.position.y = 0.17;
    step1.receiveShadow = true;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 1.55, 8), this.mats.limestone);
    ped.position.y = 1.1;
    ped.castShadow = true;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.92, 0.24, 12), this.mats.copper);
    collar.position.y = 1.95;

    const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 10, 28), this.mats.copper);
    ringOuter.position.y = 3.55;
    ringOuter.castShadow = true;

    const ringMid = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.065, 8, 24), this.mats.copper);
    ringMid.position.y = 3.55;
    ringMid.rotation.set(0.55, 0.4, 0.2);

    const ringInner = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 8, 20), this.mats.iron);
    ringInner.position.y = 3.55;
    ringInner.rotation.set(-0.45, 0.9, 0.35);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.mats.manaLamp);
    core.position.y = 3.55;

    this.disposables.push(
      step1.geometry,
      ped.geometry,
      collar.geometry,
      ringOuter.geometry,
      ringMid.geometry,
      ringInner.geometry,
      core.geometry
    );

    mon.add(step1, ped, collar, ringOuter, ringMid, ringInner, core);
    this.group.add(mon);
    this.raycastTargets.push(ped);
    this.boxColliders.push({
      minX: x - 2.4,
      maxX: x + 2.4,
      minY: baseY,
      maxY: baseY + 4.8,
      minZ: z - 2.4,
      maxZ: z + 2.4,
    });
  }

  public addChimneyStack(x: number, baseY: number, z: number): void {
    const stackGeo = new THREE.BoxGeometry(0.88, 2.35, 0.88);
    const capGeo = new THREE.BoxGeometry(1.06, 0.2, 1.06);
    const potGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.48, 8);
    this.disposables.push(stackGeo, capGeo, potGeo);

    const stack = new THREE.Mesh(stackGeo, this.mats.brick);
    stack.position.set(x, baseY + 1.175, z);
    stack.castShadow = true;
    const cap = new THREE.Mesh(capGeo, this.mats.sandstone);
    cap.position.set(x, baseY + 2.42, z);
    const potA = new THREE.Mesh(potGeo, this.mats.sandstone);
    potA.position.set(x - 0.18, baseY + 2.7, z);
    const potB = new THREE.Mesh(potGeo, this.mats.sandstone);
    potB.position.set(x + 0.18, baseY + 2.7, z);

    this.group.add(stack, cap, potA, potB);
  }

  public addGabledRoofWithRidge(
    cx: number,
    baseY: number,
    cz: number,
    widthX: number,
    heightY: number,
    lengthZ: number,
    rotate90 = false
  ): void {
    const shape = new THREE.Shape();
    shape.moveTo(-widthX * 0.5, 0);
    shape.lineTo(widthX * 0.5, 0);
    shape.lineTo(0, heightY);
    shape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: lengthZ, bevelEnabled: false });
    roofGeo.translate(0, 0, -lengthZ * 0.5);
    if (rotate90) roofGeo.rotateY(Math.PI / 2);

    const ridgeGeo = new THREE.CylinderGeometry(0.14, 0.14, lengthZ + 0.25, 6);
    ridgeGeo.rotateX(Math.PI / 2);
    if (rotate90) ridgeGeo.rotateY(Math.PI / 2);

    const corniceGeo = new THREE.BoxGeometry(
      rotate90 ? lengthZ + 0.25 : widthX + 0.2,
      0.16,
      rotate90 ? widthX + 0.2 : lengthZ + 0.25
    );
    this.disposables.push(roofGeo, ridgeGeo, corniceGeo);

    const mesh = new THREE.Mesh(roofGeo, this.mats.slateRoof);
    mesh.position.set(cx, baseY, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const ridge = new THREE.Mesh(ridgeGeo, this.mats.copper);
    ridge.position.set(cx, baseY + heightY, cz);

    const cornice = new THREE.Mesh(corniceGeo, this.mats.sandstone);
    cornice.position.set(cx, baseY - 0.04, cz);
    cornice.castShadow = true;

    this.group.add(cornice, mesh, ridge);
  }

  public addSculptedWindow(
    x: number,
    y: number,
    z: number,
    facing: '+x' | '-x' | '+z' | '-z',
    w = 1.25,
    h = 1.45,
    withShutters = true
  ): void {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, y, z);
    if (facing === '+x') winGroup.rotation.y = Math.PI / 2;
    else if (facing === '-x') winGroup.rotation.y = -Math.PI / 2;
    else if (facing === '-z') winGroup.rotation.y = Math.PI;

    const frameGeo = new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.14);
    const paneGeo = new THREE.BoxGeometry(w, h, 0.06);
    const mullionVGeo = new THREE.BoxGeometry(0.065, h, 0.11);
    const mullionHGeo = new THREE.BoxGeometry(w, 0.065, 0.11);
    const sillGeo = new THREE.BoxGeometry(w + 0.34, 0.12, 0.24);
    const lintelGeo = new THREE.BoxGeometry(w + 0.3, 0.16, 0.20);
    this.disposables.push(frameGeo, paneGeo, mullionVGeo, mullionHGeo, sillGeo, lintelGeo);

    const frame = new THREE.Mesh(frameGeo, this.mats.darkTimber);
    const pane = new THREE.Mesh(paneGeo, this.mats.glass);
    pane.position.z = 0.02;
    const mV = new THREE.Mesh(mullionVGeo, this.mats.darkTimber);
    mV.position.z = 0.05;
    const mH = new THREE.Mesh(mullionHGeo, this.mats.darkTimber);
    mH.position.z = 0.05;
    const sill = new THREE.Mesh(sillGeo, this.mats.sandstone);
    sill.position.set(0, -h * 0.5 - 0.08, 0.06);
    const lintel = new THREE.Mesh(lintelGeo, this.mats.sandstone);
    lintel.position.set(0, h * 0.5 + 0.1, 0.04);

    winGroup.add(frame, pane, mV, mH, sill, lintel);

    if (withShutters) {
      const shutterGeo = new THREE.BoxGeometry(w * 0.34, h, 0.07);
      this.disposables.push(shutterGeo);
      const sL = new THREE.Mesh(shutterGeo, this.mats.darkTimber);
      sL.position.set(-w * 0.5 - w * 0.24, 0, 0.03);
      const sR = new THREE.Mesh(shutterGeo, this.mats.darkTimber);
      sR.position.set(w * 0.5 + w * 0.24, 0, 0.03);
      winGroup.add(sL, sR);
    }

    this.group.add(winGroup);
  }

  public addFlowerBox(
    x: number,
    y: number,
    z: number,
    facing: '+x' | '-x' | '+z' | '-z',
    variant: 'red' | 'gold' | 'violet' = 'red'
  ): void {
    const fb = new THREE.Group();
    fb.position.set(x, y, z);
    if (facing === '+x') fb.rotation.y = Math.PI / 2;
    else if (facing === '-x') fb.rotation.y = -Math.PI / 2;
    else if (facing === '-z') fb.rotation.y = Math.PI;

    const box = new THREE.Mesh(this.flowerBoxGeo, this.mats.darkTimber);
    box.castShadow = true;
    fb.add(box);

    const flowerMat =
      variant === 'red'
        ? this.mats.flowerRed
        : variant === 'gold'
        ? this.mats.flowerGold
        : this.mats.flowerViolet;

    for (let i = -2; i <= 2; i++) {
      const leaf = new THREE.Mesh(this.flowerTuftGeo, this.mats.foliageLight);
      leaf.position.set(i * 0.21, 0.16, 0);
      leaf.scale.set(1.15, 0.78, 1.15);
      fb.add(leaf);

      if (i % 2 === 0 || i === -1) {
        const bloom = new THREE.Mesh(this.flowerTuftGeo, flowerMat);
        bloom.position.set(i * 0.21 + 0.04, 0.24, 0.03);
        bloom.scale.setScalar(0.66);
        fb.add(bloom);
      }
    }
    this.group.add(fb);
  }

  public addHangingBunting(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.5) return;

    const line = new THREE.Group();
    const midX = (x1 + x2) * 0.5;
    const midY = (y1 + y2) * 0.5;
    const midZ = (z1 + z2) * 0.5;

    const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, len, 5);
    this.disposables.push(ropeGeo);
    const rope = new THREE.Mesh(ropeGeo, this.mats.darkTimber);
    rope.position.set(midX, midY, midZ);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    line.add(rope);

    const palette = [
      this.mats.awningRed,
      this.mats.bannerTeal,
      this.mats.bannerOchre,
      this.mats.awningBlue,
    ];
    const count = Math.max(4, Math.floor(len / 0.95));
    const yaw = Math.atan2(dz, dx);
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const sag = Math.sin(t * Math.PI) * Math.min(0.85, len * 0.055);
      const px = x1 + dx * t;
      const py = y1 + dy * t - sag - 0.19;
      const pz = z1 + dz * t;
      const flag = new THREE.Mesh(this.pennantGeo, palette[i % palette.length]);
      flag.position.set(px, py, pz);
      flag.rotation.set(Math.PI, -yaw, 0);
      line.add(flag);
    }

    this.group.add(line);
  }

  public addPottedShrub(x: number, baseY: number, z: number, withFlowers = true): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);

    const urn = new THREE.Mesh(this.urnGeo, this.mats.sandstone);
    urn.castShadow = true;
    urn.receiveShadow = true;

    const bush = new THREE.Mesh(this.shrubGeo, this.mats.foliage);
    bush.position.y = 0.82;
    bush.castShadow = true;

    const topBush = new THREE.Mesh(this.shrubGeo, this.mats.foliageLight);
    topBush.position.set(0.06, 1.16, -0.04);
    topBush.scale.setScalar(0.68);
    topBush.castShadow = true;

    g.add(urn, bush, topBush);

    if (withFlowers) {
      for (const [fx, fy, fz, fMat] of [
        [0.24, 0.92, 0.22, this.mats.flowerRed],
        [-0.22, 0.88, 0.24, this.mats.flowerGold],
        [0.05, 1.18, 0.26, this.mats.flowerViolet],
      ] as Array<[number, number, number, THREE.Material]>) {
        const bl = new THREE.Mesh(this.flowerTuftGeo, fMat);
        bl.position.set(fx, fy, fz);
        bl.scale.setScalar(0.55);
        g.add(bl);
      }
    }

    this.group.add(g);
    this.boxColliders.push({
      minX: x - 0.42,
      maxX: x + 0.42,
      minY: baseY,
      maxY: baseY + 1.35,
      minZ: z - 0.42,
      maxZ: z + 0.42,
    });
  }

  public addCargoPallet(x: number, baseY: number, z: number, rotY = 0): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.rotation.y = rotY;

    const pallet = new THREE.Mesh(this.palletGeo, this.mats.darkTimber);
    pallet.position.y = 0.07;
    pallet.castShadow = true;
    pallet.receiveShadow = true;
    g.add(pallet);

    const c1 = new THREE.Mesh(this.crateCoreGeo, this.mats.timber);
    c1.scale.setScalar(0.75);
    c1.position.set(-0.38, 0.14 + 0.34, -0.14);
    c1.castShadow = true;

    const c2 = new THREE.Mesh(this.crateCoreGeo, this.mats.timber);
    c2.scale.setScalar(0.64);
    c2.position.set(0.42, 0.14 + 0.29, 0.16);
    c2.rotation.y = 0.2;
    c2.castShadow = true;

    const cTop = new THREE.Mesh(this.crateCoreGeo, this.mats.awningBlue);
    cTop.scale.setScalar(0.54);
    cTop.position.set(-0.32, 0.14 + 0.68 + 0.25, -0.1);
    cTop.rotation.y = -0.15;
    cTop.castShadow = true;

    g.add(c1, c2, cTop);
    this.group.add(g);
    this.raycastTargets.push(c1, c2);

    const hx = Math.abs(Math.cos(rotY)) * 0.92 + Math.abs(Math.sin(rotY)) * 0.72;
    const hz = Math.abs(Math.sin(rotY)) * 0.92 + Math.abs(Math.cos(rotY)) * 0.72;
    this.boxColliders.push({
      minX: x - hx,
      maxX: x + hx,
      minY: baseY,
      maxY: baseY + 1.35,
      minZ: z - hz,
      maxZ: z + hz,
    });
  }

  public addGoodsDisplay(x: number, baseY: number, z: number, rotY = 0): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.rotation.y = rotY;

    const tableGeo = new THREE.BoxGeometry(1.75, 0.12, 0.85);
    const legGeo = new THREE.BoxGeometry(0.1, 0.78, 0.1);
    this.disposables.push(tableGeo, legGeo);

    const top = new THREE.Mesh(tableGeo, this.mats.timber);
    top.position.y = 0.8;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    for (const [lx, lz] of [
      [-0.76, -0.32],
      [0.76, -0.32],
      [-0.76, 0.32],
      [0.76, 0.32],
    ]) {
      const leg = new THREE.Mesh(legGeo, this.mats.darkTimber);
      leg.position.set(lx, 0.39, lz);
      g.add(leg);
    }

    const fabrics = [this.mats.awningRed, this.mats.bannerTeal, this.mats.bannerOchre];
    fabrics.forEach((fMat, i) => {
      const bolt = new THREE.Mesh(this.clothBoltGeo, fMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(-0.5 + i * 0.34, 0.98, 0);
      bolt.castShadow = true;
      g.add(bolt);
    });

    const jug = new THREE.Mesh(this.urnGeo, this.mats.copper);
    jug.scale.setScalar(0.55);
    jug.position.set(0.58, 0.86, 0);
    g.add(jug);

    this.group.add(g);
    const hx = Math.abs(Math.cos(rotY)) * 0.92 + Math.abs(Math.sin(rotY)) * 0.48;
    const hz = Math.abs(Math.sin(rotY)) * 0.92 + Math.abs(Math.cos(rotY)) * 0.48;
    this.boxColliders.push({
      minX: x - hx,
      maxX: x + hx,
      minY: baseY,
      maxY: baseY + 1.2,
      minZ: z - hz,
      maxZ: z + hz,
    });
  }

  public addManaPylon(x: number, baseY: number, z: number): void {
    const p = new THREE.Group();
    p.position.set(x, baseY, z);

    const baseGeo = new THREE.CylinderGeometry(0.65, 0.82, 0.55, 8);
    const shaftGeo = new THREE.CylinderGeometry(0.32, 0.48, 2.35, 8);
    const crownGeo = new THREE.CylinderGeometry(0.56, 0.35, 0.38, 8);
    const ringGeo = new THREE.TorusGeometry(0.55, 0.045, 7, 18);
    const crystalGeo = new THREE.OctahedronGeometry(0.32, 0);
    this.disposables.push(baseGeo, shaftGeo, crownGeo, ringGeo, crystalGeo);

    const base = new THREE.Mesh(baseGeo, this.mats.limestone);
    base.position.y = 0.275;
    base.castShadow = true;
    base.receiveShadow = true;

    const shaft = new THREE.Mesh(shaftGeo, this.mats.sandstone);
    shaft.position.y = 1.7;
    shaft.castShadow = true;

    const crown = new THREE.Mesh(crownGeo, this.mats.copper);
    crown.position.y = 3.05;

    const ring = new THREE.Mesh(ringGeo, this.mats.copper);
    ring.position.y = 3.72;
    ring.rotation.x = 0.4;

    const crystal = new THREE.Mesh(crystalGeo, this.mats.manaLamp);
    crystal.position.y = 3.72;

    p.add(base, shaft, crown, ring, crystal);
    this.group.add(p);
    this.raycastTargets.push(base, shaft);

    this.boxColliders.push({
      minX: x - 0.78,
      maxX: x + 0.78,
      minY: baseY,
      maxY: baseY + 4.1,
      minZ: z - 0.78,
      maxZ: z + 0.78,
    });
  }

  public addAnchorMonument(x: number, baseY: number, z: number, rotY = 0): void {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.rotation.y = rotY;

    const plinthGeo = new THREE.CylinderGeometry(0.85, 0.98, 0.42, 8);
    const shankGeo = new THREE.CylinderGeometry(0.11, 0.14, 1.9, 8);
    const stockGeo = new THREE.BoxGeometry(1.15, 0.14, 0.14);
    const flukeGeo = new THREE.TorusGeometry(0.62, 0.1, 7, 12, Math.PI);
    const ropeCoilGeo = new THREE.TorusGeometry(0.34, 0.08, 7, 14);
    this.disposables.push(plinthGeo, shankGeo, stockGeo, flukeGeo, ropeCoilGeo);

    const plinth = new THREE.Mesh(plinthGeo, this.mats.sandstone);
    plinth.position.y = 0.21;
    plinth.castShadow = true;

    const shank = new THREE.Mesh(shankGeo, this.mats.iron);
    shank.position.set(0, 1.25, 0);
    shank.rotation.z = 0.25;
    shank.castShadow = true;

    const stock = new THREE.Mesh(stockGeo, this.mats.copper);
    stock.position.set(-0.18, 2.0, 0);
    stock.rotation.z = 0.25;

    const fluke = new THREE.Mesh(flukeGeo, this.mats.iron);
    fluke.position.set(0.15, 0.92, 0);
    fluke.rotation.z = Math.PI + 0.25;

    const ropeCoil = new THREE.Mesh(ropeCoilGeo, this.mats.parchment);
    ropeCoil.rotation.x = Math.PI / 2;
    ropeCoil.position.set(-0.42, 0.48, 0.35);

    g.add(plinth, shank, stock, fluke, ropeCoil);
    this.group.add(g);

    this.boxColliders.push({
      minX: x - 0.95,
      maxX: x + 0.95,
      minY: baseY,
      maxY: baseY + 2.3,
      minZ: z - 0.95,
      maxZ: z + 0.95,
    });
  }
}
