import * as THREE from 'three';
import type {
  BoxCollider,
  CombatDummySpec,
  InteractableSpec,
  NpcSpawnSpec,
  RampCollider,
} from '../core/types';
import type { PickablePropSpec } from './PickableProps';

export interface MetropolisMaterials {
  road: THREE.Material;
  crossRoad: THREE.Material;
  pavement: THREE.Material;
  plaza: THREE.Material;
  marbleInlay: THREE.Material;
  sandstone: THREE.Material;
  limestone: THREE.Material;
  brick: THREE.Material;
  darkBrick: THREE.Material;
  timber: THREE.Material;
  darkTimber: THREE.Material;
  plaster: THREE.Material;
  warmPlaster: THREE.Material;
  terracottaPlaster: THREE.Material;
  sagePlaster: THREE.Material;
  ochrePlaster: THREE.Material;
  slateRoof: THREE.Material;
  iron: THREE.Material;
  copper: THREE.Material;
  glass: THREE.Material;
  manaLamp: THREE.Material;
  warmLantern: THREE.Material;
  furnaceGlow: THREE.Material;
  water: THREE.Material;
  foliage: THREE.Material;
  foliageLight: THREE.Material;
  awningRed: THREE.Material;
  awningGreen: THREE.Material;
  awningBlue: THREE.Material;
}

export interface MetropolisExpansionOutput {
  group: THREE.Group;
  npcSpawns: NpcSpawnSpec[];
  interactables: InteractableSpec[];
  pickableSpecs: PickablePropSpec[];
  combatDummies: CombatDummySpec[];
  unlockGate: (gateId: string) => boolean;
  isGateOpen: (gateId: string) => boolean;
  update: (dt: number) => void;
}

interface CanalBarge {
  mesh: THREE.Group;
  speed: number;
  direction: 1 | -1;
  minX: number;
  maxX: number;
  phase: number;
}

/**
 * Elarion Outer Metropolis Expansion (~590m x 425m Continuous Playable Coastal City)
 * Built strictly around the canonical Vaelcrest Domain & Elarion specification:
 * 1. Grand Canal Shipping Locks (Z = 120..154) & 3 Walkable Stone Arch Bridges + Mana Freight Barges
 * 2. Temple Quarter (NW outer: X = -256..-136, Z = -44..+14) — Gabled Stone Cathedral, Copper Bell-Steeple, Sacred Basin
 * 3. Industrial Quarter & Mana Works (X = -288..-132, Z = +14.5..+120) — Hyperbolic Condensers, Rolling Mill, Rail Freight Yard
 * 4. Merchant Quarter & Residential Neighbourhoods (Z = 166..336) — Open Grand Exchange Square & Compass Fountain,
 *    Reserve Bank Clocktower, Guild Halls, Stone-and-Timber Townhouse Wards, Civic Schools & Domain Overland Gate
 * 5. Administrative & Noble Heights + Coastal Bastion (X = 135.5..305, Z = -48..+315) — Three Councils Assembly Palace,
 *    Defensive Barrier Pylons, Mana-Railgun Bastion Emplacements & Knight Sparring Courtyard
 */
export function buildElarionMetropolisExpansion(
  boxColliders: BoxCollider[],
  rampColliders: RampCollider[],
  raycastTargets: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
  mats: MetropolisMaterials
): MetropolisExpansionOutput {
  const group = new THREE.Group();
  group.name = 'Elarion_Metropolis_Expansion';

  const npcSpawns: NpcSpawnSpec[] = [];
  const interactables: InteractableSpec[] = [];
  const pickableSpecs: PickablePropSpec[] = [];
  const combatDummies: CombatDummySpec[] = [];
  const barges: CanalBarge[] = [];

  const addBox = (
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    options?: { collide?: boolean; cameraBlock?: boolean; castShadow?: boolean }
  ): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(w, h, d);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, baseY + h * 0.5, cz);
    mesh.castShadow = options?.castShadow ?? false;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (options?.collide !== false) {
      boxColliders.push({
        minX: cx - w * 0.5,
        maxX: cx + w * 0.5,
        minY: baseY,
        maxY: baseY + h,
        minZ: cz - d * 0.5,
        maxZ: cz + d * 0.5,
      });
    }
    if (options?.cameraBlock !== false) {
      raycastTargets.push(mesh);
    }
    return mesh;
  };

  const addRamp = (
    cx: number,
    cz: number,
    w: number,
    len: number,
    axis: '+x' | '-x' | '+z' | '-z',
    yStart: number,
    yEnd: number,
    steps: number,
    material: THREE.Material
  ) => {
    const horiz = axis === '+x' || axis === '-x';
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const stepTop = THREE.MathUtils.lerp(yStart, yEnd, t);
      if (horiz) {
        const sx = cx - len * 0.5 + t * len;
        addBox(sx, -1.2, cz, len / steps + 0.06, stepTop + 1.2, w, material, { collide: false });
      } else {
        const sz = cz - len * 0.5 + t * len;
        addBox(cx, -1.2, sz, w, stepTop + 1.2, len / steps + 0.06, material, { collide: false });
      }
    }
    rampColliders.push({
      minX: cx - (horiz ? len : w) * 0.5,
      maxX: cx + (horiz ? len : w) * 0.5,
      minZ: cz - (horiz ? w : len) * 0.5,
      maxZ: cz + (horiz ? w : len) * 0.5,
      axis,
      yStart,
      yEnd,
    });
  };

  const addLamp = (x: number, y: number, z: number) => {
    addBox(x, y, z, 0.24, 3.6, 0.24, mats.iron);
    addBox(x, y + 3.6, z, 0.42, 0.52, 0.42, mats.warmLantern, { collide: false });
    addBox(x, y + 4.12, z, 0.56, 0.14, 0.56, mats.copper, { collide: false });
  };

  const addTree = (x: number, y: number, z: number, scale = 1.0) => {
    addBox(x, y, z, 1.5 * scale, 0.42, 1.5 * scale, mats.sandstone);
    const trunkGeo = new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.8 * scale, 7);
    const crownGeo = new THREE.DodecahedronGeometry(1.45 * scale, 1);
    disposables.push(trunkGeo, crownGeo);
    const trunk = new THREE.Mesh(trunkGeo, mats.darkTimber);
    trunk.position.set(x, y + 0.42 + 1.4 * scale, z);
    const crown = new THREE.Mesh(crownGeo, mats.foliage);
    crown.position.set(x, y + 0.42 + 3.2 * scale, z);
    group.add(trunk, crown);
  };

  const addMarketStall = (x: number, y: number, z: number, yaw: number, matAwn: THREE.Material) => {
    const stall = new THREE.Group();
    stall.position.set(x, y, z);
    stall.rotation.y = yaw;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.4), mats.timber);
    deck.position.set(0, 0.45, 0);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 1.9), matAwn);
    canopy.position.set(0, 2.45, 0);
    canopy.rotation.x = 0.18;
    disposables.push(deck.geometry, canopy.geometry);
    stall.add(deck, canopy);
    for (const px of [-1.15, 1.15]) {
      for (const pz of [-0.6, 0.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), mats.darkTimber);
        post.position.set(px, 1.2, pz);
        disposables.push(post.geometry);
        stall.add(post);
      }
    }
    group.add(stall);
    boxColliders.push({
      minX: x - 1.35,
      maxX: x + 1.35,
      minY: y,
      maxY: y + 2.5,
      minZ: z - 1.0,
      maxZ: z + 1.0,
    });
  };

  // =========================================================================
  // 1. GRAND CANAL SHIPPING LOCKS (Z = 120..154, X = -290..+305) & 3 BRIDGES
  // =========================================================================
  {
    const canalGeo = new THREE.PlaneGeometry(620, 34);
    disposables.push(canalGeo);
    const canalWater = new THREE.Mesh(canalGeo, mats.water);
    canalWater.rotation.x = -Math.PI / 2;
    canalWater.position.set(8, -1.55, 137);
    group.add(canalWater);

    // North Canal Embankments
    addBox(-218, -2.0, 120.2, 144, 3.0, 1.6, mats.sandstone);
    addBox(-74, -2.0, 120.2, 134, 3.0, 1.6, mats.sandstone);
    addBox(53.5, -2.0, 120.2, 93, 3.0, 1.6, mats.sandstone);
    addBox(208.5, -2.0, 120.2, 193, 3.0, 1.6, mats.sandstone);

    // South Canal Promenade (Z = 154..166, X = -288..+305, y = 0.16)
    addBox(8.5, -1.0, 160.0, 593.0, 1.16, 12.0, mats.pavement);
    addBox(-221, 0.16, 154.3, 138, 1.05, 0.8, mats.sandstone);
    addBox(-74, 0.16, 154.3, 132, 1.05, 0.8, mats.sandstone);
    addBox(54, 0.16, 154.3, 92, 1.05, 0.8, mats.sandstone);
    addBox(208.5, 0.16, 154.3, 193, 1.05, 0.8, mats.sandstone);

    for (let lx = -260; lx <= 280; lx += 36) {
      addLamp(lx, 0.16, 156.2);
    }

    const buildCanalBridge = (cx: number, width: number) => {
      addRamp(cx, 126.5, width, 13.0, '+z', 0.16, 2.60, 16, mats.road);
      addBox(cx, -1.8, 137.0, width, 4.4, 8.0, mats.sandstone);
      addBox(cx, 2.52, 137.0, width - 0.8, 0.08, 8.0, mats.road, { collide: false });
      addRamp(cx, 147.5, width, 13.0, '-z', 0.16, 2.60, 16, mats.road);

      for (const side of [-1, 1]) {
        const px = cx + side * (width * 0.5 + 0.35);
        addBox(px, 0.16, 137.0, 0.7, 3.45, 34.0, mats.sandstone);
        for (const pz of [121.0, 133.0, 141.0, 153.0]) {
          addBox(px, 3.6, pz, 0.9, 0.5, 0.9, mats.copper, { collide: false });
          addBox(px, 4.1, pz, 0.4, 0.5, 0.4, mats.manaLamp, { collide: false });
        }
      }
      addBox(cx, -0.4, 119.8, width, 0.56, 1.4, mats.pavement);
    };

    buildCanalBridge(0, 13.2);
    buildCanalBridge(-146, 11.2);
    buildCanalBridge(106, 11.2);

    // Connector Road North from East Canal Bridge (X = 100..112, Z = 58..120, y = 0.16)
    addBox(106, -0.4, 89.0, 14.0, 0.56, 62.0, mats.pavement);
    addBox(106, -0.4, 89.0, 9.0, 0.58, 62.0, mats.road, { collide: false });

    const buildBarge = (startX: number, dir: 1 | -1, speed: number, zOff: number, phase: number) => {
      const barge = new THREE.Group();
      barge.position.set(startX, -1.45, 137 + zOff);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(15.0, 1.6, 4.6), mats.darkTimber);
      hull.position.y = 0.6;
      const cargoA = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.4, 3.2), mats.awningBlue);
      cargoA.position.set(-2.5, 2.0, 0);
      const cargoB = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.3, 3.0), mats.copper);
      cargoB.position.set(2.4, 1.9, 0);
      const manaCore = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 8), mats.manaLamp);
      manaCore.rotation.z = Math.PI / 2;
      manaCore.position.set(-dir * 5.8, 1.85, 0);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.45), mats.warmLantern);
      lamp.position.set(dir * 6.8, 2.2, 0);
      disposables.push(hull.geometry, cargoA.geometry, cargoB.geometry, manaCore.geometry, lamp.geometry);
      barge.add(hull, cargoA, cargoB, manaCore, lamp);
      group.add(barge);
      barges.push({ mesh: barge, speed, direction: dir, minX: -260, maxX: 270, phase });
    };
    buildBarge(-85, 1, 3.2, -5.5, 0);
    buildBarge(62, -1, 2.7, 5.5, 1.8);
    buildBarge(-210, 1, 2.9, -4.5, 3.1);
  }

  // =========================================================================
  // 2. INDUSTRIAL QUARTER & MANA WORKS (X = -288..-132, Z = +14..+120)
  // =========================================================================
  {
    addBox(-210.0, -0.4, 67.0, 156.0, 0.56, 106.0, mats.pavement);
    addBox(-209.0, -0.39, 18.5, 154.0, 0.56, 7.0, mats.crossRoad, { collide: false });
    addBox(-146.0, -0.39, 71.0, 10.0, 0.56, 98.0, mats.road, { collide: false });

    // Western City Boundary Industrial Wall (X = -288)
    addBox(-288.0, 0.16, 40.0, 2.2, 7.5, 160.0, mats.darkBrick);

    // Twin Mana Refinement Condenser Towers (X = -255, Z = 54 & 88)
    const towerProfile = [
      new THREE.Vector2(9.2, 0),
      new THREE.Vector2(6.8, 12),
      new THREE.Vector2(5.4, 24),
      new THREE.Vector2(6.4, 34),
      new THREE.Vector2(5.2, 34),
      new THREE.Vector2(0.1, 24),
    ];
    const coolGeo = new THREE.LatheGeometry(towerProfile, 20);
    const coilGeo = new THREE.CylinderGeometry(6.2, 6.2, 0.75, 20);
    disposables.push(coolGeo, coilGeo);

    for (const tz of [54.0, 88.0]) {
      const tower = new THREE.Mesh(coolGeo, mats.sandstone);
      tower.position.set(-255.0, 0.16, tz);
      const coil = new THREE.Mesh(coilGeo, mats.manaLamp);
      coil.position.set(-255.0, 20.0, tz);
      group.add(tower, coil);
      boxColliders.push({
        minX: -264.0,
        maxX: -246.0,
        minY: 0.16,
        maxY: 34.5,
        minZ: tz - 9.0,
        maxZ: tz + 9.0,
      });
    }

    // Mechanical Rolling Mill & Munitions Foundry (X = -226..-176, Z = 36..72)
    addBox(-201.0, 0.16, 54.0, 48.0, 14.0, 34.0, mats.darkBrick);
    addBox(-201.0, 14.16, 54.0, 50.0, 2.4, 36.0, mats.slateRoof);
    addBox(-201.0, 16.56, 54.0, 16.0, 3.2, 26.0, mats.iron);
    addBox(-176.6, 2.0, 54.0, 0.5, 5.2, 12.0, mats.furnaceGlow, { collide: false });

    // Mana-Powered Freight Rail Depot & Distribution Shed (X = -222..-166, Z = 86..108)
    addBox(-194.0, 0.16, 97.0, 54.0, 10.5, 20.0, mats.brick);
    addBox(-194.0, 10.66, 97.0, 56.0, 2.2, 21.5, mats.slateRoof);
    for (const wx of [-175, -195, -215]) {
      addBox(wx, 0.16, 113.5, 12.0, 3.2, 3.0, mats.copper);
      addBox(wx, 3.36, 113.5, 12.4, 0.4, 3.2, mats.slateRoof, { collide: false });
      addBox(wx, 1.4, 113.5, 1.2, 0.6, 3.2, mats.manaLamp, { collide: false });
    }

    // Guild Artisan Workshops & Worker Housing (X = -168..-155, Z = 30..108)
    for (const bz of [38, 64, 90]) {
      addBox(-162.0, 0.16, bz, 12.0, 8.2, 18.0, mats.brick);
      addBox(-162.0, 8.36, bz, 12.8, 1.8, 18.8, mats.slateRoof);
      addLamp(-153.5, 0.16, bz);
    }
  }

  // =========================================================================
  // 3. TEMPLE QUARTER (NW Outer: X = -256..-136, Z = -44..+14)
  // Stone Nave Cathedral, Twin Bell-Spires, Carved Colonnades & Sacred Basin
  // =========================================================================
  {
    addBox(-194.0, -0.4, -13.75, 116.0, 0.56, 56.5, mats.plaza);
    addBox(-158.0, -0.39, 3.5, 12.0, 0.56, 23.0, mats.marbleInlay, { collide: false });

    // Elevated Marble Sanctuary Forecourt (X = -242..-166, Z = -36..-4, y = 1.60)
    addBox(-204.0, -0.4, -20.0, 76.0, 2.0, 32.0, mats.marbleInlay);
    addRamp(-204.0, -1.0, 16.0, 6.0, '-z', 0.16, 1.60, 8, mats.limestone);

    // Grand Gabled Stone Sanctuary Nave & Pitched Slate Roof (X = -228, Z = -20, base y = 1.60)
    addBox(-228.0, 1.60, -20.0, 20.0, 11.5, 24.0, mats.limestone);
    addBox(-228.0, 13.10, -20.0, 21.4, 1.4, 25.4, mats.slateRoof);
    const naveGableGeo = new THREE.ConeGeometry(13.5, 6.2, 4);
    const bellSteepleGeo = new THREE.ConeGeometry(2.4, 9.5, 4);
    const lanternCapGeo = new THREE.BoxGeometry(1.1, 2.2, 1.1);
    disposables.push(naveGableGeo, bellSteepleGeo, lanternCapGeo);

    const naveRoof = new THREE.Mesh(naveGableGeo, mats.slateRoof);
    naveRoof.position.set(-228.0, 17.5, -20.0);
    naveRoof.rotation.y = Math.PI / 4;
    group.add(naveRoof);

    // Squared European-style Timber & Stone Bell-Tower at Cathedral Front (-216, -20)
    addBox(-216.0, 1.60, -20.0, 5.4, 18.0, 5.4, mats.sandstone);
    const steeple = new THREE.Mesh(bellSteepleGeo, mats.copper);
    steeple.position.set(-216.0, 24.3, -20.0);
    steeple.rotation.y = Math.PI / 4;
    const bellLantern = new THREE.Mesh(lanternCapGeo, mats.manaLamp);
    bellLantern.position.set(-216.0, 17.5, -20.0);
    group.add(steeple, bellLantern);

    // Sacred Reflection Basin (center X = -194, Z = -20, y = 1.60)
    addBox(-194.0, 1.60, -20.0, 16.0, 0.65, 12.0, mats.limestone);
    addBox(-194.0, 1.98, -20.0, 14.2, 0.28, 10.2, mats.water, { collide: false });

    // Flanking Stone Colonnade Cloisters & Sanctuary Trees
    for (const pz of [-32.5, -7.5]) {
      addBox(-204.0, 1.60, pz, 56.0, 0.45, 5.2, mats.limestone);
      for (let px = -224; px <= -184; px += 8) {
        addBox(px, 2.05, pz, 0.9, 4.6, 0.9, mats.sandstone);
      }
      addBox(-204.0, 6.65, pz, 56.8, 0.95, 5.8, mats.slateRoof);
    }
    addTree(-174.0, 1.60, -28.0, 1.2);
    addTree(-174.0, 1.60, -12.0, 1.2);
    addLamp(-194.0, 1.60, -11.5);
    addLamp(-194.0, 1.60, -28.5);
  }

  // =========================================================================
  // 4. MERCHANT QUARTER & RESIDENTIAL NEIGHBOURHOODS (Z = 166..336)
  // Open Grand Exchange Square, Maritime Clocktower Exchange, Banking Row & Rowhouses
  // =========================================================================
  {
    addBox(0, -0.4, 250.0, 380.0, 0.56, 172.0, mats.plaza);
    addBox(0, -0.39, 251.0, 16.0, 0.56, 170.0, mats.road, { collide: false });
    addBox(0, -0.39, 212.0, 360.0, 0.56, 16.0, mats.crossRoad, { collide: false });

    // ----- OPEN GRAND EXCHANGE SQUARE & MARITIME COMPASS FOUNTAIN (0, 0.16, 212) -----
    // Unobstructed open cobblestone civic square with a low tiered fountain & copper compass monument
    const cx = 0;
    const cz = 212;
    addBox(cx, 0.16, cz, 44.0, 0.08, 44.0, mats.marbleInlay, { collide: false });
    const fountainBaseGeo = new THREE.CylinderGeometry(3.4, 3.8, 0.65, 8);
    const fountainWaterGeo = new THREE.CylinderGeometry(2.9, 2.9, 0.16, 8);
    const compassPillarGeo = new THREE.BoxGeometry(1.1, 3.4, 1.1);
    const compassFinialGeo = new THREE.ConeGeometry(0.95, 2.1, 4);
    disposables.push(fountainBaseGeo, fountainWaterGeo, compassPillarGeo, compassFinialGeo);

    const fountainBase = new THREE.Mesh(fountainBaseGeo, mats.limestone);
    fountainBase.position.set(cx, 0.52, cz);
    const fountainWater = new THREE.Mesh(fountainWaterGeo, mats.water);
    fountainWater.position.set(cx, 0.78, cz);
    const compassPillar = new THREE.Mesh(compassPillarGeo, mats.sandstone);
    compassPillar.position.set(cx, 2.45, cz);
    const compassFinial = new THREE.Mesh(compassFinialGeo, mats.copper);
    compassFinial.position.set(cx, 5.2, cz);
    compassFinial.rotation.y = Math.PI / 4;
    group.add(fountainBase, fountainWater, compassPillar, compassFinial);
    addBox(cx, 4.15, cz, 1.35, 0.55, 1.35, mats.manaLamp, { collide: false });
    boxColliders.push({
      minX: cx - 3.6,
      maxX: cx + 3.6,
      minY: 0.16,
      maxY: 6.4,
      minZ: cz - 3.6,
      maxZ: cz + 3.6,
    });

    // Trees & Lamps framing the 4 corners of the open Exchange Square
    for (const sx of [-16.5, 16.5]) {
      for (const sz of [-16.5, 16.5]) {
        addTree(cx + sx, 0.16, cz + sz, 1.1);
        addLamp(cx + sx * 0.72, 0.16, cz + sz * 0.72);
      }
    }

    // Maritime Brick-and-Slate Clocktower attached to Vaelcrest Reserve Bank (39, 0.16, 241)
    addBox(39.0, 0.16, 241.0, 6.2, 22.0, 6.2, mats.brick);
    addBox(39.0, 17.5, 241.0, 6.6, 2.4, 6.6, mats.warmLantern, { collide: false });
    const spireRoofGeo = new THREE.ConeGeometry(4.8, 7.6, 4);
    disposables.push(spireRoofGeo);
    const clockSteeple = new THREE.Mesh(spireRoofGeo, mats.slateRoof);
    clockSteeple.position.set(39.0, 27.4, 241.0);
    clockSteeple.rotation.y = Math.PI / 4;
    group.add(clockSteeple);
    addBox(39.0, 31.2, 241.0, 0.45, 2.2, 0.45, mats.copper, { collide: false });

    // Merchant Quarter Stalls & Shipping Brokerage Kiosks
    const stallMats = [mats.awningRed, mats.awningGreen, mats.awningBlue];
    for (let i = 0; i < 4; i++) {
      const zS = 178 + i * 22;
      if (Math.abs(zS - cz) > 14) {
        addMarketStall(-14.5, 0.16, zS, Math.PI / 2, stallMats[i % 3]);
        addMarketStall(14.5, 0.16, zS, -Math.PI / 2, stallMats[(i + 1) % 3]);
      }
    }
    for (let i = 0; i < 4; i++) {
      const xS = -78 + i * 52;
      if (Math.abs(xS) > 20) {
        addMarketStall(xS, 0.16, 198.0, 0, stallMats[i % 3]);
        addMarketStall(xS, 0.16, 226.0, Math.PI, stallMats[(i + 2) % 3]);
      }
    }

    // Merchant Quarter Banking Houses & Stone/Timber Residential Neighbourhood Blocks
    const wardPalette = [mats.brick, mats.warmPlaster, mats.sandstone, mats.terracottaPlaster, mats.sagePlaster];
    const outerWardBlocks: Array<[number, number, number, number, number]> = [
      // West Residential Neighbourhoods & Public Schoolhouse
      [-58, 184, 34, 9.5, 20],
      [-104, 184, 38, 10.5, 22],
      [-150, 184, 34, 9.0, 20],
      [-56, 254, 38, 11.2, 26], // Elarion Civic Polytechnic & Guild School
      [-108, 254, 42, 9.8, 28],
      [-158, 254, 36, 10.6, 26],
      [-60, 298, 40, 9.2, 24],
      [-114, 298, 42, 9.8, 24],
      // East Merchant Quarter, Clearing House & Reserve Bank
      [58, 184, 34, 10.2, 20],
      [104, 184, 38, 9.4, 22],
      [150, 184, 34, 11.2, 20],
      [56, 254, 38, 13.0, 26], // Vaelcrest Reserve Bank & Commercial Exchange
      [108, 254, 42, 10.0, 28],
      [158, 254, 36, 10.8, 26],
      [60, 298, 40, 10.0, 24],
      [114, 298, 42, 9.0, 24],
    ];
    outerWardBlocks.forEach(([bx, bz, bw, bh, bd], i) => {
      addBox(bx, 0.16, bz, bw, bh, bd, wardPalette[i % wardPalette.length]);
      addBox(bx, 0.16 + bh, bz, bw + 1.0, 1.6, bd + 1.0, mats.slateRoof);
      addBox(bx, 0.16, bz, bw + 0.3, 2.8, bd + 0.3, mats.sandstone, { collide: false });
      addLamp(bx - bw * 0.45, 0.16, bz > 212 ? bz - bd * 0.5 - 2.0 : bz + bd * 0.5 + 2.0);
    });

    // Infill Corner Townhouses & Streetfront Shops lining Merchant & Residential Avenues
    const infillSpecs: Array<[number, number, number, number, number, THREE.Material]> = [
      [-32, 178, 16, 7.8, 12, mats.warmPlaster],
      [32, 178, 16, 8.2, 12, mats.terracottaPlaster],
      [-32, 242, 16, 8.6, 14, mats.brick],
      [32, 272, 16, 9.0, 14, mats.sandstone],
      [-32, 286, 16, 7.6, 14, mats.sagePlaster],
      [-84, 212, 14, 7.4, 12, mats.brick],
      [84, 212, 14, 7.8, 12, mats.warmPlaster],
      [-132, 212, 14, 8.0, 12, mats.terracottaPlaster],
      [132, 212, 14, 8.4, 12, mats.sagePlaster],
      [-36, 316, 20, 7.5, 14, mats.brick],
      [36, 316, 20, 7.8, 14, mats.ochrePlaster],
      [-84, 316, 22, 8.2, 14, mats.warmPlaster],
      [84, 316, 22, 8.0, 14, mats.sandstone],
    ];
    for (const [ix, iz, iw, ih, id, mat] of infillSpecs) {
      addBox(ix, 0.16, iz, iw, ih, id, mat);
      addBox(ix, 0.16 + ih, iz, iw + 0.8, 1.3, id + 0.8, mats.slateRoof);
      addLamp(ix, 0.16, iz > 212 ? iz - id * 0.5 - 1.5 : iz + id * 0.5 + 1.5);
    }

    // Extra festive street stalls & pergolas along Exchange Cross Boulevard
    for (let sx = -110; sx <= 110; sx += 44) {
      if (Math.abs(sx) > 22) {
        addMarketStall(sx, 0.16, 204.5, 0, stallMats[Math.abs(sx) % 3]);
      }
    }

    // Domain Overland Bastion Gate & Defensive City Ramparts (Z = 332, X = -288..+308)
    addBox(-152.0, 0.16, 334.0, 274.0, 11.0, 5.0, mats.sandstone);
    addBox(160.0, 0.16, 334.0, 296.0, 11.0, 5.0, mats.sandstone);
    addBox(-17.0, 0.16, 333.0, 9.0, 20.0, 9.0, mats.limestone);
    addBox(17.0, 0.16, 333.0, 9.0, 20.0, 9.0, mats.limestone);
    addBox(0, 8.8, 333.0, 26.0, 5.2, 6.0, mats.sandstone);
    addBox(-17.0, 20.16, 333.0, 9.6, 1.8, 9.6, mats.copper);
    addBox(17.0, 20.16, 333.0, 9.6, 1.8, 9.6, mats.copper);
    // Mana Barrier Pylons flanking Overland Gate
    addBox(-23.0, 0.16, 327.0, 1.6, 6.2, 1.6, mats.iron);
    addBox(-23.0, 6.36, 327.0, 1.1, 1.8, 1.1, mats.manaLamp, { collide: false });
    addBox(23.0, 0.16, 327.0, 1.6, 6.2, 1.6, mats.iron);
    addBox(23.0, 6.36, 327.0, 1.1, 1.8, 1.1, mats.manaLamp, { collide: false });

    for (const tz of [175, 245, 285, 315]) {
      addTree(-19.0, 0.16, tz, 1.15);
      addTree(19.0, 0.16, tz, 1.15);
    }
  }

  // =========================================================================
  // 5. ADMINISTRATIVE & NOBLE HEIGHTS + VAELCREST DEFENCE CITADEL
  // Three-Council Assembly Hall, Coastal Railgun Bastions & Knight Training Yard
  // =========================================================================
  {
    addBox(220.25, -0.4, 24.0, 169.5, 5.6, 128.0, mats.marbleInlay);
    addBox(182.0, 5.14, 18.5, 92.0, 0.08, 9.0, mats.road, { collide: false });

    // Three-Council Assembly Palace (Council of Law, Council of Authority, Council of Elders)
    // Classical coastal-European tiered mansard slate roof & octagonal copper cupola
    addBox(258.0, 5.20, 19.0, 58.0, 16.5, 60.0, mats.limestone);
    addBox(258.0, 21.70, 19.0, 60.0, 1.4, 62.0, mats.sandstone);
    addBox(258.0, 23.10, 19.0, 48.0, 4.8, 50.0, mats.slateRoof);
    const palaceCupolaGeo = new THREE.CylinderGeometry(7.2, 8.4, 5.2, 8);
    const palaceHipRoofGeo = new THREE.ConeGeometry(8.6, 6.2, 8);
    const palaceFinialGeo = new THREE.CylinderGeometry(0.25, 0.75, 4.2, 8);
    disposables.push(palaceCupolaGeo, palaceHipRoofGeo, palaceFinialGeo);
    const pCupola = new THREE.Mesh(palaceCupolaGeo, mats.sandstone);
    pCupola.position.set(258.0, 30.5, 19.0);
    const pHipRoof = new THREE.Mesh(palaceHipRoofGeo, mats.copper);
    pHipRoof.position.set(258.0, 36.2, 19.0);
    const pFinial = new THREE.Mesh(palaceFinialGeo, mats.manaLamp);
    pFinial.position.set(258.0, 41.2, 19.0);
    group.add(pCupola, pHipRoof, pFinial);

    for (let pz = -4; pz <= 42; pz += 7.5) {
      addBox(224.0, 5.20, pz, 1.2, 11.0, 1.2, mats.sandstone);
    }
    addBox(224.0, 16.20, 19.0, 3.0, 1.8, 50.0, mats.limestone);

    // Reflecting Pool & Noble Gardens
    addBox(190.0, 5.20, -11.0, 32.0, 0.55, 16.0, mats.limestone);
    addBox(190.0, 5.52, -11.0, 30.0, 0.25, 14.0, mats.water, { collide: false });
    addTree(166.0, 5.20, -24.0, 1.25);
    addTree(214.0, 5.20, -24.0, 1.25);
    addTree(166.0, 5.20, 4.0, 1.25);
    addTree(214.0, 5.20, 4.0, 1.25);

    // Citadel Armory & Twin Mana-Railgun Coastal Defence Emplacements (X = 152..210, Z = 36..80)
    addBox(181.0, 5.20, 74.0, 42.0, 8.2, 14.0, mats.sandstone);
    addBox(181.0, 13.40, 74.0, 43.2, 2.0, 14.8, mats.slateRoof);

    const railBarrelGeo = new THREE.CylinderGeometry(0.32, 0.45, 7.2, 10);
    disposables.push(railBarrelGeo);
    for (const bx of [154.0, 206.0]) {
      addBox(bx, 5.20, -32.0, 5.6, 2.4, 5.6, mats.iron);
      const barrel = new THREE.Mesh(railBarrelGeo, mats.copper);
      barrel.rotation.x = -Math.PI / 2 + 0.28;
      barrel.position.set(bx, 8.6, -34.0);
      const coil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.4), mats.manaLamp);
      coil.position.set(bx, 8.2, -32.5);
      disposables.push(coil.geometry);
      group.add(barrel, coil);
    }

    // Grand Citadel Steps descending South (y = 5.20 -> 0.16) at X = 148..164, Z = 88..112
    addRamp(156.0, 100.0, 16.0, 24.0, '-z', 0.16, 5.20, 20, mats.limestone);
    addBox(208.5, -0.4, 104.0, 193.0, 0.56, 32.0, mats.pavement);

    addBox(307.0, 0.16, 140.0, 3.0, 14.0, 380.0, mats.sandstone);
    addBox(220.0, 5.20, -40.5, 174.0, 1.4, 1.2, mats.sandstone);

    // East Residential Estates & Civic Gardens (X = 185..302, Z = 166..328)
    addBox(243.5, -0.4, 247.0, 117.0, 0.56, 162.0, mats.pavement);
    for (const [ex, ez, col] of [
      [212, 196, mats.warmPlaster],
      [264, 196, mats.sagePlaster],
      [212, 248, mats.terracottaPlaster],
      [264, 248, mats.brick],
      [212, 298, mats.sandstone],
      [264, 298, mats.warmPlaster],
    ] as Array<[number, number, THREE.Material]>) {
      addBox(ex, 0.16, ez, 32.0, 9.2, 24.0, col);
      addBox(ex, 9.36, ez, 33.2, 2.0, 25.2, mats.slateRoof);
      addTree(ex - 20.0, 0.16, ez, 1.2);
    }
  }

  // =========================================================================
  // 6. METROPOLIS CITIZENS (34 Articulated NPCs Reflecting Vaelcrest Lore)
  // =========================================================================
  npcSpawns.push(
    {
      id: 'npc_canal_bridge_guard',
      role: 'City Guard',
      behavior: 'idle',
      actionKind: 'watch',
      position: [-4.5, 2.6, 137.0],
      facingYaw: 0.4,
      tunicColor: 0x2f3b49,
      accentColor: 0x9aa4b0,
      randomDialogues: [
        ['Central Grand Arch keeps external-mana barges gliding into Elarion’s Merchant Quarter.'],
        ['Eight centuries of Vaelcrest engineering hold these locks level in every tide.'],
      ],
    },
    {
      id: 'npc_canal_stroller',
      role: 'Resident',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-20.0, 0.16, 159.0],
      facingYaw: 1.57,
      tunicColor: 0x6b4f3a,
      accentColor: 0xc27f4e,
      moveSpeed: 1.5,
      waypoints: [[-20, 0.16, 159], [28, 0.16, 159], [28, 0.16, 162], [-20, 0.16, 162]],
    },
    {
      id: 'npc_east_bridge_clerk',
      role: 'Customs Clerk',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [106.0, 2.6, 137.0],
      facingYaw: -1.57,
      tunicColor: 0x2f4b44,
      accentColor: 0xd6963a,
    },
    {
      id: 'npc_temple_warden',
      role: 'Scholar',
      behavior: 'interact',
      actionKind: 'announce',
      position: [-204.0, 1.60, -10.0],
      facingYaw: 0.0,
      tunicColor: 0xe6dac4,
      accentColor: 0xd6963a,
      randomDialogues: [
        ['Welcome to Elarion’s Temple Quarter. Artisans, mariners, and scholars keep vigil beside the Sanctuary Basin.'],
        ['Our stone nave has stood beside Vaelcrest Harbour for centuries through storm and prosperity alike.'],
      ],
    },
    {
      id: 'npc_temple_seeker_a',
      role: 'Resident',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-184.0, 1.60, -14.0],
      facingYaw: 3.14,
      tunicColor: 0xb8763e,
      accentColor: 0xf0d290,
      moveSpeed: 1.35,
      waypoints: [[-184, 1.6, -14], [-184, 1.6, -27], [-212, 1.6, -27], [-212, 1.6, -14]],
    },
    {
      id: 'npc_temple_sweeper',
      role: 'Harbour Worker',
      behavior: 'work',
      actionKind: 'sweep',
      position: [-170.0, 0.16, -8.0],
      facingYaw: -0.6,
      tunicColor: 0x565c66,
      accentColor: 0xc27f4e,
    },
    {
      id: 'npc_outer_foundry_chief',
      role: 'Engineer',
      behavior: 'interact',
      actionKind: 'clipboard',
      position: [-168.0, 0.16, 54.0],
      facingYaw: 1.57,
      tunicColor: 0x3b3530,
      accentColor: 0x6ecad9,
      randomDialogues: [
        ['Those condenser towers cool external-mana turbines driving our mechanical mills and munitions lines.'],
        ['Raw ore arrives by mana-powered railway from the mining territories inland.'],
      ],
    },
    {
      id: 'npc_outer_foundry_smith',
      role: 'Engineer',
      behavior: 'work',
      actionKind: 'forge',
      position: [-174.0, 0.16, 62.0],
      facingYaw: 0.4,
      tunicColor: 0x45352d,
      accentColor: 0xd98245,
    },
    {
      id: 'npc_outer_foundry_porter',
      role: 'Dock Porter',
      behavior: 'patrol',
      actionKind: 'haul',
      position: [-146.0, 0.16, 48.0],
      facingYaw: 0.0,
      tunicColor: 0x52453b,
      accentColor: 0x8d6e53,
      moveSpeed: 1.45,
      waypoints: [[-146, 0.16, 48], [-146, 0.16, 94], [-146, 0.16, 48]],
    },
    {
      id: 'npc_exchange_herald',
      role: 'Merchant',
      behavior: 'interact',
      actionKind: 'announce',
      position: [-5.0, 0.16, 206.0],
      facingYaw: 0.8,
      tunicColor: 0x8f3830,
      accentColor: 0xf0be6c,
      randomDialogues: [
        ['Across Grand Exchange Square stand the Vaelcrest Reserve Bank, its Maritime Clocktower, and overseas brokerage houses!'],
        ['West lies the Civic Polytechnic where any diligent citizen may master engineering or governance.'],
      ],
    },
    {
      id: 'npc_merchant_financier',
      role: 'Merchant',
      behavior: 'work',
      actionKind: 'browse',
      position: [-12.5, 0.16, 178.0],
      facingYaw: 1.57,
      tunicColor: 0x2f6b56,
      accentColor: 0xe6b45a,
    },
    {
      id: 'npc_merchant_broker',
      role: 'Merchant',
      behavior: 'work',
      actionKind: 'converse',
      position: [12.5, 0.16, 200.0],
      facingYaw: -1.57,
      tunicColor: 0x3b5878,
      accentColor: 0xd4a44e,
    },
    {
      id: 'npc_exchange_patrol_a',
      role: 'City Guard',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-26.0, 0.16, 200.0],
      facingYaw: 1.57,
      tunicColor: 0x2a3542,
      accentColor: 0xb67a4e,
      moveSpeed: 1.65,
      waypoints: [[-26, 0.16, 200], [26, 0.16, 200], [26, 0.16, 224], [-26, 0.16, 224]],
    },
    {
      id: 'npc_exchange_walker_b',
      role: 'Resident',
      behavior: 'patrol',
      actionKind: 'browse',
      position: [4.5, 0.16, 190.0],
      facingYaw: 0.0,
      tunicColor: 0x735940,
      accentColor: 0x4cb0bf,
      moveSpeed: 1.4,
      waypoints: [[4.5, 0.16, 190], [4.5, 0.16, 275], [-4.5, 0.16, 275], [-4.5, 0.16, 190]],
    },
    {
      id: 'npc_southgate_captain',
      role: 'Heavy Infantry',
      heavyArmor: true,
      behavior: 'interact',
      actionKind: 'watch',
      position: [4.2, 0.16, 325.5],
      facingYaw: Math.PI,
      tunicColor: 0x24303c,
      accentColor: 0xd4a44e,
      initialDialogueNodeId: 'gate_halt',
      dialogueTree: [
        {
          id: 'gate_halt',
          npcReaction: 'salute',
          lines: [
            'Halt, citizen! Captain Vane of the Vaelcrest Heavy Infantry holds the Overland Bastion Gate.',
            'Beyond these oak doors lie the green forests and wild meadows of the Vaelcrest Domain—home to wandering deer, wolves, and mana-evolved beasts.',
          ],
          choices: [
            {
              label: 'Request clearance to open the Bastion Gate',
              nextNodeId: 'gate_grant',
              npcReaction: 'nod',
            },
            {
              label: 'Ask about the evolved beasts outside Elarion',
              nextNodeId: 'wilds_report',
              npcReaction: 'point',
            },
            {
              label: 'Stay within city walls for now',
              closeDialogue: true,
              npcReaction: 'salute',
            },
          ],
        },
        {
          id: 'wilds_report',
          npcReaction: 'point',
          lines: [
            'Scouts report peaceful woodland stags, boars, and coastal hawks alongside mana-adapted Dire Boars, Raptor-Drakes, and Colossus Stags.',
            'They remain calm in their glades, though Vault-ready logs and winding dirt trails await any explorer.',
          ],
          choices: [
            {
              label: 'Open the Bastion Gate — I am ready to explore',
              nextNodeId: 'gate_opened',
              npcReaction: 'salute',
              playerEmote: 'salute',
              unlockGateId: 'south_bastion_gate',
            },
            {
              label: 'Return to the Merchant Quarter',
              closeDialogue: true,
              npcReaction: 'nod',
            },
          ],
        },
        {
          id: 'gate_grant',
          npcReaction: 'salute',
          lines: [
            'You carry yourself well and bear Vaelcrest steel. Before we unbar the Overland Gate, declare which Charter shall regulate the Emerald Wilds ley-conduits:',
          ],
          choices: [
            {
              label: 'Pledge to Mana-Works Guild (Overclock Conduit Charter +25 Rep)',
              nextNodeId: 'gate_opened',
              npcReaction: 'salute',
              playerEmote: 'salute',
              unlockGateId: 'south_bastion_gate',
              questBranch: {
                questId: 'q_gate_conduit',
                stageIndex: 2,
                label: 'Aligned with Mana-Works Guild',
                faction: 'manaworks',
                repDelta: 25,
              },
            },
            {
              label: 'Pledge to Aetheric Purists (Preserve Wild Ley-Shrines +25 Rep)',
              nextNodeId: 'gate_opened',
              npcReaction: 'bow',
              playerEmote: 'salute',
              unlockGateId: 'south_bastion_gate',
              questBranch: {
                questId: 'q_gate_conduit',
                stageIndex: 2,
                label: 'Aligned with Aetheric Purists',
                faction: 'purists',
                repDelta: 25,
              },
            },
            {
              label: 'Pledge to House Vaelcrest Crown Guard (+25 Rep)',
              nextNodeId: 'gate_opened',
              npcReaction: 'salute',
              playerEmote: 'salute',
              unlockGateId: 'south_bastion_gate',
              questBranch: {
                questId: 'q_gate_conduit',
                stageIndex: 2,
                label: 'Sworn to House Vaelcrest',
                faction: 'vaelcrest',
                repDelta: 25,
              },
            },
          ],
        },
        {
          id: 'gate_opened',
          npcReaction: 'wave',
          lines: [
            'The Bastion Gate is unlocked and swinging wide! Follow the southern dirt road out into the Vaelcrest wilds.',
          ],
          choices: [
            {
              label: 'Step out into the Vaelcrest Domain',
              closeDialogue: true,
              npcReaction: 'salute',
            },
          ],
        },
      ],
    },
    {
      id: 'npc_southgate_warden',
      role: 'Heavy Infantry',
      heavyArmor: true,
      behavior: 'idle',
      actionKind: 'watch',
      position: [-9.5, 0.16, 327.0],
      facingYaw: 0.25,
      tunicColor: 0x24303c,
      accentColor: 0xc27f4e,
      randomDialogues: [
        ['Speak with Captain Vane at the eastern pillar whenever you need the Bastion Gate unbarred.'],
        ['Our tower shields and mana-halberds keep the wild forest edge secure around the clock.'],
      ],
    },
    {
      id: 'npc_southgate_sentry_east',
      role: 'Heavy Infantry',
      heavyArmor: true,
      behavior: 'idle',
      actionKind: 'watch',
      position: [9.5, 0.16, 327.0],
      facingYaw: -0.25,
      tunicColor: 0x24303c,
      accentColor: 0xc27f4e,
    },
    {
      id: 'npc_council_administrator',
      role: 'Harbourmaster',
      behavior: 'interact',
      actionKind: 'clipboard',
      position: [220.0, 5.20, 18.5],
      facingYaw: -1.57,
      tunicColor: 0x23384d,
      accentColor: 0xe6b85c,
      randomDialogues: [
        ['Here convene the Council of Law, the Council of Authority, and every quarter the Council of Elders.'],
        ['House Vaelcrest holds sovereignty, yet capable commoners rise here to become mayors, commanders, and senior ministers.'],
      ],
    },
    {
      id: 'npc_citadel_knight_a',
      role: 'Heavy Infantry',
      heavyArmor: true,
      behavior: 'idle',
      actionKind: 'watch',
      position: [216.0, 5.20, 8.0],
      facingYaw: -1.57,
      tunicColor: 0x26323e,
      accentColor: 0xd4a44e,
    },
    {
      id: 'npc_citadel_knight_b',
      role: 'Heavy Infantry',
      heavyArmor: true,
      behavior: 'idle',
      actionKind: 'watch',
      position: [216.0, 5.20, 29.0],
      facingYaw: -1.57,
      tunicColor: 0x26323e,
      accentColor: 0xd4a44e,
    },
    {
      id: 'npc_palace_gardener',
      role: 'Resident',
      behavior: 'work',
      actionKind: 'sweep',
      position: [186.0, 5.20, 0.0],
      facingYaw: 0.9,
      tunicColor: 0x4d6b47,
      accentColor: 0xc27f4e,
    },
    {
      id: 'npc_east_garden_scholar',
      role: 'Scholar',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [176.0, 0.16, 182.0],
      facingYaw: 1.0,
      tunicColor: 0x2b4052,
      accentColor: 0x6ecad9,
      moveSpeed: 1.4,
      waypoints: [[176, 0.16, 182], [236, 0.16, 182], [236, 0.16, 224], [176, 0.16, 224]],
    },
    {
      id: 'npc_east_estate_merchant',
      role: 'Merchant',
      behavior: 'interact',
      actionKind: 'converse',
      position: [232.0, 0.16, 222.0],
      facingYaw: -0.8,
      tunicColor: 0x6e3a48,
      accentColor: 0xd6963a,
    }
  );

  const extraAmbientCoords: Array<[number, number, number, NpcSpawnSpec['role'], NpcSpawnSpec['actionKind'], number, number]> = [
    [-38, 0.16, 212, 'Resident', 'converse', 0x5c6870, 0xc27f4e],
    [38, 0.16, 212, 'Merchant', 'browse', 0x87453a, 0xe6b85c],
    [-68, 0.16, 206, 'Resident', 'idle', 0x4f614d, 0xd6963a],
    [68, 0.16, 218, 'Scholar', 'clipboard', 0x2d4254, 0x9fbcd1],
    [-118, 0.16, 206, 'Dock Porter', 'haul', 0x594a3c, 0xa8825d],
    [118, 0.16, 218, 'City Guard', 'watch', 0x2e3945, 0x9aa4b0],
    [-190, 0.16, 18.5, 'Engineer', 'clipboard', 0x423a34, 0x6ecad9],
    [-232, 0.16, 18.5, 'Engineer', 'forge', 0x3b2f2a, 0xd98245],
    [-154, 0.16, -24, 'Resident', 'converse', 0xc98a4a, 0xf2dfc0],
    [-212, 1.60, -20, 'Scholar', 'idle', 0xe0d6c2, 0xb67a4e],
    [152, 5.20, 18.5, 'City Guard', 'watch', 0x2f3b49, 0xd4a44e],
    [186, 5.20, 56.0, 'City Guard', 'watch', 0x2f3b49, 0xc27f4e],
    [144, 0.16, 159.0, 'Resident', 'idle', 0x614f5e, 0xd6963a],
    [-14, 0.16, 212, 'Merchant', 'announce', 0x7a4033, 0xe6b85c],
    [14, 0.16, 212, 'Scholar', 'converse', 0x2b4a59, 0x7de2f0],
    [-42, 0.16, 232, 'Scholar', 'clipboard', 0x364a5e, 0xd4a44e],
    [42, 0.16, 232, 'Customs Clerk', 'clipboard', 0x33473d, 0xe6b85c],
    [-92, 0.16, 224, 'Resident', 'browse', 0x6b5342, 0xc27f4e],
    [92, 0.16, 224, 'Merchant', 'browse', 0x4e6650, 0xd6963a],
    [-16, 0.16, 280, 'Resident', 'converse', 0x52453b, 0x7de2f0],
    [16, 0.16, 280, 'City Guard', 'watch', 0x2a3542, 0xd4a44e],
    [-162, 0.16, 82, 'Engineer', 'forge', 0x3d332c, 0xd98245],
    [-196, 0.16, 78, 'Dock Porter', 'haul', 0x52453b, 0x9aa4b0],
    [192, 0.16, 212, 'Resident', 'idle', 0x5c6870, 0xd4a44e],
    [244, 0.16, 212, 'Merchant', 'converse', 0x6e3a48, 0xe6b85c],
    [-95, 0.16, 159, 'Dock Porter', 'sweep', 0x4a5259, 0xc27f4e],
    [48, 0.16, 159, 'Resident', 'converse', 0x735940, 0x6ecad9],
  ];
  extraAmbientCoords.forEach(([x, y, z, role, actionKind, tunicColor, accentColor], idx) => {
    npcSpawns.push({
      id: `npc_metro_citizen_${idx}`,
      role,
      behavior: actionKind === 'watch' ? 'idle' : 'interact',
      actionKind,
      position: [x, y, z],
      facingYaw: (idx * 1.1) % (Math.PI * 2),
      tunicColor,
      accentColor,
    });
  });

  // =========================================================================
  // 7. CANONICAL LANDMARK & INFRASTRUCTURE INTERACTABLES
  // =========================================================================
  interactables.push(
    {
      id: 'int_grand_canal_bridge',
      title: 'Grand Canal Lock Bridge',
      subtitle: 'Central Waterway Artery',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [0, 2.6, 137.0],
      radius: 3.6,
      lines: [
        'Three stone arch bridges span Elarion’s Grand Canal basin, linking harbour refineries directly to the Merchant Quarter.',
        'External-mana cargo barges carry refined crystals and machined goods inland toward the railway freight yards.',
      ],
    },
    {
      id: 'int_temple_quarter_sanctuary',
      title: 'Temple Quarter Nave & Basin',
      subtitle: 'Temple Quarter · NW Terrace',
      category: 'Landmark',
      promptAction: 'Read',
      position: [-194.0, 1.6, -13.0],
      radius: 3.6,
      lines: [
        'A gabled stone sanctuary with a copper bell-steeple and carved stone cloisters frames Elarion’s reflection basin.',
        'Built over generations by harbour stonewrights, the sanctuary welcomes citizens from every fief in the Domain.',
      ],
    },
    {
      id: 'int_outer_foundry_cooling',
      title: 'Mana Works Condenser Towers',
      subtitle: 'Industrial Quarter & Mana Works',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-238.0, 0.16, 54.0],
      radius: 4.0,
      lines: [
        'Paired 34-meter cooling towers regulate pressure for Elarion’s heavy machinery, munitions foundries, and mana storage tanks.',
      ],
    },
    {
      id: 'int_trade_exchange_square',
      title: 'Grand Exchange Square & Compass Fountain',
      subtitle: 'Heart of the Merchant Quarter',
      category: 'Landmark',
      promptAction: 'Read',
      position: [0, 0.16, 206.5],
      radius: 4.2,
      lines: [
        'This open maritime plaza and brass compass monument anchor Elarion’s banking, shipping finance, and overseas trade.',
        'Westward lie residential neighbourhoods and civic schools; eastward stand the Reserve Bank Clocktower and Clearing House.',
      ],
    },
    {
      id: 'int_three_councils_hall',
      title: 'Three-Council Assembly Hall',
      subtitle: 'Administrative & Noble Heights',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [222.0, 5.2, 18.5],
      radius: 3.8,
      lines: [
        'Seat of the Council of Law, the Council of Authority, and the quarterly Council of Elders under House Vaelcrest.',
        'Here mayors, fief governors, and meritocratically appointed commoners coordinate the entire coastal civilization.',
      ],
    },
    {
      id: 'int_coastal_railgun_battery',
      title: 'Coastal Mana-Railgun Battery',
      subtitle: 'Citadel Bastion Overlook',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [154.0, 5.2, -26.0],
      radius: 3.8,
      lines: [
        'Heavy external-mana railgun emplacements guard the harbour approaches alongside traditional knights and barrier pylons.',
      ],
    },
    {
      id: 'int_southgate_highway',
      title: 'Domain Overland Bastion Gate',
      subtitle: 'Highway & Rail Link to Vaelcrest Domain',
      category: 'Infrastructure',
      promptAction: 'Read',
      position: [0, 0.16, 324.0],
      radius: 3.8,
      lines: [
        'Twin rampart towers and mana barrier pylons stand at the inland gateway connecting Elarion to agricultural plains, mines, and highlands.',
      ],
    }
  );

  // =========================================================================
  // 8. EXPANSION PICKABLE PROPS (8 Collectibles Across Outer Districts)
  // =========================================================================
  pickableSpecs.push(
    {
      id: 'pick_canal_bridge_manifest',
      title: 'Canal Freight Lock Ledger',
      subtitle: 'Central Canal Bridge · Crest',
      propKind: 'dispatch-scroll',
      position: [3.2, 2.6, 137.0],
      lines: ['Dispatch tallying external-mana barge shipments bound for Elarion’s Merchant Quarter.'],
    },
    {
      id: 'pick_temple_sanctuary_prism',
      title: 'Sanctuary Chime Prism',
      subtitle: 'Temple Quarter · Reflection Basin',
      propKind: 'mana-crystal',
      position: [-184.5, 1.6, -20.0],
      lines: ['A resonant pale-blue crystal calibrated to chime quietly across the sanctuary cloisters.'],
    },
    {
      id: 'pick_outer_foundry_ingot',
      title: 'Railgun Alloy Forging',
      subtitle: 'Mana Works · Rolling Mill',
      propKind: 'copper-ingot',
      position: [-174.0, 0.16, 46.0],
      lines: ['High-density copper-steel bar cast for Citadel railgun barrels and railway axles.'],
    },
    {
      id: 'pick_exchange_charter_seal',
      title: 'Reserve Bank Bullion Seal',
      subtitle: 'Merchant Quarter · Exchange Square',
      propKind: 'cargo-seal',
      position: [5.5, 0.16, 205.5],
      lines: ['Stamped maritime lending coffer certifying overseas investment credit in Elarion.'],
    },
    {
      id: 'pick_polytechnic_satchel',
      title: 'Civic Field Survey Kit',
      subtitle: 'West Residential · Guild School',
      propKind: 'herb-satchel',
      position: [-36.0, 0.16, 240.0],
      lines: ['Satchel packed with field notebooks and apothecary tonics issued to civic apprentices.'],
    },
    {
      id: 'pick_clearinghouse_astrolabe',
      title: 'Exchange Meridian Chronometer',
      subtitle: 'East Merchant Ward · Clearing House',
      propKind: 'brass-astrolabe',
      position: [35.0, 0.16, 240.0],
      lines: ['Precision chronometer synchronizing maritime shipping ledgers with inland rail departures.'],
    },
    {
      id: 'pick_council_folio',
      title: 'Three-Council Charter Roll',
      subtitle: 'Administrative Heights · Council Portico',
      propKind: 'dispatch-scroll',
      position: [220.0, 5.2, 12.0],
      lines: ['Legislative memorandum signed jointly by the Council of Law and Council of Authority.'],
    },
    {
      id: 'pick_bastion_mana_cell',
      title: 'Barrier Pylon Capacitor',
      subtitle: 'Overland Bastion Rampart',
      propKind: 'mana-crystal',
      position: [9.5, 0.16, 326.0],
      lines: ['Sealed external-mana capacitor cell powering Elarion’s southern defensive barrier pylons.'],
    }
  );

  // =========================================================================
  // 9. CITADEL & BASTION COMBAT SPARRING DUMMIES
  // =========================================================================
  combatDummies.push(
    {
      id: 'el_dummy_citadel_north',
      name: 'House Vaelcrest Knight Dummy',
      position: [176.0, 5.2, 54.0],
      facingYaw: -1.57,
      maxHp: 260,
      armored: true,
    },
    {
      id: 'el_dummy_citadel_south',
      name: 'Domain Lancer Dummy',
      position: [184.0, 5.2, 60.0],
      facingYaw: -2.2,
      maxHp: 220,
      armored: true,
    },
    {
      id: 'el_dummy_southgate_post',
      name: 'Bastion Gate Watch Dummy',
      position: [-14.0, 0.16, 318.0],
      facingYaw: 0.4,
      maxHp: 180,
    }
  );

  // Interactive Closed Double Oak-and-Iron Bastion Gate Doors (Z = 333)
  let southGateUnlocked = false;
  const gateCollider: BoxCollider = {
    minX: -12.6,
    maxX: 12.6,
    minY: 0.16,
    maxY: 8.8,
    minZ: 332.1,
    maxZ: 333.9,
  };
  boxColliders.push(gateCollider);

  const gateDoorGeo = new THREE.BoxGeometry(6.25, 8.4, 0.65);
  const gateBandGeo = new THREE.BoxGeometry(6.28, 0.45, 0.78);
  disposables.push(gateDoorGeo, gateBandGeo);

  const leftGatePivot = new THREE.Group();
  leftGatePivot.position.set(-12.5, 0.16, 333.0);
  const leftLeaf = new THREE.Mesh(gateDoorGeo, mats.darkTimber);
  leftLeaf.position.set(3.125, 4.2, 0);
  const leftBandA = new THREE.Mesh(gateBandGeo, mats.iron);
  leftBandA.position.set(3.125, 2.1, 0);
  const leftBandB = new THREE.Mesh(gateBandGeo, mats.iron);
  leftBandB.position.set(3.125, 6.2, 0);
  leftGatePivot.add(leftLeaf, leftBandA, leftBandB);

  const rightGatePivot = new THREE.Group();
  rightGatePivot.position.set(12.5, 0.16, 333.0);
  const rightLeaf = new THREE.Mesh(gateDoorGeo, mats.darkTimber);
  rightLeaf.position.set(-3.125, 4.2, 0);
  const rightBandA = new THREE.Mesh(gateBandGeo, mats.iron);
  rightBandA.position.set(-3.125, 2.1, 0);
  const rightBandB = new THREE.Mesh(gateBandGeo, mats.iron);
  rightBandB.position.set(-3.125, 6.2, 0);
  rightGatePivot.add(rightLeaf, rightBandA, rightBandB);

  group.add(leftGatePivot, rightGatePivot);
  raycastTargets.push(leftLeaf, rightLeaf);

  let gateOpenAngle = 0;
  let simTime = 0;

  const unlockGate = (gateId: string): boolean => {
    if (gateId !== 'south_bastion_gate' || southGateUnlocked) return false;
    southGateUnlocked = true;
    gateCollider.maxY = -10;
    gateCollider.minY = -12;
    return true;
  };

  const isGateOpen = (gateId: string): boolean =>
    gateId === 'south_bastion_gate' ? southGateUnlocked : false;

  const update = (dt: number) => {
    const clampedDt = Math.min(dt, 0.05);
    simTime += clampedDt;
    for (const b of barges) {
      b.mesh.position.x += b.speed * b.direction * clampedDt;
      if (b.direction === 1 && b.mesh.position.x > b.maxX) b.mesh.position.x = b.minX;
      if (b.direction === -1 && b.mesh.position.x < b.minX) b.mesh.position.x = b.maxX;
      b.mesh.position.y = -1.45 + Math.sin(simTime * 1.4 + b.phase) * 0.07;
      b.mesh.rotation.z = Math.sin(simTime * 0.9 + b.phase) * 0.015;
    }

    const targetAngle = southGateUnlocked ? 1.42 : 0;
    gateOpenAngle = THREE.MathUtils.damp(gateOpenAngle, targetAngle, 3.6, clampedDt);
    leftGatePivot.rotation.y = gateOpenAngle;
    rightGatePivot.rotation.y = -gateOpenAngle;
  };

  return {
    group,
    npcSpawns,
    interactables,
    pickableSpecs,
    combatDummies,
    unlockGate,
    isGateOpen,
    update,
  };
}
