import * as THREE from 'three';
import type { BoxCollider, GreyboxWorldData, RampCollider } from '../core/types';
import {
  createBrickTexture,
  createCobbleTexture,
  createPavementTexture,
  createPlankTexture,
  createRoofSlateTexture,
  createSandstoneTexture,
  createSignTexture,
} from './ElarionTextures';

/**
 * Milestone 3 — First Elarion Street ("Harbourgate Lane")
 * Bridges the Merchant Quarter edge toward the Grand Harbour overlook.
 * Features:
 * - Cobblestone roadway + raised 0.16m stone pavements (smooth step-up)
 * - 6 modular buildings combining sandstone, dark industrial brick, timber framing,
 *   slate roofs, multi-pane glass windows, and copper mana-conduit infrastructure
 * - 2 fully accessible ground-floor interiors (Vaelcrest Chandlery & The Salt and Brass Tavern)
 * - Composite mana street lamps, hanging shop signs, market awning, notice board, crates/barrels
 * - North coastal overlook balustrade with harbour water & distant city/ship silhouettes
 */
export function buildElarionFirstStreet(maxAnisotropy: number): GreyboxWorldData {
  const group = new THREE.Group();
  group.name = 'Elarion_FirstStreet_HarbourgateLane';

  const boxColliders: BoxCollider[] = [];
  const rampColliders: RampCollider[] = [];
  const raycastTargets: THREE.Object3D[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  // Procedural Textures
  const cobbleTex = createCobbleTexture(maxAnisotropy, 3, 18);
  const pavementTex = createPavementTexture(maxAnisotropy, 2, 16);
  const sandstoneTex = createSandstoneTexture(maxAnisotropy, 2, 2);
  const brickTex = createBrickTexture(maxAnisotropy, 2, 2);
  const plankTex = createPlankTexture(maxAnisotropy, 2, 2);
  const roofTex = createRoofSlateTexture(maxAnisotropy, 3, 2);

  const signChandleryTex = createSignTexture(
    'CHANDLERY',
    'VAELCREST CUSTOMS',
    '#242c35',
    '#b67a4e',
    '#f0eadf',
    maxAnisotropy
  );
  const signTavernTex = createSignTexture(
    'SALT & BRASS',
    'SAILORS TAPROOM',
    '#34231d',
    '#c68b59',
    '#f4ece0',
    maxAnisotropy
  );
  const signConduitTex = createSignTexture(
    'CONDUIT WORKS',
    'MANA & HOROLOGY',
    '#1f2a33',
    '#5299ae',
    '#e8eef2',
    maxAnisotropy
  );
  const signTradeTex = createSignTexture(
    'TRADE HOUSE',
    'MARITIME EXCHANGE',
    '#2d2b28',
    '#b8925a',
    '#f3eee4',
    maxAnisotropy
  );

  disposables.push(
    cobbleTex,
    pavementTex,
    sandstoneTex,
    brickTex,
    plankTex,
    roofTex,
    signChandleryTex,
    signTavernTex,
    signConduitTex,
    signTradeTex
  );

  // Calibrated PBR Materials (varied roughness & metalness >= 0.25 between adjacent parts)
  const matRoad = new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.88, metalness: 0.05 });
  const matPavement = new THREE.MeshStandardMaterial({ map: pavementTex, roughness: 0.86, metalness: 0.04 });
  const matSandstone = new THREE.MeshStandardMaterial({ map: sandstoneTex, roughness: 0.87, metalness: 0.04 });
  const matBrick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.84, metalness: 0.06 });
  const matTimber = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.78, metalness: 0.04 });
  const matDarkTimber = new THREE.MeshStandardMaterial({ color: 0x342820, roughness: 0.76, metalness: 0.06 });
  const matPlaster = new THREE.MeshStandardMaterial({ color: 0xc4bca9, roughness: 0.9, metalness: 0.02 });
  const matSlateRoof = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.72, metalness: 0.12 });
  const matIron = new THREE.MeshStandardMaterial({ color: 0x262b31, roughness: 0.48, metalness: 0.78 });
  const matCopper = new THREE.MeshStandardMaterial({ color: 0xb27449, roughness: 0.34, metalness: 0.86 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x354d5c,
    emissive: 0x2c2418,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.25,
  });
  const matManaLamp = new THREE.MeshStandardMaterial({
    color: 0x8be0f0,
    emissive: 0x5ab8cc,
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0.1,
  });
  const matWarmLantern = new THREE.MeshStandardMaterial({
    color: 0xffd599,
    emissive: 0xe89b42,
    emissiveIntensity: 1.35,
    roughness: 0.25,
    metalness: 0.05,
  });
  const matAwning = new THREE.MeshStandardMaterial({ color: 0x7b3b30, roughness: 0.88, metalness: 0.02 });
  const matParchment = new THREE.MeshStandardMaterial({ color: 0xdccfb4, roughness: 0.92, metalness: 0.0 });
  const matSea = new THREE.MeshStandardMaterial({ color: 0x1a3242, roughness: 0.24, metalness: 0.25 });
  const matDistant = new THREE.MeshStandardMaterial({ color: 0x2c343f, roughness: 0.92, metalness: 0.04 });

  disposables.push(
    matRoad,
    matPavement,
    matSandstone,
    matBrick,
    matTimber,
    matDarkTimber,
    matPlaster,
    matSlateRoof,
    matIron,
    matCopper,
    matGlass,
    matManaLamp,
    matWarmLantern,
    matAwning,
    matParchment,
    matSea,
    matDistant
  );

  const addBox = (
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    options?: { collide?: boolean; cameraBlock?: boolean; castShadow?: boolean; receiveShadow?: boolean }
  ): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(w, h, d);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, baseY + h * 0.5, cz);
    mesh.castShadow = options?.castShadow ?? true;
    mesh.receiveShadow = options?.receiveShadow ?? true;
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

  // Helper: pitched slate roof prism (ridge runs along Z)
  const addGabledRoof = (
    cx: number,
    baseY: number,
    cz: number,
    widthX: number,
    heightY: number,
    lengthZ: number
  ): void => {
    const shape = new THREE.Shape();
    shape.moveTo(-widthX * 0.5, 0);
    shape.lineTo(widthX * 0.5, 0);
    shape.lineTo(0, heightY);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: lengthZ, bevelEnabled: false });
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, matSlateRoof);
    mesh.position.set(cx, baseY, cz - lengthZ * 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Helper: framed window unit attached to a wall face
  const addWindow = (x: number, y: number, z: number, facing: '+x' | '-x' | '+z' | '-z', w = 1.25, h = 1.45): void => {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, y, z);
    if (facing === '+x') winGroup.rotation.y = Math.PI / 2;
    else if (facing === '-x') winGroup.rotation.y = -Math.PI / 2;
    else if (facing === '-z') winGroup.rotation.y = Math.PI;

    const frameGeo = new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.12);
    const paneGeo = new THREE.BoxGeometry(w, h, 0.06);
    const mullionVGeo = new THREE.BoxGeometry(0.07, h, 0.1);
    const mullionHGeo = new THREE.BoxGeometry(w, 0.07, 0.1);
    const sillGeo = new THREE.BoxGeometry(w + 0.28, 0.1, 0.22);
    disposables.push(frameGeo, paneGeo, mullionVGeo, mullionHGeo, sillGeo);

    const frame = new THREE.Mesh(frameGeo, matDarkTimber);
    const pane = new THREE.Mesh(paneGeo, matGlass);
    pane.position.z = 0.02;
    const mV = new THREE.Mesh(mullionVGeo, matDarkTimber);
    mV.position.z = 0.04;
    const mH = new THREE.Mesh(mullionHGeo, matDarkTimber);
    mH.position.z = 0.04;
    const sill = new THREE.Mesh(sillGeo, matSandstone);
    sill.position.set(0, -h * 0.5 - 0.07, 0.05);

    winGroup.add(frame, pane, mV, mH, sill);
    group.add(winGroup);
  };

  // Helper: hanging wrought-iron shop sign
  const addHangingSign = (
    wallX: number,
    y: number,
    z: number,
    dirX: 1 | -1,
    tex: THREE.CanvasTexture
  ): void => {
    const signGroup = new THREE.Group();
    signGroup.position.set(wallX, y, z);

    const armGeo = new THREE.BoxGeometry(1.15, 0.07, 0.07);
    const strutGeo = new THREE.BoxGeometry(0.65, 0.05, 0.05);
    const boardGeo = new THREE.BoxGeometry(0.95, 0.52, 0.07);
    const faceGeo = new THREE.PlaneGeometry(0.9, 0.47);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, metalness: 0.05 });
    disposables.push(armGeo, strutGeo, boardGeo, faceGeo, faceMat);

    const arm = new THREE.Mesh(armGeo, matIron);
    arm.position.set(dirX * 0.56, 0.34, 0);
    arm.castShadow = true;

    const strut = new THREE.Mesh(strutGeo, matIron);
    strut.position.set(dirX * 0.28, 0.14, 0);
    strut.rotation.z = dirX * -0.7;

    const board = new THREE.Mesh(boardGeo, matDarkTimber);
    board.position.set(dirX * 0.62, 0.0, 0);
    board.castShadow = true;

    const faceF = new THREE.Mesh(faceGeo, faceMat);
    faceF.position.set(dirX * 0.62, 0, 0.04);
    const faceB = new THREE.Mesh(faceGeo, faceMat);
    faceB.position.set(dirX * 0.62, 0, -0.04);
    faceB.rotation.y = Math.PI;

    signGroup.add(arm, strut, board, faceF, faceB);
    group.add(signGroup);
  };

  // Helper: 5-part composite mana-powered street lamp (restrained cyan/amber core)
  const addStreetLamp = (x: number, baseY: number, z: number): void => {
    const lamp = new THREE.Group();
    lamp.position.set(x, baseY, z);

    const plinthGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.45, 8);
    const postGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.1, 8);
    const collarGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.18, 8);
    const coreGeo = new THREE.OctahedronGeometry(0.13, 0);
    const capGeo = new THREE.ConeGeometry(0.24, 0.26, 6);
    disposables.push(plinthGeo, postGeo, collarGeo, coreGeo, capGeo);

    const plinth = new THREE.Mesh(plinthGeo, matSandstone);
    plinth.position.y = 0.225;
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const post = new THREE.Mesh(postGeo, matIron);
    post.position.y = 0.45 + 1.55;
    post.castShadow = true;

    const collar = new THREE.Mesh(collarGeo, matCopper);
    collar.position.y = 3.55;

    const core = new THREE.Mesh(coreGeo, matManaLamp);
    core.position.y = 3.78;

    const cap = new THREE.Mesh(capGeo, matIron);
    cap.position.y = 4.02;
    cap.castShadow = true;

    lamp.add(plinth, post, collar, core, cap);
    group.add(lamp);

    boxColliders.push({
      minX: x - 0.26,
      maxX: x + 0.26,
      minY: baseY,
      maxY: baseY + 3.9,
      minZ: z - 0.26,
      maxZ: z + 0.26,
    });
  };

  // Helper: Wooden crate & iron-hooped barrel props
  const addCrate = (x: number, baseY: number, z: number, s = 0.85, rotY = 0): void => {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.rotation.y = rotY;
    const bodyGeo = new THREE.BoxGeometry(s, s, s);
    const trimGeo = new THREE.BoxGeometry(s + 0.04, 0.1, s + 0.04);
    disposables.push(bodyGeo, trimGeo);

    const body = new THREE.Mesh(bodyGeo, matTimber);
    body.position.y = s * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;

    const topTrim = new THREE.Mesh(trimGeo, matDarkTimber);
    topTrim.position.y = s - 0.05;
    const botTrim = new THREE.Mesh(trimGeo, matDarkTimber);
    botTrim.position.y = 0.05;

    g.add(body, topTrim, botTrim);
    group.add(g);
    raycastTargets.push(body);

    boxColliders.push({
      minX: x - s * 0.5,
      maxX: x + s * 0.5,
      minY: baseY,
      maxY: baseY + s,
      minZ: z - s * 0.5,
      maxZ: z + s * 0.5,
    });
  };

  const addBarrel = (x: number, baseY: number, z: number): void => {
    const g = new THREE.Group();
    g.position.set(x, baseY, z);
    const bodyGeo = new THREE.CylinderGeometry(0.36, 0.34, 0.92, 10);
    const hoopGeo = new THREE.CylinderGeometry(0.375, 0.375, 0.07, 10);
    disposables.push(bodyGeo, hoopGeo);

    const body = new THREE.Mesh(bodyGeo, matTimber);
    body.position.y = 0.46;
    body.castShadow = true;
    body.receiveShadow = true;

    const hoop1 = new THREE.Mesh(hoopGeo, matIron);
    hoop1.position.y = 0.22;
    const hoop2 = new THREE.Mesh(hoopGeo, matIron);
    hoop2.position.y = 0.72;

    g.add(body, hoop1, hoop2);
    group.add(g);
    raycastTargets.push(body);

    boxColliders.push({
      minX: x - 0.36,
      maxX: x + 0.36,
      minY: baseY,
      maxY: baseY + 0.92,
      minZ: z - 0.36,
      maxZ: z + 0.36,
    });
  };

  // =========================================================================
  // 1. ROADWAY, PAVEMENTS & HARBOUR SEA PLANE
  // =========================================================================
  // Extended coastal sea surrounding harbour overlook
  const seaGeo = new THREE.PlaneGeometry(520, 520);
  disposables.push(seaGeo);
  const seaMesh = new THREE.Mesh(seaGeo, matSea);
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(0, -1.8, -120);
  group.add(seaMesh);

  // Main cobblestone roadway (X = -4.5..+4.5, Z = -26..+26, Y = 0)
  addBox(0, -0.6, 0, 9.2, 0.6, 52, matRoad, { collide: false, castShadow: false });

  // Copper-trimmed mana conduit channel embedded along the west gutter edge
  addBox(-4.35, 0.005, 0, 0.28, 0.02, 50, matIron, { collide: false, castShadow: false });
  addBox(-4.35, 0.02, 0, 0.08, 0.015, 50, matCopper, { collide: false, castShadow: false });

  // Raised stone pavements (West X = -9.5..-4.5, East X = +4.5..+9.5, height 0.16m)
  addBox(-7.0, -0.4, 0, 5.0, 0.56, 52, matPavement, { castShadow: false });
  addBox(7.0, -0.4, 0, 5.0, 0.56, 52, matPavement, { castShadow: false });

  // North Harbour Overlook Promenade (Z = -26..-22, Y = 0.16m) + Stone Balustrade
  addBox(0, -0.4, -24.2, 19.0, 0.56, 4.4, matPavement, { castShadow: false });
  // Balustrade parapet at Z = -26.1 with subtle overlook pillars
  addBox(0, 0.16, -26.1, 19.2, 1.05, 0.55, matSandstone);
  for (let bx = -8; bx <= 8; bx += 4) {
    addBox(bx, 0.16, -26.1, 0.72, 1.32, 0.72, matSandstone);
    addBox(bx, 1.48, -26.1, 0.78, 0.1, 0.78, matCopper, { collide: false });
  }

  // South Archway Street Gate (Z = +25.4) framing the lane continuation
  addBox(-6.9, 0.16, 25.4, 5.2, 5.6, 1.4, matSandstone);
  addBox(6.9, 0.16, 25.4, 5.2, 5.6, 1.4, matSandstone);
  addBox(0, 4.1, 25.4, 9.0, 1.66, 1.4, matSandstone);
  // Subtle copper keystone band on gate
  addBox(0, 4.05, 24.65, 3.2, 0.18, 0.12, matCopper, { collide: false });

  // =========================================================================
  // 2. ACCESSIBLE INTERIOR BUILDING #1 — VAELCREST CUSTOMS & CHANDLERY (West South)
  // Footprint: X = -17.0..-9.5, Z = +3.5..+13.5, Doorway at X = -9.5, Z = +7.3..+9.7
  // =========================================================================
  {
    const minX = -17.0;
    const maxX = -9.5;
    const minZ = 3.5;
    const maxZ = 13.5;
    const floorY = 0.18;
    const groundH = 3.6;

    // Timber interior floor (+0.02m above pavement)
    addBox((minX + maxX) * 0.5, -0.4, (minZ + maxZ) * 0.5, maxX - minX, 0.58, maxZ - minZ, matTimber, {
      castShadow: false,
    });

    // Back wall (X = -17.0), North wall (Z = +3.5), South wall (Z = +13.5)
    addBox(minX + 0.2, floorY, (minZ + maxZ) * 0.5, 0.4, groundH, maxZ - minZ, matSandstone);
    addBox((minX + maxX) * 0.5, floorY, minZ + 0.2, maxX - minX, groundH, 0.4, matSandstone);
    addBox((minX + maxX) * 0.5, floorY, maxZ - 0.2, maxX - minX, groundH, 0.4, matSandstone);

    // Street-facing wall with 2.4m-wide open doorway (Z = +7.3..+9.7)
    addBox(maxX - 0.2, floorY, 5.4, 0.4, groundH, 3.8, matSandstone);   // Z = 3.5..7.3
    addBox(maxX - 0.2, floorY, 11.6, 0.4, groundH, 3.8, matSandstone);  // Z = 9.7..13.5
    addBox(maxX - 0.2, floorY + 2.65, 8.5, 0.4, 0.95, 2.4, matSandstone); // Overhead lintel
    // Timber doorframe trim
    addBox(maxX + 0.04, floorY, 7.25, 0.14, 2.65, 0.14, matDarkTimber, { collide: false });
    addBox(maxX + 0.04, floorY, 9.75, 0.14, 2.65, 0.14, matDarkTimber, { collide: false });
    addBox(maxX + 0.04, floorY + 2.62, 8.5, 0.16, 0.16, 2.65, matDarkTimber, { collide: false });

    // Ceiling / Second Story & Gabled Slate Roof
    addBox((minX + maxX) * 0.5, floorY + groundH, (minZ + maxZ) * 0.5, maxX - minX + 0.5, 2.7, maxZ - minZ, matPlaster);
    // Timber framing bands on upper story
    addBox(maxX + 0.22, floorY + groundH + 0.06, (minZ + maxZ) * 0.5, 0.1, 0.18, maxZ - minZ, matDarkTimber, { collide: false });
    addBox(maxX + 0.22, floorY + groundH + 2.55, (minZ + maxZ) * 0.5, 0.1, 0.18, maxZ - minZ, matDarkTimber, { collide: false });
    addGabledRoof((minX + maxX) * 0.5, floorY + groundH + 2.7, (minZ + maxZ) * 0.5, maxX - minX + 1.1, 2.2, maxZ - minZ + 0.6);

    // Street & Upper Windows + Hanging Sign
    addWindow(maxX + 0.05, floorY + 1.65, 5.4, '+x', 1.4, 1.45);
    addWindow(maxX + 0.05, floorY + 1.65, 11.6, '+x', 1.4, 1.45);
    addWindow(maxX + 0.26, floorY + groundH + 1.35, 6.2, '+x', 1.15, 1.3);
    addWindow(maxX + 0.26, floorY + groundH + 1.35, 10.8, '+x', 1.15, 1.3);
    addHangingSign(maxX + 0.05, floorY + 3.05, 7.0, 1, signChandleryTex);

    // Interior Props: Service Counter, Desk, Crates, Barrels & Warm Hanging Lantern
    addBox(-14.6, floorY, 7.8, 1.0, 1.05, 4.2, matTimber);
    addBox(-14.6, floorY + 1.05, 7.8, 1.12, 0.08, 4.3, matCopper, { collide: false });
    addCrate(-15.7, floorY, 11.6, 0.9, 0.15);
    addCrate(-14.6, floorY, 12.1, 0.78, -0.2);
    addCrate(-15.7, floorY + 0.9, 11.6, 0.68, 0.4);
    addBarrel(-11.2, floorY, 4.7);
    addBarrel(-12.1, floorY, 4.7);

    // Hanging ceiling lantern (no shadow map for Iris Xe budget)
    addBox(-12.6, floorY + groundH - 0.55, 8.5, 0.26, 0.34, 0.26, matWarmLantern, { collide: false });
    const chandleryLight = new THREE.PointLight(0xffb86b, 3.2, 11, 1.8);
    chandleryLight.position.set(-12.6, floorY + groundH - 0.7, 8.5);
    group.add(chandleryLight);
  }

  // =========================================================================
  // 3. ACCESSIBLE INTERIOR BUILDING #2 — THE SALT & BRASS TAVERN (East Center)
  // Footprint: X = +9.5..+17.0, Z = -6.5..+2.5, Doorway at X = +9.5, Z = -3.2..-0.8
  // =========================================================================
  {
    const minX = 9.5;
    const maxX = 17.0;
    const minZ = -6.5;
    const maxZ = 2.5;
    const floorY = 0.18;
    const groundH = 3.7;

    addBox((minX + maxX) * 0.5, -0.4, (minZ + maxZ) * 0.5, maxX - minX, 0.58, maxZ - minZ, matTimber, {
      castShadow: false,
    });

    // Back wall (X = +17.0), North wall (Z = -6.5), South wall (Z = +2.5)
    addBox(maxX - 0.2, floorY, (minZ + maxZ) * 0.5, 0.4, groundH, maxZ - minZ, matBrick);
    addBox((minX + maxX) * 0.5, floorY, minZ + 0.2, maxX - minX, groundH, 0.4, matBrick);
    addBox((minX + maxX) * 0.5, floorY, maxZ - 0.2, maxX - minX, groundH, 0.4, matBrick);

    // Street-facing wall with 2.4m-wide entrance (Z = -3.2..-0.8)
    addBox(minX + 0.2, floorY, -4.85, 0.4, groundH, 3.3, matBrick);    // Z = -6.5..-3.2
    addBox(minX + 0.2, floorY, 0.85, 0.4, groundH, 3.3, matBrick);     // Z = -0.8..+2.5
    addBox(minX + 0.2, floorY + 2.65, -2.0, 0.4, 1.05, 2.4, matBrick); // Overhead lintel
    // Door trim
    addBox(minX - 0.04, floorY, -3.25, 0.14, 2.65, 0.14, matDarkTimber, { collide: false });
    addBox(minX - 0.04, floorY, -0.75, 0.14, 2.65, 0.14, matDarkTimber, { collide: false });
    addBox(minX - 0.04, floorY + 2.62, -2.0, 0.16, 0.16, 2.65, matDarkTimber, { collide: false });

    // Overhanging Upper Timber Story & Pitched Slate Roof + Brick Chimney
    addBox((minX + maxX) * 0.5 - 0.25, floorY + groundH, (minZ + maxZ) * 0.5, maxX - minX + 0.5, 2.9, maxZ - minZ, matPlaster);
    addBox(minX - 0.52, floorY + groundH + 0.08, (minZ + maxZ) * 0.5, 0.1, 0.18, maxZ - minZ, matDarkTimber, { collide: false });
    addBox(minX - 0.52, floorY + groundH + 2.75, (minZ + maxZ) * 0.5, 0.1, 0.18, maxZ - minZ, matDarkTimber, { collide: false });
    addGabledRoof((minX + maxX) * 0.5 - 0.25, floorY + groundH + 2.9, (minZ + maxZ) * 0.5, maxX - minX + 1.1, 2.3, maxZ - minZ + 0.6);
    // Stone/Brick chimney stack
    addBox(maxX - 1.2, floorY + groundH + 2.7, maxZ - 1.2, 1.1, 3.4, 1.1, matBrick, { collide: false });

    // Windows & Tavern Sign
    addWindow(minX - 0.05, floorY + 1.65, -4.85, '-x', 1.4, 1.4);
    addWindow(minX - 0.05, floorY + 1.65, 0.85, '-x', 1.4, 1.4);
    addWindow(minX - 0.55, floorY + groundH + 1.45, -4.2, '-x', 1.2, 1.35);
    addWindow(minX - 0.55, floorY + groundH + 1.45, 0.2, '-x', 1.2, 1.35);
    addHangingSign(minX - 0.05, floorY + 3.05, -0.4, -1, signTavernTex);

    // Interior Props: Taproom Bar Counter, Kegs, Hearth & 2 Rustic Tables
    addBox(14.9, floorY, -3.3, 0.95, 1.05, 4.4, matDarkTimber);
    addBox(14.9, floorY + 1.05, -3.3, 1.08, 0.08, 4.5, matCopper, { collide: false });
    // Brass tap kegs behind counter
    addBarrel(16.0, floorY, -4.6);
    addBarrel(16.0, floorY, -3.7);
    // Stone hearth fireplace on south interior wall
    addBox(13.2, floorY, 1.85, 2.1, 2.4, 0.75, matSandstone);
    addBox(13.2, floorY + 0.15, 1.5, 0.95, 0.5, 0.25, matWarmLantern, { collide: false });
    // Two wooden tavern tables
    addBox(12.2, floorY, -4.5, 1.35, 0.78, 0.9, matTimber);
    addBox(12.2, floorY, -0.3, 1.35, 0.78, 0.9, matTimber);

    addBox(13.0, floorY + groundH - 0.55, -2.0, 0.28, 0.34, 0.28, matWarmLantern, { collide: false });
    const tavernLight = new THREE.PointLight(0xffb060, 3.6, 12, 1.8);
    tavernLight.position.set(13.0, floorY + groundH - 0.7, -2.0);
    group.add(tavernLight);
  }

  // =========================================================================
  // 4. EXTERIOR MODULAR BUILDINGS (Framing the rest of Harbourgate Lane)
  // =========================================================================

  // West Center: Aetheric Conduit & Horology Workshop (X = -17..-9.5, Z = -9.5..+2.0)
  {
    const cx = -13.25;
    const cz = -3.75;
    const w = 7.5;
    const d = 11.5;
    addBox(cx, 0.16, cz, w, 3.8, d, matBrick);
    addBox(cx + 0.2, 3.96, cz, w + 0.4, 3.1, d, matSandstone);
    addGabledRoof(cx + 0.2, 7.06, cz, w + 1.0, 2.2, d + 0.5);

    addWindow(-9.45, 1.9, -6.8, '+x', 1.6, 1.65);
    addWindow(-9.45, 1.9, -0.8, '+x', 1.6, 1.65);
    addWindow(-9.25, 5.5, -6.8, '+x', 1.2, 1.4);
    addWindow(-9.25, 5.5, -3.75, '+x', 1.2, 1.4);
    addWindow(-9.25, 5.5, -0.8, '+x', 1.2, 1.4);
    addHangingSign(-9.48, 3.2, -3.8, 1, signConduitTex);

    // Wall-mounted Mana Conduit Manifold & Copper Pipes (external mana infrastructure)
    addBox(-9.35, 1.15, -3.8, 0.35, 1.5, 0.9, matIron);
    addBox(-9.2, 1.6, -3.8, 0.18, 0.75, 0.28, matManaLamp, { collide: false });
    addBox(-9.38, 0.16, -3.8, 0.16, 1.0, 0.16, matCopper, { collide: false });
    addBox(-9.38, 2.85, -3.8, 0.14, 0.14, 10.5, matCopper, { collide: false });
  }

  // East South: Mariner's Trade House (3-story limestone & market awning, X = +9.5..+17, Z = +4.2..+16.5)
  {
    const cx = 13.25;
    const cz = 10.35;
    const w = 7.5;
    const d = 12.3;
    addBox(cx, 0.16, cz, w, 7.8, d, matSandstone);
    addBox(cx - 0.1, 7.96, cz, w + 0.4, 0.35, d + 0.4, matDarkTimber, { collide: false });
    addGabledRoof(cx, 8.31, cz, w + 0.8, 2.1, d + 0.5);

    addWindow(9.45, 2.0, 7.0, '-x', 1.4, 1.7);
    addWindow(9.45, 2.0, 13.5, '-x', 1.4, 1.7);
    addWindow(9.45, 5.6, 7.0, '-x', 1.25, 1.5);
    addWindow(9.45, 5.6, 10.35, '-x', 1.25, 1.5);
    addWindow(9.45, 5.6, 13.5, '-x', 1.25, 1.5);
    addHangingSign(9.48, 3.3, 10.35, -1, signTradeTex);

    // Market Stall Awning overhanging pavement + goods
    const awning = addBox(8.2, 2.65, 10.35, 2.6, 0.12, 4.4, matAwning, { collide: false });
    awning.rotation.z = 0.24;
    addBox(9.1, 0.16, 8.4, 0.14, 2.35, 0.14, matDarkTimber);
    addBox(9.1, 0.16, 12.3, 0.14, 2.35, 0.14, matDarkTimber);
    addCrate(8.4, 0.16, 9.6, 0.8, 0.1);
    addCrate(8.4, 0.16, 10.7, 0.8, -0.18);
    addBarrel(8.5, 0.16, 11.65);
  }

  // North West Harbour Watchhouse (X = -17..-9.5, Z = -22.5..-11.5)
  {
    addBox(-13.25, 0.16, -17.0, 7.5, 6.2, 11.0, matSandstone);
    addGabledRoof(-13.25, 6.36, -17.0, 8.2, 2.1, 11.4);
    addWindow(-9.45, 2.0, -14.5, '+x', 1.3, 1.5);
    addWindow(-9.45, 2.0, -19.2, '+x', 1.3, 1.5);
    addWindow(-9.45, 4.7, -17.0, '+x', 1.3, 1.35);
    addWindow(-13.25, 4.7, -22.55, '-z', 1.4, 1.4);
  }

  // North East Warehouse Annex with Loading Hoist (X = +9.5..+17, Z = -22.5..-9.0)
  {
    addBox(13.25, 0.16, -15.75, 7.5, 6.4, 13.5, matBrick);
    addGabledRoof(13.25, 6.56, -15.75, 8.2, 2.0, 13.9);
    // Timber hoist beam projecting over pavement
    addBox(8.6, 5.4, -15.5, 2.2, 0.22, 0.24, matDarkTimber, { collide: false });
    addCrate(8.6, 0.16, -15.5, 0.95, 0.08);
    addCrate(8.5, 0.16, -14.4, 0.78, -0.22);
    addBarrel(8.6, 0.16, -16.7);
    addWindow(9.45, 2.2, -12.0, '-x', 1.3, 1.4);
    addWindow(9.45, 2.2, -19.2, '-x', 1.3, 1.4);
  }

  // South Corner Buildings flanking the South Gate (Z = +15..+24.8)
  addBox(-13.25, 0.16, 19.6, 7.5, 6.8, 9.6, matBrick);
  addGabledRoof(-13.25, 6.96, 19.6, 8.1, 2.0, 10.0);
  addWindow(-9.45, 2.2, 18.0, '+x', 1.3, 1.5);
  addWindow(-9.45, 5.1, 18.0, '+x', 1.2, 1.35);

  addBox(13.25, 0.16, 20.8, 7.5, 6.0, 7.2, matSandstone);
  addGabledRoof(13.25, 6.16, 20.8, 8.1, 1.9, 7.6);
  addWindow(9.45, 2.2, 20.8, '-x', 1.3, 1.5);
  addWindow(9.45, 4.8, 20.8, '-x', 1.2, 1.35);

  // =========================================================================
  // 5. STREET LAMPS, BENCHES, NOTICE BOARD & INSTANCED BOLLARDS
  // =========================================================================
  const lampPositions: Array<[number, number]> = [
    [-5.0, 15.0],
    [-5.0, 1.5],
    [-5.0, -12.0],
    [5.0, 15.0],
    [5.0, -5.5],
    [5.0, -17.5],
  ];
  for (const [lx, lz] of lampPositions) {
    addStreetLamp(lx, 0.16, lz);
  }

  // Notice Board outside The Salt & Brass Tavern (foundation for Milestone 4+ interaction)
  {
    const nx = 9.05;
    const nz = 1.8;
    addBox(nx, 0.16, nz - 0.65, 0.12, 2.1, 0.12, matDarkTimber);
    addBox(nx, 0.16, nz + 0.65, 0.12, 2.1, 0.12, matDarkTimber);
    addBox(nx, 0.95, nz, 0.1, 1.05, 1.25, matTimber);
    addBox(nx - 0.06, 1.15, nz - 0.25, 0.03, 0.42, 0.32, matParchment, { collide: false });
    addBox(nx - 0.06, 1.42, nz + 0.22, 0.03, 0.34, 0.38, matParchment, { collide: false });
    addBox(nx, 2.25, nz, 0.45, 0.12, 1.65, matSlateRoof, { collide: false });
  }

  // Public Timber Benches facing the roadway
  const addBench = (x: number, z: number, backDir: -1 | 1): void => {
    addBox(x, 0.16, z, 0.55, 0.45, 1.75, matTimber);
    addBox(x + backDir * 0.22, 0.61, z, 0.1, 0.48, 1.75, matDarkTimber);
  };
  addBench(-8.9, 1.0, -1);
  addBench(8.9, -8.0, 1);

  // Instanced Stone Curb Bollards along the roadway edges (single draw call)
  const bollardGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.72, 8);
  disposables.push(bollardGeo);
  const bollardZ = [-20, -16, -9, -3, 4, 10, 19];
  const bollardInst = new THREE.InstancedMesh(bollardGeo, matSandstone, bollardZ.length * 2);
  bollardInst.castShadow = true;
  bollardInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let bIdx = 0;
  for (const bz of bollardZ) {
    for (const bx of [-4.85, 4.85]) {
      dummy.position.set(bx, 0.16 + 0.36, bz);
      dummy.updateMatrix();
      bollardInst.setMatrixAt(bIdx++, dummy.matrix);
      boxColliders.push({
        minX: bx - 0.18,
        maxX: bx + 0.18,
        minY: 0.16,
        maxY: 0.88,
        minZ: bz - 0.18,
        maxZ: bz + 0.18,
      });
    }
  }
  bollardInst.computeBoundingSphere();
  group.add(bollardInst);

  // =========================================================================
  // 6. DISTANT HARBOUR & METROPOLITAN SKYLINE SILHOUETTES (InstancedMesh)
  // =========================================================================
  const silGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(silGeo);
  const silhouettes: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [
    // Distant harbour piers & merchant ship hulls/masts beyond North overlook
    { x: -38, y: -1.8, z: -62, sx: 14, sy: 5, sz: 34 },
    { x: 42, y: -1.8, z: -74, sx: 16, sy: 6, sz: 42 },
    { x: -12, y: -1.8, z: -78, sx: 6, sy: 5, sz: 22 },  // Merchant vessel hull
    { x: -12, y: 3.2, z: -78, sx: 0.6, sy: 16, sz: 0.6 }, // Mast silhouette
    { x: 18, y: -1.8, z: -96, sx: 7, sy: 6, sz: 26 },
    { x: 18, y: 4.2, z: -96, sx: 0.7, sy: 18, sz: 0.7 },
    // Surrounding city roofline clusters East, West, and South
    { x: -34, y: 0, z: -12, sx: 16, sy: 18, sz: 24 },
    { x: -36, y: 0, z: 16, sx: 18, sy: 22, sz: 22 },
    { x: 34, y: 0, z: -14, sx: 16, sy: 20, sz: 26 },
    { x: 36, y: 0, z: 14, sx: 18, sy: 24, sz: 24 },
    { x: -18, y: 0, z: 46, sx: 22, sy: 20, sz: 18 },
    { x: 18, y: 0, z: 48, sx: 24, sy: 26, sz: 20 },
    { x: 64, y: 0, z: -48, sx: 14, sy: 34, sz: 14 }, // Distant harbour tower
  ];

  const silInst = new THREE.InstancedMesh(silGeo, matDistant, silhouettes.length);
  silhouettes.forEach((s, i) => {
    dummy.position.set(s.x, s.y + s.sy * 0.5, s.z);
    dummy.scale.set(s.sx, s.sy, s.sz);
    dummy.updateMatrix();
    silInst.setMatrixAt(i, dummy.matrix);
  });
  silInst.computeBoundingSphere();
  group.add(silInst);

  return {
    group,
    boxColliders,
    rampColliders,
    raycastTargets,
    spawnPoint: new THREE.Vector3(0, 0, 19),
    worldBoundsRadius: 25.0,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
