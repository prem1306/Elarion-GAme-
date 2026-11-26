import * as THREE from 'three';

export interface HarbourVistaHandle {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
}

interface AnimatedShip {
  mesh: THREE.Group;
  speed: number;
  direction: 1 | -1;
  minX: number;
  maxX: number;
  baseY: number;
  phase: number;
}

interface AnimatedCrane {
  boomPivot: THREE.Group;
  cable: THREE.Mesh;
  cargo: THREE.Group;
  baseYaw: number;
  phase: number;
}

interface SteamPuff {
  x: number;
  baseY: number;
  z: number;
  life: number;
  maxLife: number;
  riseSpeed: number;
  driftX: number;
}

/**
 * Industrial & Harbour Vista (Upgraded Realism + Expanded Perimeter Compatibility)
 * - Sculpted merchant ships (tapered bow stems, bowsprits, curved sails, rigging stays, quarterdecks, mana stern-fins)
 * - Articulated lattice-boom harbour cranes with pulley sheaves & cyan mana accumulator tanks
 * - Elevated mana-railway viaduct & realistic multi-car freight train (cylindrical boiler locomotive + copper tankers)
 * - West Industrial Refinery skyline, banded storage silos, spinning copper flywheel, & 7 steam-plume chimneys
 * - Distant harbour breakwaters, lighthouse beacon, and outer metropolitan skyline outside playable bounds
 */
export function buildElarionHarbourVista(): HarbourVistaHandle {
  const group = new THREE.Group();
  group.name = 'Elarion_Industrial_Harbour_Vista';

  const disposables: Array<{ dispose: () => void }> = [];
  const animatedShips: AnimatedShip[] = [];
  const animatedCranes: AnimatedCrane[] = [];
  const steamPuffs: SteamPuff[] = [];

  const matQuayStone = new THREE.MeshStandardMaterial({ color: 0x676b70, roughness: 0.88, metalness: 0.04 });
  const matDarkBrick = new THREE.MeshStandardMaterial({ color: 0x4f3b36, roughness: 0.86, metalness: 0.06 });
  const matSlate = new THREE.MeshStandardMaterial({ color: 0x2d3540, roughness: 0.74, metalness: 0.14 });
  const matLimestone = new THREE.MeshStandardMaterial({ color: 0xa69e90, roughness: 0.84, metalness: 0.04 });
  const matIron = new THREE.MeshStandardMaterial({ color: 0x242a30, roughness: 0.45, metalness: 0.80 });
  const matCopper = new THREE.MeshStandardMaterial({ color: 0xb27347, roughness: 0.32, metalness: 0.86 });
  const matTimber = new THREE.MeshStandardMaterial({ color: 0x5c4331, roughness: 0.80, metalness: 0.04 });
  const matDarkTimber = new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.78, metalness: 0.05 });
  const matSail = new THREE.MeshStandardMaterial({
    color: 0xd3cbb9,
    roughness: 0.90,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const matManaGlow = new THREE.MeshStandardMaterial({
    color: 0x76d6e6,
    emissive: 0x3b96ab,
    emissiveIntensity: 1.15,
    roughness: 0.22,
    metalness: 0.2,
  });
  const matAmberLight = new THREE.MeshStandardMaterial({
    color: 0xf9cf88,
    emissive: 0xdf9238,
    emissiveIntensity: 1.25,
    roughness: 0.28,
    metalness: 0.06,
  });
  const matDistantCity = new THREE.MeshStandardMaterial({ color: 0x3a434e, roughness: 0.92, metalness: 0.04 });
  const matSteam = new THREE.MeshStandardMaterial({
    color: 0xd8dfe6,
    transparent: true,
    opacity: 0.38,
    roughness: 0.95,
    metalness: 0.0,
    depthWrite: false,
  });

  disposables.push(
    matQuayStone,
    matDarkBrick,
    matSlate,
    matLimestone,
    matIron,
    matCopper,
    matTimber,
    matDarkTimber,
    matSail,
    matManaGlow,
    matAmberLight,
    matDistantCity,
    matSteam
  );

  const addBox = (
    parent: THREE.Object3D,
    x: number,
    baseY: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material
  ): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(w, h, d);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, baseY + h * 0.5, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // =========================================================================
  // 1. LOWER HARBOUR QUAY, 3 WALKABLE PIERS & SCULPTED WAREHOUSES
  // =========================================================================
  // Quay apron (X = -94..+94, Z = -62.5..-34.0, top y = -0.30)
  addBox(group, 0, -2.2, -48.25, 188, 1.9, 28.5, matQuayStone);
  // Walkable West Cargo Pier (X = -35..-21, Z = -96..-62.5, top y = -0.30)
  addBox(group, -28, -2.2, -79.25, 14, 1.9, 33.5, matQuayStone);
  // Walkable Central Shipyard Pier (X = -8..+8, Z = -88..-62.5, top y = -0.30)
  addBox(group, 0, -2.2, -75.25, 16, 1.9, 25.5, matQuayStone);
  // Walkable East Cargo Pier (X = +15..+29, Z = -96..-62.5, top y = -0.30)
  addBox(group, 22, -2.2, -79.25, 14, 1.9, 33.5, matQuayStone);
  // Outer East Pier (non-playable background pier)
  addBox(group, 108, -2.2, -68, 18, 1.9, 28, matQuayStone);

  const buildWarehouse = (cx: number, cz: number, w: number, h: number, d: number): void => {
    const wh = new THREE.Group();
    wh.position.set(cx, -0.3, cz);
    addBox(wh, 0, 0, 0, w, h, d, matDarkBrick);

    // Stone plinth skirt & corner pilasters
    addBox(wh, 0, 0, 0, w + 0.25, 0.85, d + 0.25, matLimestone);
    for (const px of [-w * 0.48, 0, w * 0.48]) {
      for (const pz of [-d * 0.5, d * 0.5]) {
        addBox(wh, px, 0, pz, 0.7, h, 0.35, matLimestone);
      }
    }

    const roofShape = new THREE.Shape();
    roofShape.moveTo(-w * 0.53, 0);
    roofShape.lineTo(w * 0.53, 0);
    roofShape.lineTo(0, 2.8);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.7, bevelEnabled: false });
    roofGeo.translate(0, 0, -(d + 0.7) * 0.5);
    disposables.push(roofGeo);
    const roof = new THREE.Mesh(roofGeo, matSlate);
    roof.position.y = h;
    wh.add(roof);

    // Clerestory lantern & arched timber cargo bay doors
    addBox(wh, 0, h + 1.75, 0, w * 0.30, 1.35, d * 0.72, matIron);
    addBox(wh, 0, h + 2.15, 0, w * 0.22, 0.45, d * 0.64, matAmberLight);
    addBox(wh, 0, 0, d * 0.5 + 0.08, w * 0.28, h * 0.62, 0.18, matDarkTimber);
    addBox(wh, 0, 0, -d * 0.5 - 0.08, w * 0.28, h * 0.62, 0.18, matDarkTimber);
    addBox(wh, 0, h * 0.72, d * 0.5 + 0.12, w * 0.65, 0.22, 0.14, matCopper);
    group.add(wh);
  };

  // West Quay Warehouse: X = -61..-39, Z = -57..-43
  buildWarehouse(-50, -50, 22, 7.2, 14);
  // Shipwright Drydock Shed: X = -86..-66, Z = -57..-43
  buildWarehouse(-76, -50, 20, 6.8, 14);
  // East Freight Warehouse: X = +33..+55, Z = -57..-43
  buildWarehouse(44, -50, 22, 7.4, 14);
  // Harbour Mariners Guildhall: X = +62..+84, Z = -57..-43
  buildWarehouse(73, -50, 22, 7.8, 14);
  // West Pier Warehouse: X = -31.8..-24.2, Z = -83.75..-70.25
  buildWarehouse(-28, -77, 7.6, 5.2, 13.5);

  // =========================================================================
  // 2. ARTICULATED HARBOUR CARGO CRANES (Lattice Boom, Counterweight, Mana Tank)
  // =========================================================================
  const buildHarbourCrane = (
    x: number,
    y: number,
    z: number,
    baseYaw: number,
    animated: boolean,
    phase: number
  ): void => {
    const crane = new THREE.Group();
    crane.position.set(x, y, z);

    const legGeo = new THREE.CylinderGeometry(0.22, 0.28, 5.4, 6);
    const crossGeo = new THREE.BoxGeometry(3.6, 0.22, 0.22);
    const deckGeo = new THREE.BoxGeometry(4.3, 0.48, 4.3);
    const cabGeo = new THREE.BoxGeometry(2.6, 2.25, 2.7);
    const counterGeo = new THREE.BoxGeometry(2.3, 1.35, 1.15);
    const tankGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.65, 10);
    const boomSparGeo = new THREE.BoxGeometry(0.22, 0.24, 14.0);
    const boomBraceGeo = new THREE.BoxGeometry(0.95, 0.14, 0.14);
    const sheaveGeo = new THREE.TorusGeometry(0.32, 0.08, 6, 12);
    const cableGeo = new THREE.CylinderGeometry(0.05, 0.05, 5.5, 6);
    const crateGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
    disposables.push(
      legGeo,
      crossGeo,
      deckGeo,
      cabGeo,
      counterGeo,
      tankGeo,
      boomSparGeo,
      boomBraceGeo,
      sheaveGeo,
      cableGeo,
      crateGeo
    );

    for (const lx of [-1.7, 1.7]) {
      for (const lz of [-1.7, 1.7]) {
        const leg = new THREE.Mesh(legGeo, matIron);
        leg.position.set(lx, 2.6, lz);
        crane.add(leg);
      }
    }
    const braceA = new THREE.Mesh(crossGeo, matIron);
    braceA.position.set(0, 3.6, 1.7);
    const braceB = new THREE.Mesh(crossGeo, matIron);
    braceB.position.set(0, 3.6, -1.7);
    crane.add(braceA, braceB);

    const deck = new THREE.Mesh(deckGeo, matIron);
    deck.position.y = 5.2;
    crane.add(deck);

    const boomPivot = new THREE.Group();
    boomPivot.position.y = 5.45;
    boomPivot.rotation.y = baseYaw;

    const cab = new THREE.Mesh(cabGeo, matCopper);
    cab.position.set(0, 1.12, -0.35);
    const counterweight = new THREE.Mesh(counterGeo, matQuayStone);
    counterweight.position.set(0, 0.85, -2.05);
    const manaTank = new THREE.Mesh(tankGeo, matManaGlow);
    manaTank.position.set(0, 1.9, -1.9);

    // Twin truss boom spars + cross rungs + top pulley sheave
    const boomHolder = new THREE.Group();
    boomHolder.position.set(0, 4.45, 4.9);
    boomHolder.rotation.x = -0.52;
    for (const sx of [-0.38, 0.38]) {
      const spar = new THREE.Mesh(boomSparGeo, matDarkTimber);
      spar.position.x = sx;
      boomHolder.add(spar);
    }
    for (let bz = -5.5; bz <= 5.5; bz += 1.8) {
      const rung = new THREE.Mesh(boomBraceGeo, matIron);
      rung.position.z = bz;
      boomHolder.add(rung);
    }
    const sheave = new THREE.Mesh(sheaveGeo, matCopper);
    sheave.rotation.y = Math.PI / 2;
    sheave.position.set(0, 0.15, 7.0);
    boomHolder.add(sheave);

    const cable = new THREE.Mesh(cableGeo, matIron);
    cable.position.set(0, 4.7, 10.6);

    const cargo = new THREE.Group();
    cargo.position.set(0, 1.85, 10.6);
    const crate = new THREE.Mesh(crateGeo, matTimber);
    cargo.add(crate);

    boomPivot.add(cab, counterweight, manaTank, boomHolder, cable, cargo);
    crane.add(boomPivot);
    group.add(crane);

    if (animated) {
      animatedCranes.push({ boomPivot, cable, cargo, baseYaw, phase });
    }
  };

  buildHarbourCrane(-28, -0.3, -58, 0.45, true, 0);
  buildHarbourCrane(22, -0.3, -65.5, -0.55, true, 2.1);
  buildHarbourCrane(-4, -0.3, -56, 0.15, false, 0);
  buildHarbourCrane(106, -0.3, -59, -0.35, false, 0);

  // =========================================================================
  // 3. REALISTIC MERCHANT SHIPS (Sculpted Hulls, Bowsprits, Rigging, Curved Sails)
  // =========================================================================
  const buildShip = (scale = 1.0, sailsOpen = false): THREE.Group => {
    const ship = new THREE.Group();

    // Sculpted extruded hull cross-section + tapered bow prow
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-12.2, 0.0);
    hullShape.lineTo(10.5, 0.0);
    hullShape.lineTo(15.6, 3.8);
    hullShape.lineTo(15.0, 4.4);
    hullShape.lineTo(-12.5, 4.3);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 6.4,
      bevelEnabled: true,
      bevelSize: 0.45,
      bevelThickness: 0.45,
      bevelSegments: 2,
    });
    hullGeo.translate(0, -0.5, -3.2);
    hullGeo.scale(scale, scale, scale);

    const deckPlankGeo = new THREE.BoxGeometry(23.5 * scale, 0.25 * scale, 6.2 * scale);
    const gunwaleGeo = new THREE.BoxGeometry(24.2 * scale, 0.52 * scale, 0.28 * scale);
    const bowspritGeo = new THREE.CylinderGeometry(0.11 * scale, 0.24 * scale, 7.2 * scale, 7);
    const sternCabinGeo = new THREE.BoxGeometry(5.8 * scale, 2.7 * scale, 5.8 * scale);
    const cabinRoofGeo = new THREE.BoxGeometry(6.2 * scale, 0.28 * scale, 6.2 * scale);
    const cabinWinGeo = new THREE.BoxGeometry(0.14 * scale, 0.9 * scale, 1.1 * scale);
    const mastGeo = new THREE.CylinderGeometry(0.16 * scale, 0.28 * scale, 16.5 * scale, 8);
    const crowsNestGeo = new THREE.CylinderGeometry(0.75 * scale, 0.55 * scale, 0.65 * scale, 8);
    const yardGeo = new THREE.CylinderGeometry(0.11 * scale, 0.11 * scale, 8.6 * scale, 7);
    // Billowing curved sail arc
    const sailGeo = new THREE.CylinderGeometry(
      5.2 * scale,
      5.2 * scale,
      7.4 * scale,
      8,
      1,
      true,
      -Math.PI * 0.22,
      Math.PI * 0.44
    );
    const stayGeo = new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 13.8 * scale, 5);
    const sternManaGeo = new THREE.CylinderGeometry(0.45 * scale, 0.72 * scale, 2.1 * scale, 8);

    disposables.push(
      hullGeo,
      deckPlankGeo,
      gunwaleGeo,
      bowspritGeo,
      sternCabinGeo,
      cabinRoofGeo,
      cabinWinGeo,
      mastGeo,
      crowsNestGeo,
      yardGeo,
      sailGeo,
      stayGeo,
      sternManaGeo
    );

    const hull = new THREE.Mesh(hullGeo, matTimber);
    const deck = new THREE.Mesh(deckPlankGeo, matDarkTimber);
    deck.position.set(0.5 * scale, 3.85 * scale, 0);
    const gunL = new THREE.Mesh(gunwaleGeo, matCopper);
    gunL.position.set(0.4 * scale, 4.2 * scale, 3.1 * scale);
    const gunR = new THREE.Mesh(gunwaleGeo, matCopper);
    gunR.position.set(0.4 * scale, 4.2 * scale, -3.1 * scale);

    const bowsprit = new THREE.Mesh(bowspritGeo, matTimber);
    bowsprit.rotation.z = -Math.PI / 2 + 0.34;
    bowsprit.position.set(17.4 * scale, 5.1 * scale, 0);

    const cabin = new THREE.Mesh(sternCabinGeo, matDarkBrick);
    cabin.position.set(-9.2 * scale, 5.2 * scale, 0);
    const cabinRoof = new THREE.Mesh(cabinRoofGeo, matSlate);
    cabinRoof.position.set(-9.2 * scale, 6.65 * scale, 0);

    // Stern transom warm cabin windows
    for (const wz of [-1.8 * scale, 0, 1.8 * scale]) {
      const win = new THREE.Mesh(cabinWinGeo, matAmberLight);
      win.position.set(-12.15 * scale, 5.35 * scale, wz);
      ship.add(win);
    }

    const sternFin = new THREE.Mesh(sternManaGeo, matManaGlow);
    sternFin.rotation.z = Math.PI / 2;
    sternFin.position.set(-12.6 * scale, 2.2 * scale, 0);

    ship.add(hull, deck, gunL, gunR, bowsprit, cabin, cabinRoof, sternFin);

    for (const [mx, mh] of [
      [-4.2 * scale, 0.94],
      [2.2 * scale, 1.08],
      [8.2 * scale, 0.92],
    ]) {
      const mast = new THREE.Mesh(mastGeo, matTimber);
      mast.scale.y = mh;
      mast.position.set(mx, 3.8 * scale + 8.0 * scale * mh, 0);
      ship.add(mast);

      const nest = new THREE.Mesh(crowsNestGeo, matDarkTimber);
      nest.position.set(mx, 12.8 * scale * mh, 0);
      ship.add(nest);

      // Forward rigging stay
      const stay = new THREE.Mesh(stayGeo, matIron);
      stay.position.set(mx + 2.6 * scale, 9.5 * scale, 0);
      stay.rotation.z = -0.38;
      ship.add(stay);

      for (const my of [8.8 * scale, 13.4 * scale * mh]) {
        const yard = new THREE.Mesh(yardGeo, matDarkTimber);
        yard.rotation.x = Math.PI / 2;
        yard.position.set(mx, my, 0);
        ship.add(yard);

        if (sailsOpen) {
          const sail = new THREE.Mesh(sailGeo, matSail);
          sail.rotation.z = Math.PI / 2;
          sail.rotation.y = Math.PI / 2;
          sail.position.set(mx - 2.6 * scale, my - 2.35 * scale, 0);
          ship.add(sail);
        }
      }
    }

    return ship;
  };

  // Moored alongside West, Central & East walkable piers!
  const mooredA = buildShip(1.02, false);
  mooredA.position.set(-39.6, -1.9, -81.0);
  mooredA.rotation.y = Math.PI / 2;
  group.add(mooredA);

  const mooredB = buildShip(0.98, false);
  mooredB.position.set(33.6, -1.9, -81.0);
  mooredB.rotation.y = -Math.PI / 2;
  group.add(mooredB);

  const mooredC = buildShip(0.72, false);
  mooredC.position.set(-13.2, -1.9, -78.0);
  mooredC.rotation.y = Math.PI / 2;
  group.add(mooredC);

  const shipInbound = buildShip(1.18, true);
  shipInbound.position.set(-65, -1.9, -124);
  group.add(shipInbound);
  animatedShips.push({
    mesh: shipInbound,
    speed: 3.4,
    direction: 1,
    minX: -175,
    maxX: 175,
    baseY: -1.9,
    phase: 0,
  });

  const shipOutbound = buildShip(1.28, true);
  shipOutbound.position.set(55, -1.9, -156);
  shipOutbound.rotation.y = Math.PI;
  group.add(shipOutbound);
  animatedShips.push({
    mesh: shipOutbound,
    speed: 2.8,
    direction: -1,
    minX: -185,
    maxX: 185,
    baseY: -1.9,
    phase: 1.7,
  });

  // =========================================================================
  // 4. ELEVATED MANA-POWERED RAILWAY VIADUCT & REALISTIC FREIGHT TRAIN
  // =========================================================================
  const viaductZ = -34.5;
  const deckY = 5.8;

  addBox(group, 0, deckY, viaductZ, 266, 1.1, 4.4, matQuayStone);
  addBox(group, 0, deckY + 1.1, viaductZ - 1.95, 266, 0.55, 0.3, matLimestone);
  addBox(group, 0, deckY + 1.1, viaductZ + 1.95, 266, 0.55, 0.3, matLimestone);
  addBox(group, 0, deckY + 1.1, viaductZ - 0.85, 266, 0.14, 0.14, matIron);
  addBox(group, 0, deckY + 1.1, viaductZ + 0.85, 266, 0.14, 0.14, matIron);
  addBox(group, 0, deckY + 1.1, viaductZ, 266, 0.12, 0.24, matCopper);

  const pierGeo = new THREE.BoxGeometry(2.2, 6.4, 4.2);
  disposables.push(pierGeo);
  const pierXs: number[] = [];
  for (let px = -126; px <= 127; px += 11) {
    pierXs.push(px);
  }
  const pierInst = new THREE.InstancedMesh(pierGeo, matQuayStone, pierXs.length);
  const dummy = new THREE.Object3D();
  pierXs.forEach((px, i) => {
    dummy.position.set(px, -0.3 + 3.05, viaductZ);
    dummy.updateMatrix();
    pierInst.setMatrixAt(i, dummy.matrix);
  });
  pierInst.computeBoundingSphere();
  group.add(pierInst);

  // Realistic Animated Mana Freight Train (Cylindrical Boiler Locomotive + 4 Freight Cars)
  const trainGroup = new THREE.Group();
  trainGroup.position.set(-20, deckY + 1.24, viaductZ);
  {
    const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.16, 12);
    const boilerGeo = new THREE.CylinderGeometry(0.86, 0.86, 4.4, 14);
    const bandGeo = new THREE.CylinderGeometry(0.91, 0.91, 0.16, 14);
    const domeGeo = new THREE.SphereGeometry(0.44, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const stackGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.95, 10);
    const cowGeo = new THREE.ConeGeometry(1.05, 1.2, 4);
    disposables.push(wheelGeo, boilerGeo, bandGeo, domeGeo, stackGeo, cowGeo);

    // Locomotive chassis, boiler, brass dome, cowcatcher & cab
    addBox(trainGroup, 0, 0.35, 0, 7.6, 0.42, 2.35, matIron);
    addBox(trainGroup, -2.35, 0.77, 0, 2.4, 2.25, 2.3, matCopper);
    addBox(trainGroup, -2.35, 3.02, 0, 2.7, 0.22, 2.55, matSlate);

    const boiler = new THREE.Mesh(boilerGeo, matIron);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(1.1, 1.55, 0);
    trainGroup.add(boiler);

    for (const bx of [0.1, 1.15, 2.2]) {
      const band = new THREE.Mesh(bandGeo, bx === 1.15 ? matManaGlow : matCopper);
      band.rotation.z = Math.PI / 2;
      band.position.set(bx, 1.55, 0);
      trainGroup.add(band);
    }

    const dome = new THREE.Mesh(domeGeo, matCopper);
    dome.position.set(0.35, 2.35, 0);
    const stack = new THREE.Mesh(stackGeo, matIron);
    stack.position.set(2.75, 2.55, 0);
    const cow = new THREE.Mesh(cowGeo, matIron);
    cow.rotation.z = -Math.PI / 2;
    cow.rotation.x = Math.PI / 4;
    cow.position.set(4.15, 0.55, 0);
    trainGroup.add(dome, stack, cow);
    addBox(trainGroup, 3.45, 1.45, 0, 0.25, 0.48, 0.48, matAmberLight);

    for (const wx of [-2.8, -1.2, 0.5, 2.1]) {
      for (const wz of [-1.05, 1.05]) {
        const w = new THREE.Mesh(wheelGeo, matIron);
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.36, wz);
        trainGroup.add(w);
      }
    }

    for (let c = 1; c <= 4; c++) {
      const cx = -c * 7.8;
      addBox(trainGroup, cx, 0.32, 0, 6.4, 0.36, 2.2, matIron);
      for (const wx of [cx - 2.0, cx + 2.0]) {
        for (const wz of [-1.0, 1.0]) {
          const w = new THREE.Mesh(wheelGeo, matIron);
          w.rotation.x = Math.PI / 2;
          w.position.set(wx, 0.32, wz);
          trainGroup.add(w);
        }
      }
      if (c % 2 === 1) {
        addBox(trainGroup, cx - 1.2, 0.68, 0, 2.2, 1.45, 1.75, matTimber);
        addBox(trainGroup, cx + 1.3, 0.68, 0, 2.1, 1.2, 1.75, matDarkBrick);
      } else {
        const tankGeo = new THREE.CylinderGeometry(0.78, 0.78, 5.2, 12);
        disposables.push(tankGeo);
        const tank = new THREE.Mesh(tankGeo, matCopper);
        tank.rotation.z = Math.PI / 2;
        tank.position.set(cx, 1.45, 0);
        const tankBand = new THREE.Mesh(bandGeo, matManaGlow);
        tankBand.rotation.z = Math.PI / 2;
        tankBand.position.set(cx, 1.45, 0);
        trainGroup.add(tank, tankBand);
      }
    }
  }
  group.add(trainGroup);

  // =========================================================================
  // 5. WEST INDUSTRIAL QUARTER (Silos, Flywheel, Refinery Halls & 8 Chimneys)
  // =========================================================================
  const indGroup = new THREE.Group();
  indGroup.name = 'Industrial_Quarter_Skyline';
  group.add(indGroup);

  // Northwest industrial harbour quay connector (strictly along Z = -43, X = -132..-92)
  addBox(indGroup, -112, -2.0, -43, 40, 1.7, 34, matQuayStone);

  // Pump House beside Silos: X = -56.75..-51.25, Z = -23..-9 (collider synced in DistrictBlock)
  addBox(indGroup, -54.0, 0.16, -16.0, 5.5, 8.8, 14.0, matDarkBrick);
  addBox(indGroup, -54.0, 8.96, -16.0, 6.0, 1.1, 14.5, matSlate);

  // Main Western Refinery Hall: X = -87..-67, Z = -27..-11 (collider synced in DistrictBlock)
  addBox(indGroup, -77.0, 0.16, -19.0, 20.0, 10.6, 16.0, matDarkBrick);
  addBox(indGroup, -77.0, 10.76, -19.0, 21.0, 1.5, 16.8, matSlate);

  // Heavy Boiler Works Hall: X = -124..-104, Z = -26..-8 (collider synced in DistrictBlock)
  addBox(indGroup, -114.0, 0.16, -17.0, 20.0, 11.4, 18.0, matDarkBrick);
  addBox(indGroup, -114.0, 11.56, -17.0, 21.0, 1.6, 18.8, matSlate);

  // Overhead Copper Mana Conduits linking Boiler Works <-> Refinery Hall <-> Pump House <-> Silos
  addBox(indGroup, -62.0, 7.6, -16.0, 17.0, 0.75, 0.75, matCopper);
  addBox(indGroup, -49.5, 7.6, -15.5, 6.5, 0.65, 9.2, matCopper);
  addBox(indGroup, -95.0, 9.4, -18.0, 20.0, 0.85, 0.85, matCopper);

  // 4 Banded Mana Storage Silos inside playable Yard (colliders synced in DistrictBlock!)
  const siloGeo = new THREE.CylinderGeometry(2.8, 2.8, 10.8, 14);
  const siloDomeGeo = new THREE.SphereGeometry(2.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const siloRingGeo = new THREE.CylinderGeometry(2.96, 2.96, 0.42, 14);
  const siloRibGeo = new THREE.CylinderGeometry(2.92, 2.92, 0.22, 14);
  disposables.push(siloGeo, siloDomeGeo, siloRingGeo, siloRibGeo);

  for (const [sx, sz] of [
    [-47.0, -11.5],
    [-47.0, -19.5],
    [-97.0, -11.5],
    [-97.0, -19.5],
  ]) {
    const silo = new THREE.Mesh(siloGeo, matIron);
    silo.position.set(sx, 0.16 + 5.4, sz);
    const dome = new THREE.Mesh(siloDomeGeo, matCopper);
    dome.position.set(sx, 0.16 + 10.8, sz);
    const ring = new THREE.Mesh(siloRingGeo, matManaGlow);
    ring.position.set(sx, 0.16 + 8.4, sz);
    const ribA = new THREE.Mesh(siloRibGeo, matCopper);
    ribA.position.set(sx, 0.16 + 3.2, sz);
    const ribB = new THREE.Mesh(siloRibGeo, matCopper);
    ribB.position.set(sx, 0.16 + 5.8, sz);
    indGroup.add(silo, dome, ring, ribA, ribB);
  }

  // Spinning Copper Flywheel mounted on East face of Pump House (x = -51.1, z = -16.0)
  const flywheelPivot = new THREE.Group();
  flywheelPivot.position.set(-51.1, 5.4, -16.0);
  const wheelGeo = new THREE.TorusGeometry(2.45, 0.28, 10, 22);
  const spokeGeo = new THREE.BoxGeometry(0.24, 4.7, 0.24);
  const hubGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.48, 10);
  disposables.push(wheelGeo, spokeGeo, hubGeo);
  const wheel = new THREE.Mesh(wheelGeo, matCopper);
  wheel.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(hubGeo, matIron);
  hub.rotation.z = Math.PI / 2;
  flywheelPivot.add(wheel, hub);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, matIron);
    spoke.rotation.x = (i * Math.PI) / 3;
    flywheelPivot.add(spoke);
  }
  indGroup.add(flywheelPivot);

  const chimneySpecs: Array<{ x: number; z: number; h: number; r: number; isMana: boolean }> = [
    { x: -73, z: -24, h: 24, r: 1.1, isMana: false },
    { x: -82, z: -23, h: 28, r: 1.2, isMana: false },
    { x: -80, z: -14, h: 21, r: 0.95, isMana: true },
    { x: -110, z: -22, h: 30, r: 1.25, isMana: false },
    { x: -118, z: -14, h: 25, r: 1.1, isMana: true },
    { x: -206, z: 46, h: 36, r: 1.5, isMana: false },
    { x: -196, z: 62, h: 32, r: 1.35, isMana: true },
    { x: -214, z: 92, h: 28, r: 1.2, isMana: false },
  ];

  chimneySpecs.forEach((ch) => {
    const bodyGeo = new THREE.CylinderGeometry(ch.r * 0.72, ch.r, ch.h, 10);
    const rimGeo = new THREE.CylinderGeometry(ch.r * 0.88, ch.r * 0.78, 0.95, 10);
    disposables.push(bodyGeo, rimGeo);

    const body = new THREE.Mesh(bodyGeo, matDarkBrick);
    body.position.set(ch.x, 0.16 + ch.h * 0.5, ch.z);
    const rim = new THREE.Mesh(rimGeo, ch.isMana ? matCopper : matIron);
    rim.position.set(ch.x, 0.16 + ch.h + 0.35, ch.z);
    indGroup.add(body, rim);

    for (let p = 0; p < 5; p++) {
      steamPuffs.push({
        x: ch.x,
        baseY: 0.16 + ch.h + 0.85,
        z: ch.z,
        life: p * 1.4,
        maxLife: 7.0,
        riseSpeed: 1.65 + (p % 2) * 0.25,
        driftX: 0.65,
      });
    }
  });

  const puffGeo = new THREE.DodecahedronGeometry(1.0, 0);
  disposables.push(puffGeo);
  const puffInst = new THREE.InstancedMesh(puffGeo, matSteam, steamPuffs.length);
  puffInst.frustumCulled = false;
  group.add(puffInst);

  // =========================================================================
  // 6. NORTHERN MARITIME HORIZON & GREEN HIGHLAND RIDGES
  // Grey exterior boxes removed; West/South/East transition into lush green wilds.
  // =========================================================================
  const silGeo = new THREE.BoxGeometry(1, 1, 1);
  const ridgeGeo = new THREE.ConeGeometry(1, 1, 6);
  const matDomainRidge = new THREE.MeshStandardMaterial({ color: 0x2d4a36, roughness: 0.94, metalness: 0.02 });
  disposables.push(silGeo, ridgeGeo, matDomainRidge);

  const distantBlocks: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [
    // Outer Breakwaters & Grand Lighthouse (North Sea Bayfront)
    { x: -140, y: -2.0, z: -190, sx: 105, sy: 4.5, sz: 12 },
    { x: 135, y: -2.0, z: -196, sx: 110, sy: 4.5, sz: 12 },
    { x: 74, y: 2.0, z: -194, sx: 7.5, sy: 28, sz: 7.5 },
    // Distant Sailing Ship Silhouettes
    { x: -102, y: -1.9, z: -168, sx: 22, sy: 4.5, sz: 6 },
    { x: -102, y: 2.6, z: -168, sx: 0.6, sy: 14, sz: 0.6 },
    { x: 104, y: -1.9, z: -172, sx: 24, sy: 5.0, sz: 6.5 },
    { x: 104, y: 3.1, z: -172, sx: 0.6, sy: 15, sz: 0.6 },
  ];

  const distantInst = new THREE.InstancedMesh(silGeo, matDistantCity, distantBlocks.length);
  distantBlocks.forEach((b, i) => {
    dummy.position.set(b.x, b.y + b.sy * 0.5, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    distantInst.setMatrixAt(i, dummy.matrix);
  });
  distantInst.computeBoundingSphere();
  group.add(distantInst);

  // Forested Vaelcrest Domain Highland Ridges framing the distant West/South/East horizon
  const ridgeSpecs: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i < 40; i++) {
    const angle = -0.22 * Math.PI + (i / 39) * (Math.PI * 1.44);
    const radius = 840 + ((i * 73) % 280);
    const rx = Math.cos(angle) * radius;
    const rz = 260 + Math.sin(angle) * radius * 0.88;
    const peakH = 95 + ((i * 47) % 120);
    const peakR = 230 + ((i * 31) % 110);
    ridgeSpecs.push([rx, rz, peakR, peakH, i * 0.4]);
  }
  const ridgeInst = new THREE.InstancedMesh(ridgeGeo, matDomainRidge, ridgeSpecs.length);
  ridgeSpecs.forEach(([rx, rz, pr, ph, rot], i) => {
    dummy.position.set(rx, ph * 0.36 - 4.0, rz);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(pr, ph, pr * 0.84);
    dummy.updateMatrix();
    ridgeInst.setMatrixAt(i, dummy.matrix);
  });
  ridgeInst.computeBoundingSphere();
  group.add(ridgeInst);

  // =========================================================================
  // 7. LIGHTWEIGHT LOOPING VISTA ANIMATIONS
  // =========================================================================
  let simTime = 0;
  let trainX = -20;

  const update = (dt: number): void => {
    const clampedDt = Math.min(dt, 0.05);
    simTime += clampedDt;

    trainX += clampedDt * 9.5;
    if (trainX > 112) {
      trainX = -98;
    }
    trainGroup.position.x = trainX;

    flywheelPivot.rotation.x += clampedDt * 0.9;

    for (const c of animatedCranes) {
      const s = Math.sin(simTime * 0.45 + c.phase);
      c.boomPivot.rotation.y = c.baseYaw + s * 0.32;
      const hoistY = Math.sin(simTime * 0.9 + c.phase) * 0.75;
      c.cargo.position.y = 1.85 + hoistY;
      c.cable.scale.y = 1 - hoistY * 0.14;
      c.cable.position.y = 4.7 + hoistY * 0.45;
    }

    for (const ship of animatedShips) {
      ship.mesh.position.x += ship.speed * ship.direction * clampedDt;
      if (ship.direction === 1 && ship.mesh.position.x > ship.maxX) {
        ship.mesh.position.x = ship.minX;
      } else if (ship.direction === -1 && ship.mesh.position.x < ship.minX) {
        ship.mesh.position.x = ship.maxX;
      }
      ship.mesh.rotation.z = Math.sin(simTime * 0.8 + ship.phase) * 0.02;
      ship.mesh.position.y = ship.baseY + Math.sin(simTime * 1.1 + ship.phase) * 0.12;
    }

    for (let i = 0; i < steamPuffs.length; i++) {
      const p = steamPuffs[i];
      p.life += clampedDt;
      if (p.life >= p.maxLife) {
        p.life = 0;
      }
      const progress = p.life / p.maxLife;
      const py = p.baseY + progress * (p.riseSpeed * p.maxLife);
      const px = p.x + progress * p.driftX * p.maxLife;
      const pz = p.z + Math.sin(simTime + i) * 0.35;
      const scale = (0.75 + progress * 2.1) * Math.sin(progress * Math.PI);

      dummy.position.set(px, py, pz);
      dummy.rotation.set(simTime * 0.3 + i, simTime * 0.2, 0);
      dummy.scale.setScalar(Math.max(0.01, scale));
      dummy.updateMatrix();
      puffInst.setMatrixAt(i, dummy.matrix);
    }
    puffInst.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
