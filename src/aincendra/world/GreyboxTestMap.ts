import * as THREE from 'three';
import type {
  BoxCollider,
  CombatDummySpec,
  GreyboxWorldData,
  InteractableSpec,
  RampCollider,
} from '../core/types';
import { PickablePropSystem, type PickablePropSpec } from './PickableProps';

function createGreyboxGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Restrained weathered slate-stone greybox surface
  ctx.fillStyle = '#3c434d';
  ctx.fillRect(0, 0, size, size);

  // Subtle surface grain
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73) % size;
    const y = (i * 137) % size;
    const v = i % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.035)';
    ctx.fillStyle = v;
    ctx.fillRect(x, y, 2, 2);
  }

  // Minor 0.5m subdivisions
  ctx.strokeStyle = 'rgba(205, 214, 224, 0.08)';
  ctx.lineWidth = 1;
  const step = size / 8;
  for (let i = 0; i <= 8; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Major 2m border lines
  ctx.strokeStyle = 'rgba(226, 222, 212, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createStoneBlockTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5d646e';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(30, 34, 40, 0.24)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();

    const offset = (y / 64) % 2 === 0 ? 0 : 64;
    for (let x = offset; x < size; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds the Milestone 1 greybox movement test map ("Elarion Harbourside Proving Yard").
 * Includes stepped stairs, an ascending ramp, jump platforms, a low crouch clearance archway,
 * tall pillars for spring-arm camera collision testing, and a coastal perimeter so the
 * scene never feels like a floating box in an empty void.
 */
export function buildGreyboxTestMap(maxAnisotropy: number): GreyboxWorldData {
  const group = new THREE.Group();
  group.name = 'Elarion_Greybox_TestMap';

  const boxColliders: BoxCollider[] = [];
  const rampColliders: RampCollider[] = [];
  const raycastTargets: THREE.Object3D[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const gridTex = createGreyboxGridTexture(maxAnisotropy);
  const stoneTex = createStoneBlockTexture(maxAnisotropy);
  disposables.push(gridTex, stoneTex);

  const matGround = new THREE.MeshStandardMaterial({
    map: gridTex,
    roughness: 0.88,
    metalness: 0.04,
  });
  const matStone = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x7b838c,
    roughness: 0.85,
    metalness: 0.05,
  });
  const matDarkSlate = new THREE.MeshStandardMaterial({
    color: 0x2e353f,
    roughness: 0.78,
    metalness: 0.14,
  });
  const matCopperTrim = new THREE.MeshStandardMaterial({
    color: 0xa66e46,
    roughness: 0.36,
    metalness: 0.82,
  });
  const matManaSubtle = new THREE.MeshStandardMaterial({
    color: 0x3b8ea5,
    emissive: 0x1e5c70,
    emissiveIntensity: 0.65,
    roughness: 0.28,
    metalness: 0.25,
  });
  const matSea = new THREE.MeshStandardMaterial({
    color: 0x1b3344,
    roughness: 0.25,
    metalness: 0.22,
  });
  const matDistantCity = new THREE.MeshStandardMaterial({
    color: 0x29323d,
    roughness: 0.92,
    metalness: 0.05,
  });

  disposables.push(matGround, matStone, matDarkSlate, matCopperTrim, matManaSubtle, matSea, matDistantCity);

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
    mesh.castShadow = options?.castShadow ?? true;
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

  // 1. Main courtyard ground plane (64m x 64m) + surrounding coastal terrain shelf
  const courtyardGeo = new THREE.BoxGeometry(64, 1.0, 64);
  disposables.push(courtyardGeo);
  const courtyardMesh = new THREE.Mesh(courtyardGeo, matGround);
  courtyardMesh.position.set(0, -0.5, 0);
  courtyardMesh.receiveShadow = true;
  group.add(courtyardMesh);
  raycastTargets.push(courtyardMesh);

  // Extended coastal sea plane surrounding the pier/proving yard
  const seaGeo = new THREE.PlaneGeometry(480, 480);
  disposables.push(seaGeo);
  const seaMesh = new THREE.Mesh(seaGeo, matSea);
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(0, -1.65, 0);
  seaMesh.receiveShadow = true;
  group.add(seaMesh);

  // 2. Perimeter low stone sea-wall & inland terrace retaining wall (natural outdoor boundary)
  addBox(0, 0, -31.5, 64, 1.4, 1.0, matDarkSlate);   // North parapet facing sea
  addBox(0, 0, 31.5, 64, 2.6, 1.2, matStone);        // South retaining wall
  addBox(-31.5, 0, 0, 1.2, 1.6, 62, matDarkSlate);   // West seawall
  addBox(31.5, 0, 0, 1.2, 2.2, 62, matStone);        // East district boundary wall

  // 3. Stepped stairs leading onto a raised 1.68m greybox terrace (tests step-up locomotion)
  const stairX = -10;
  const stairStartZ = -4;
  for (let i = 0; i < 6; i++) {
    const stepH = (i + 1) * 0.28;
    addBox(stairX, 0, stairStartZ - i * 0.7, 3.6, stepH, 0.7, matStone);
  }
  // Raised terrace platform at top of stairs
  addBox(stairX, 0, -10.8, 7.6, 1.68, 6.2, matStone);
  // Subtle copper railing cap on terrace
  addBox(stairX - 3.6, 1.68, -10.8, 0.22, 0.9, 6.0, matCopperTrim);

  // 4. Sloped Ramp (+Z to -Z ascent from 0m to 2.4m) connected to an overlook deck
  const rampCx = 10;
  const rampMinZ = -12;
  const rampMaxZ = -2;
  const rampW = 3.8;
  const rampHeight = 2.4;
  const rampLen = rampMaxZ - rampMinZ;

  // Build wedge geometry for visual ramp
  const rampShape = new THREE.Shape();
  rampShape.moveTo(0, 0);
  rampShape.lineTo(rampLen, 0);
  rampShape.lineTo(rampLen, rampHeight);
  rampShape.closePath();

  const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
    depth: rampW,
    bevelEnabled: false,
  });
  // Orient wedge so X->Z runs from rampMaxZ (y=0) to rampMinZ (y=rampHeight)
  rampGeo.rotateY(Math.PI / 2);
  disposables.push(rampGeo);
  const rampMesh = new THREE.Mesh(rampGeo, matStone);
  rampMesh.position.set(rampCx - rampW * 0.5, 0, rampMaxZ);
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  group.add(rampMesh);
  raycastTargets.push(rampMesh);

  rampColliders.push({
    minX: rampCx - rampW * 0.5,
    maxX: rampCx + rampW * 0.5,
    minZ: rampMinZ,
    maxZ: rampMaxZ,
    axis: '-z',
    yStart: 0,
    yEnd: rampHeight,
  });

  // Elevated overlook deck at top of ramp
  addBox(rampCx, 0, -15.5, 6.8, rampHeight, 7.0, matStone);

  // 5. Jump-Gap Platforms (tests grounded jump, air control, and crisp landing)
  addBox(0, 0, -9, 3.2, 0.65, 3.2, matStone);
  addBox(0, 0, -14.2, 3.2, 1.15, 3.2, matStone);
  addBox(0, 0, -19.8, 3.8, 1.55, 3.6, matStone);

  // 6. Crouch-Clearance Archway (1.42m underside height: blocks standing 1.82m, allows crouching 1.16m)
  const archX = -12;
  const archZ = 10;
  addBox(archX - 1.9, 0, archZ, 0.7, 2.8, 4.2, matDarkSlate);
  addBox(archX + 1.9, 0, archZ, 0.7, 2.8, 4.2, matDarkSlate);
  // Overhead lintel leaves 1.42m clearance underneath
  addBox(archX, 1.42, archZ, 4.5, 1.38, 4.2, matStone);
  // Copper trim band marking crouch threshold
  addBox(archX, 1.40, archZ - 2.12, 3.2, 0.08, 0.08, matCopperTrim, { collide: false });
  addBox(archX, 1.40, archZ + 2.12, 3.2, 0.08, 0.08, matCopperTrim, { collide: false });

  // 7. Camera Collision Test Zone (tall pillars + L-wall alcove to verify spring-arm retraction)
  addBox(12, 0, 8, 1.6, 5.2, 1.6, matDarkSlate);
  addBox(16, 0, 8, 1.6, 5.2, 1.6, matDarkSlate);
  addBox(14, 0, 12.5, 6.5, 4.4, 1.1, matStone);
  addBox(17.2, 0, 9.8, 1.1, 4.4, 5.8, matStone);

  // 8. Composite Mana-Conduit Waymarker Pylons (3-part composite models establishing restrained Elarion tone)
  const pylonCoords: Array<[number, number]> = [
    [-5.5, 4.5],
    [5.5, 4.5],
    [-5.5, -24],
    [5.5, -24],
  ];
  for (const [px, pz] of pylonCoords) {
    const pylon = new THREE.Group();
    pylon.position.set(px, 0, pz);

    const plinthGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.55, 8);
    const shaftGeo = new THREE.CylinderGeometry(0.24, 0.34, 2.4, 8);
    const collarGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 8);
    const coreGeo = new THREE.OctahedronGeometry(0.22, 0);
    const capGeo = new THREE.ConeGeometry(0.38, 0.45, 8);
    disposables.push(plinthGeo, shaftGeo, collarGeo, coreGeo, capGeo);

    const plinth = new THREE.Mesh(plinthGeo, matDarkSlate);
    plinth.position.y = 0.275;
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const shaft = new THREE.Mesh(shaftGeo, matStone);
    shaft.position.y = 0.55 + 1.2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;

    const collar = new THREE.Mesh(collarGeo, matCopperTrim);
    collar.position.y = 3.0;
    collar.castShadow = true;

    const core = new THREE.Mesh(coreGeo, matManaSubtle);
    core.position.y = 3.32;

    const cap = new THREE.Mesh(capGeo, matDarkSlate);
    cap.position.y = 3.78;
    cap.castShadow = true;

    pylon.add(plinth, shaft, collar, core, cap);
    group.add(pylon);
    raycastTargets.push(plinth, shaft);

    boxColliders.push({
      minX: px - 0.5,
      maxX: px + 0.5,
      minY: 0,
      maxY: 3.9,
      minZ: pz - 0.5,
      maxZ: pz + 0.5,
    });
  }

  // 9. Distant Metropolitan Harbour & Industrial Silhouettes (InstancedMesh for low draw calls)
  const silhouetteGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(silhouetteGeo);
  const silhouetteData: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [
    // Distant city headland blocks to the East/South-East/West
    { x: 68, y: 0, z: -42, sx: 18, sy: 18, sz: 22 },
    { x: 82, y: 0, z: -18, sx: 22, sy: 28, sz: 16 },
    { x: 74, y: 0, z: 12, sx: 16, sy: 21, sz: 20 },
    { x: 62, y: 0, z: 42, sx: 24, sy: 15, sz: 18 },
    { x: 46, y: 0, z: 62, sx: 20, sy: 26, sz: 18 },
    { x: 18, y: 0, z: 68, sx: 26, sy: 34, sz: 20 },
    { x: -16, y: 0, z: 72, sx: 22, sy: 24, sz: 18 },
    { x: -48, y: 0, z: 64, sx: 26, sy: 19, sz: 22 },
    { x: -72, y: 0, z: 32, sx: 20, sy: 22, sz: 24 },
    { x: -78, y: 0, z: -8, sx: 24, sy: 16, sz: 20 },
    // Breakwater piers & distant harbour silhouettes to the North
    { x: -56, y: -1.6, z: -85, sx: 14, sy: 5, sz: 42 },
    { x: 54, y: -1.6, z: -96, sx: 16, sy: 6, sz: 48 },
    { x: 88, y: 0, z: -78, sx: 12, sy: 32, sz: 12 }, // Distant lighthouse/tower silhouette
  ];

  const silhouetteInst = new THREE.InstancedMesh(silhouetteGeo, matDistantCity, silhouetteData.length);
  const dummy = new THREE.Object3D();
  silhouetteData.forEach((b, idx) => {
    dummy.position.set(b.x, b.y + b.sy * 0.5, b.z);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    silhouetteInst.setMatrixAt(idx, dummy.matrix);
  });
  silhouetteInst.computeBoundingSphere();
  group.add(silhouetteInst);

  const pickableSpecs: PickablePropSpec[] = [
    {
      id: 'gb_pick_shard',
      title: 'Calibration Mana Shard',
      subtitle: 'Proving Yard · Spawn Beacon',
      propKind: 'mana-crystal',
      position: [2.8, 0, 7.5],
      lines: ['Test mana shard used for calibrating Elarion conduit proximity sensors.'],
    },
    {
      id: 'gb_pick_astrolabe',
      title: 'Terrace Survey Astrolabe',
      subtitle: 'Raised Terrace · Step-Up Reward',
      propKind: 'brass-astrolabe',
      position: [-10, 1.68, -10.8],
      lines: ['Precision brass instrument mounted atop the stepped proving terrace.'],
    },
    {
      id: 'gb_pick_scroll',
      title: 'Overlook Survey Dispatch',
      subtitle: 'Ramp Overlook Deck',
      propKind: 'dispatch-scroll',
      position: [10, 2.4, -15.5],
      lines: ['Field inspection log detailing ramp incline tolerances and deck clearance.'],
    },
    {
      id: 'gb_pick_ingot',
      title: 'Assay Copper Ingot',
      subtitle: 'Crouch Archway Cache',
      propKind: 'copper-ingot',
      position: [-12, 0, 15.2],
      lines: ['Stamped copper-bronze bars placed beyond the crouch-clearance archway.'],
    },
  ];

  const pickables = new PickablePropSystem(pickableSpecs);
  group.add(pickables.group);

  const interactables: InteractableSpec[] = [
    {
      id: 'gb_pylon_west',
      title: 'West Waymarker Pylon',
      subtitle: 'Mana-Conduit Proving Yard',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-5.5, 0, 4.5],
      radius: 2.8,
      labelHeight: 2.2,
      lines: [
        'Composite slate-and-copper conduit pylon regulating courtyard test illumination.',
      ],
    },
    {
      id: 'gb_pylon_east',
      title: 'East Waymarker Pylon',
      subtitle: 'Mana-Conduit Proving Yard',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [5.5, 0, 4.5],
      radius: 2.8,
      labelHeight: 2.2,
      lines: [
        'Paired eastern conduit pylon anchoring the Elarion Proving Yard perimeter.',
      ],
    },
    ...pickables.toInteractables(),
  ];

  const combatDummies: CombatDummySpec[] = [
    {
      id: 'gb_dummy_standard',
      name: 'Proving Yard Dummy',
      position: [0, 0, 5.2],
      facingYaw: 0,
      maxHp: 150,
    },
    {
      id: 'gb_dummy_armored',
      name: 'Armored Assay Dummy',
      position: [-3.2, 0, 1.5],
      facingYaw: 0.35,
      maxHp: 220,
      armored: true,
    },
  ];

  return {
    group,
    boxColliders,
    rampColliders,
    raycastTargets,
    spawnPoint: new THREE.Vector3(0, 0, 12),
    worldBoundsRadius: 30.2,
    interactables,
    combatDummies,
    collectProp: (id: string) => pickables.collect(id),
    update: (dt: number) => {
      pickables.update(dt);
    },
    dispose: () => {
      pickables.dispose();
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
