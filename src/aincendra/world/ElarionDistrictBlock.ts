import * as THREE from 'three';
import type {
  BoxCollider,
  CombatDummySpec,
  GreyboxWorldData,
  InteractableSpec,
  NpcSpawnSpec,
  RampCollider,
} from '../core/types';
import { buildElarionHarbourVista } from './ElarionHarbourVista';
import { ElarionSculptedBuilders } from './ElarionModelBuilders';
import { PickablePropSystem, type PickablePropSpec } from './PickableProps';
import {
  createBrickTexturePair,
  createCobbleTexturePair,
  createMarbleInlayTexturePair,
  createPavementTexturePair,
  createPlankTexturePair,
  createRoofSlateTexturePair,
  createSandstoneTexturePair,
  createSignTexture,
  createWaterBumpTexture,
} from './ElarionTextures';
import { buildElarionMetropolisExpansion } from './ElarionMetropolisExpansion';
import { buildVaelcrestCountryside, getCountrysideGroundY } from './VaelcrestCountryside';
import { RAIL_STATIONS } from './ManaRailNetwork';
import { ModelAssetCache } from './ModelAssetCache';
import { buildWorldStationsAndLoot } from './WorldStationsAndLoot';

/**
 * Expanded 5-District Elarion Slice (~270m x 216m) with Vibrant Props, 4 Interiors & Multi-Action Citizens:
 * 1. Grand Harbour Quay & 3 Walkable Piers (West, Central Shipyard, East) + Moored Vessels + Cranes + Viaduct
 * 2. West Industrial Quarter: Boiler Works, Refinery Ave, 4 Mana Silos, Flywheel, Smelting Hall & West Forge/Assay
 * 3. Central Old Port: Harbourgate Lane, Foundry Row, Chandlery, Salt & Brass Tavern, Tenements, Copperwell Square
 * 4. South Artisan Market Plaza & Extended South Bazaar Boulevard (10 Stalls, Weaver & Vintner Guildhalls)
 * 5. East Academic Courtyard (Aetheric Conservatory, Observatory, Cartography Hall) & Noble Heights Upper Plaza
 */
export function buildElarionDistrictBlock(
  maxAnisotropy: number,
  modelCache = new ModelAssetCache()
): GreyboxWorldData {
  const group = new THREE.Group();
  group.name = 'Elarion_District_Expanded';

  const boxColliders: BoxCollider[] = [];
  const rampColliders: RampCollider[] = [];
  const raycastTargets: THREE.Object3D[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  // Procedural PBR Surface Texture Sets (Albedo + Bump + Tangent Normal + Roughness)
  const cobblePair = createCobbleTexturePair(maxAnisotropy, 3, 28);
  const crossCobblePair = createCobbleTexturePair(maxAnisotropy, 28, 3);
  const pavementPair = createPavementTexturePair(maxAnisotropy, 3, 14);
  const plazaPair = createPavementTexturePair(maxAnisotropy, 12, 12);
  const marblePair = createMarbleInlayTexturePair(maxAnisotropy, 10, 10);
  const sandstonePair = createSandstoneTexturePair(maxAnisotropy, 2, 2);
  const limestonePair = createSandstoneTexturePair(maxAnisotropy, 3, 3);
  const brickPair = createBrickTexturePair(maxAnisotropy, 2, 2);
  const plankPair = createPlankTexturePair(maxAnisotropy, 2, 2);
  const roofPair = createRoofSlateTexturePair(maxAnisotropy, 3, 2);
  const waterBump = createWaterBumpTexture(maxAnisotropy);

  const signChandleryTex = createSignTexture('CHANDLERY', 'VAELCREST CUSTOMS', '#242c35', '#b67a4e', '#f0eadf', maxAnisotropy);
  const signTavernTex = createSignTexture('SALT & BRASS', 'SAILORS TAPROOM', '#34231d', '#c68b59', '#f4ece0', maxAnisotropy);
  const signConduitTex = createSignTexture('CONDUIT WORKS', 'MANA & HOROLOGY', '#1f2a33', '#5299ae', '#e8eef2', maxAnisotropy);
  const signTradeTex = createSignTexture('TRADE HOUSE', 'MARITIME EXCHANGE', '#2d2b28', '#b8925a', '#f3eee4', maxAnisotropy);
  const signClinicTex = createSignTexture('APOTHECARY', 'DISTRICT CLINIC', '#1e302b', '#98b499', '#eff3ee', maxAnisotropy);
  const signBakeryTex = createSignTexture('PROVISIONS', 'BAKERY & GRAIN', '#382a20', '#cfa064', '#f7f1e6', maxAnisotropy);
  const signHarbourTex = createSignTexture('QUAY CUSTOMS', 'HARBOURMASTER', '#1f2b36', '#6ecad9', '#eef4f8', maxAnisotropy);
  const signSmelteryTex = createSignTexture('SMELTING HALL', 'REFINERY FOUNDRY', '#2e221e', '#d1824b', '#f2e8dc', maxAnisotropy);
  const signMarketTex = createSignTexture('SOUTHGATE', 'ARTISAN MARKET', '#2e2721', '#c79b5c', '#f5eee2', maxAnisotropy);
  const signArchiveTex = createSignTexture('ARCHIVE HALL', 'ACADEMIC QUARTER', '#1f2834', '#9fbcd1', '#eef3f7', maxAnisotropy);
  const signAssayTex = createSignTexture('WEST FORGE', 'ASSAY & FOUNDRY', '#2c221d', '#d98a4e', '#f5ece0', maxAnisotropy);
  const signWeaverTex = createSignTexture('WEAVER GUILD', 'DYED SILK & WOOL', '#1d3138', '#4cb0bf', '#eef5f7', maxAnisotropy);
  const signVintnerTex = createSignTexture('VINTNER HALL', 'SUNCOAST VINTAGES', '#382124', '#d6963a', '#f7efe6', maxAnisotropy);
  const signConservatoryTex = createSignTexture('CONSERVATORY', 'AETHERIC BOTANY', '#1e322a', '#6ecad9', '#eef5f0', maxAnisotropy);

  for (const pair of [
    cobblePair,
    crossCobblePair,
    pavementPair,
    plazaPair,
    marblePair,
    sandstonePair,
    limestonePair,
    brickPair,
    plankPair,
    roofPair,
  ]) {
    disposables.push(pair.map, pair.bumpMap, pair.normalMap, pair.roughnessMap);
  }
  disposables.push(
    waterBump,
    signChandleryTex,
    signTavernTex,
    signConduitTex,
    signTradeTex,
    signClinicTex,
    signBakeryTex,
    signHarbourTex,
    signSmelteryTex,
    signMarketTex,
    signArchiveTex,
    signAssayTex,
    signWeaverTex,
    signVintnerTex,
    signConservatoryTex
  );

  // Calibrated PBR Materials with Tangent Normal + Roughness Mapping
  const matRoad = new THREE.MeshStandardMaterial({
    map: cobblePair.map,
    normalMap: cobblePair.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: cobblePair.roughnessMap,
    roughness: 1.0,
    metalness: 0.05,
  });
  const matCrossRoad = new THREE.MeshStandardMaterial({
    map: crossCobblePair.map,
    normalMap: crossCobblePair.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: crossCobblePair.roughnessMap,
    roughness: 1.0,
    metalness: 0.05,
  });
  const matPavement = new THREE.MeshStandardMaterial({
    map: pavementPair.map,
    normalMap: pavementPair.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: pavementPair.roughnessMap,
    roughness: 1.0,
    metalness: 0.04,
  });
  const matPlaza = new THREE.MeshStandardMaterial({
    map: plazaPair.map,
    normalMap: plazaPair.normalMap,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughnessMap: plazaPair.roughnessMap,
    color: 0xded8cb,
    roughness: 1.0,
    metalness: 0.04,
  });
  const matMarbleInlay = new THREE.MeshStandardMaterial({
    map: marblePair.map,
    normalMap: marblePair.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: marblePair.roughnessMap,
    roughness: 0.95,
    metalness: 0.06,
  });
  const matSandstone = new THREE.MeshStandardMaterial({
    map: sandstonePair.map,
    normalMap: sandstonePair.normalMap,
    normalScale: new THREE.Vector2(0.78, 0.78),
    roughnessMap: sandstonePair.roughnessMap,
    roughness: 1.0,
    metalness: 0.04,
  });
  const matLimestone = new THREE.MeshStandardMaterial({
    map: limestonePair.map,
    normalMap: limestonePair.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: limestonePair.roughnessMap,
    color: 0xe2dcd0,
    roughness: 0.96,
    metalness: 0.05,
  });
  const matBrick = new THREE.MeshStandardMaterial({
    map: brickPair.map,
    normalMap: brickPair.normalMap,
    normalScale: new THREE.Vector2(0.88, 0.88),
    roughnessMap: brickPair.roughnessMap,
    roughness: 1.0,
    metalness: 0.05,
  });
  const matDarkBrick = new THREE.MeshStandardMaterial({
    map: brickPair.map,
    normalMap: brickPair.normalMap,
    normalScale: new THREE.Vector2(0.88, 0.88),
    roughnessMap: brickPair.roughnessMap,
    color: 0x7d726f,
    roughness: 1.0,
    metalness: 0.05,
  });
  const matTimber = new THREE.MeshStandardMaterial({
    map: plankPair.map,
    normalMap: plankPair.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: plankPair.roughnessMap,
    roughness: 1.0,
    metalness: 0.04,
  });
  const matDarkTimber = new THREE.MeshStandardMaterial({ color: 0x3b2d24, roughness: 0.74, metalness: 0.06 });
  const matPlaster = new THREE.MeshStandardMaterial({ color: 0xd4ccba, roughness: 0.88, metalness: 0.02 });
  const matWarmPlaster = new THREE.MeshStandardMaterial({ color: 0xdfd2ba, roughness: 0.86, metalness: 0.02 });
  const matTerracottaPlaster = new THREE.MeshStandardMaterial({ color: 0xc97b5d, roughness: 0.86, metalness: 0.02 });
  const matSagePlaster = new THREE.MeshStandardMaterial({ color: 0x8ea38b, roughness: 0.86, metalness: 0.02 });
  const matOchrePlaster = new THREE.MeshStandardMaterial({ color: 0xd4ad6a, roughness: 0.86, metalness: 0.02 });
  const matSlateRoof = new THREE.MeshStandardMaterial({
    map: roofPair.map,
    normalMap: roofPair.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: roofPair.roughnessMap,
    roughness: 1.0,
    metalness: 0.14,
  });
  const matIron = new THREE.MeshStandardMaterial({ color: 0x292f36, roughness: 0.44, metalness: 0.82 });
  const matCopper = new THREE.MeshStandardMaterial({ color: 0xc27f4e, roughness: 0.28, metalness: 0.88 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x416072,
    emissive: 0x342a1c,
    emissiveIntensity: 0.4,
    roughness: 0.12,
    metalness: 0.28,
  });
  const matManaLamp = new THREE.MeshStandardMaterial({
    color: 0x8be0f0,
    emissive: 0x5ab8cc,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.12,
  });
  const matWarmLantern = new THREE.MeshStandardMaterial({
    color: 0xffd599,
    emissive: 0xe89b42,
    emissiveIntensity: 1.45,
    roughness: 0.24,
    metalness: 0.05,
  });
  const matFurnaceGlow = new THREE.MeshStandardMaterial({
    color: 0xffaa55,
    emissive: 0xff6e24,
    emissiveIntensity: 1.7,
    roughness: 0.35,
    metalness: 0.1,
  });
  const matWater = new THREE.MeshStandardMaterial({
    color: 0x3f8ca1,
    emissive: 0x1e5668,
    emissiveIntensity: 0.48,
    bumpMap: waterBump,
    bumpScale: 0.05,
    roughness: 0.12,
    metalness: 0.22,
  });
  const matAwning = new THREE.MeshStandardMaterial({ color: 0x9b4638, roughness: 0.84, metalness: 0.02 });
  const matAwningGreen = new THREE.MeshStandardMaterial({ color: 0x386958, roughness: 0.84, metalness: 0.02 });
  const matAwningBlue = new THREE.MeshStandardMaterial({ color: 0x355c7d, roughness: 0.84, metalness: 0.02 });
  const matFoliage = new THREE.MeshStandardMaterial({ color: 0x456b43, roughness: 0.86, metalness: 0.02 });
  const matFoliageLight = new THREE.MeshStandardMaterial({ color: 0x5d8754, roughness: 0.84, metalness: 0.02 });
  const matParchment = new THREE.MeshStandardMaterial({ color: 0xe3d6bc, roughness: 0.9, metalness: 0.0 });
  const matFlowerRed = new THREE.MeshStandardMaterial({ color: 0xd94b43, roughness: 0.72, metalness: 0.02 });
  const matFlowerGold = new THREE.MeshStandardMaterial({ color: 0xf2b738, roughness: 0.68, metalness: 0.02 });
  const matFlowerViolet = new THREE.MeshStandardMaterial({ color: 0x8d5cc4, roughness: 0.74, metalness: 0.02 });
  const matBannerTeal = new THREE.MeshStandardMaterial({ color: 0x2c8c99, roughness: 0.8, metalness: 0.04 });
  const matBannerOchre = new THREE.MeshStandardMaterial({ color: 0xd6963a, roughness: 0.8, metalness: 0.04 });
  const matSea = new THREE.MeshStandardMaterial({
    color: 0x1d4054,
    bumpMap: waterBump,
    bumpScale: 0.09,
    roughness: 0.16,
    metalness: 0.28,
  });

  disposables.push(
    matRoad,
    matCrossRoad,
    matPavement,
    matPlaza,
    matMarbleInlay,
    matSandstone,
    matLimestone,
    matBrick,
    matDarkBrick,
    matTimber,
    matDarkTimber,
    matPlaster,
    matWarmPlaster,
    matTerracottaPlaster,
    matSagePlaster,
    matOchrePlaster,
    matSlateRoof,
    matIron,
    matCopper,
    matGlass,
    matManaLamp,
    matWarmLantern,
    matFurnaceGlow,
    matWater,
    matAwning,
    matAwningGreen,
    matAwningBlue,
    matFoliage,
    matFoliageLight,
    matParchment,
    matFlowerRed,
    matFlowerGold,
    matFlowerViolet,
    matBannerTeal,
    matBannerOchre,
    matSea
  );

  const sculpted = new ElarionSculptedBuilders(group, boxColliders, raycastTargets, disposables, {
    sandstone: matSandstone,
    limestone: matLimestone,
    timber: matTimber,
    darkTimber: matDarkTimber,
    iron: matIron,
    copper: matCopper,
    glass: matGlass,
    manaLamp: matManaLamp,
    warmLantern: matWarmLantern,
    slateRoof: matSlateRoof,
    brick: matBrick,
    foliage: matFoliage,
    foliageLight: matFoliageLight,
    plaster: matPlaster,
    awningRed: matAwning,
    awningGreen: matAwningGreen,
    awningBlue: matAwningBlue,
    parchment: matParchment,
    flowerRed: matFlowerRed,
    flowerGold: matFlowerGold,
    flowerViolet: matFlowerViolet,
    bannerTeal: matBannerTeal,
    bannerOchre: matBannerOchre,
  });

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

  const addHangingSign = (
    wallX: number,
    y: number,
    z: number,
    dirX: 1 | -1,
    tex: THREE.CanvasTexture,
    alongZ = false
  ): void => {
    const signGroup = new THREE.Group();
    signGroup.position.set(wallX, y, z);
    if (alongZ) signGroup.rotation.y = Math.PI / 2;

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

  const addRailRunX = (minX: number, maxX: number, y: number, z: number) => {
    const len = maxX - minX;
    if (len <= 0.1) return;
    const cx = (minX + maxX) * 0.5;
    addBox(cx, y, z, len, 0.3, 0.55, matSandstone);
    addBox(cx, y + 0.72, z, len, 0.12, 0.14, matIron);
    for (let px = minX + 1.5; px <= maxX - 1.5; px += 4.5) {
      addBox(px, y, z, 0.16, 0.85, 0.16, matIron, { collide: false });
    }
  };

  const addRailRunZ = (x: number, y: number, minZ: number, maxZ: number) => {
    const len = maxZ - minZ;
    if (len <= 0.1) return;
    const cz = (minZ + maxZ) * 0.5;
    addBox(x, y, cz, 0.55, 0.3, len, matSandstone);
    addBox(x, y + 0.72, cz, 0.14, 0.12, len, matIron);
    for (let pz = minZ + 1.5; pz <= maxZ - 1.5; pz += 4.5) {
      addBox(x, y, pz, 0.16, 0.85, 0.16, matIron, { collide: false });
    }
  };

  // =========================================================================
  // 1. SEA PLANE, EXPANDED ROAD NETWORK & NON-OVERLAPPING PAVEMENTS
  // =========================================================================
  const seaGeo = new THREE.PlaneGeometry(3600, 3200);
  disposables.push(seaGeo);
  const seaMesh = new THREE.Mesh(seaGeo, matSea);
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(0, -1.8, -620);
  group.add(seaMesh);

  // Harbourgate Lane Main Road: X = -4.5..+4.5, Z = -22..+52, Y = 0
  addBox(0, -0.6, 15.0, 9.0, 0.6, 74.0, matRoad, { castShadow: false });
  // Foundry Row + Extended West Refinery Avenue: X = -132..-4.5 and +4.5..+38.5, Z = 15..22, Y = 0
  addBox(-68.25, -0.6, 18.5, 127.5, 0.6, 7.0, matCrossRoad, { castShadow: false });
  addBox(21.5, -0.6, 18.5, 34.0, 0.6, 7.0, matCrossRoad, { castShadow: false });

  // Copper mana conduit channel along west edge of Harbourgate Lane
  addBox(-4.35, 0.005, -3.5, 0.28, 0.02, 36.0, matIron, { collide: false, castShadow: false });
  addBox(-4.35, 0.02, -3.5, 0.08, 0.015, 36.0, matCopper, { collide: false, castShadow: false });

  // Pavements (y = 0.16, cleanly partitioned with zero Z-fighting)
  addBox(0, -0.4, -24.0, 19.0, 0.56, 4.0, matPavement, { castShadow: false });
  addBox(-7.0, -0.4, -3.5, 5.0, 0.56, 37.0, matPavement, { castShadow: false });
  addBox(7.0, -0.4, -3.5, 5.0, 0.56, 37.0, matPavement, { castShadow: false });

  // Foundry Row & West Refinery North Sidewalks (Z = +12.5..+15, X = -42..-9.5 & +9.5..+38.5)
  addBox(-25.75, -0.4, 13.75, 32.5, 0.56, 2.5, matPavement, { castShadow: false });
  addBox(24.0, -0.4, 13.75, 29.0, 0.56, 2.5, matPavement, { castShadow: false });

  // Foundry Row & Extended Refinery South Sidewalks (Z = +22..+24.5, X = -132..-4.5 & +4.5..+38.5)
  addBox(-68.25, -0.4, 23.25, 127.5, 0.56, 2.5, matPavement, { castShadow: false });
  addBox(21.5, -0.4, 23.25, 34.0, 0.56, 2.5, matPavement, { castShadow: false });

  // Harbourgate Lane South Sidewalks (Z = +24.5..+52.0)
  addBox(-7.0, -0.4, 38.25, 5.0, 0.56, 27.5, matPavement, { castShadow: false });
  addBox(7.0, -0.4, 38.25, 5.0, 0.56, 27.5, matPavement, { castShadow: false });

  // West Wing: Pedestrian Alley Shortcut & Worker Courtyard
  addBox(-13.25, -0.4, 2.75, 7.5, 0.56, 2.5, matPavement, { castShadow: false });
  addBox(-26.0, -0.4, 1.25, 18.0, 0.56, 22.5, matPavement, { castShadow: false });

  // East Wing: Passageway & Copperwell Public Square
  addBox(13.25, -0.4, 4.0, 7.5, 0.56, 3.0, matPavement, { castShadow: false });
  addBox(26.0, -0.4, 3.0, 18.0, 0.56, 19.0, matPlaza, { castShadow: false });

  // North Balustrade Split for Grand Harbour Gate & Descent Stairway (opening X = -3.0..+3.0)
  addBox(-6.3, 0.16, -26.1, 6.6, 1.05, 0.55, matSandstone);
  addBox(6.3, 0.16, -26.1, 6.6, 1.05, 0.55, matSandstone);
  for (const bx of [-8, -4, 4, 8]) {
    addBox(bx, 0.16, -26.1, 0.72, 1.32, 0.72, matSandstone);
    addBox(bx, 1.48, -26.1, 0.78, 0.1, 0.78, matCopper, { collide: false });
  }
  for (const gx of [-3.25, 3.25]) {
    addBox(gx, 0.16, -26.1, 0.85, 2.15, 0.85, matSandstone);
    addBox(gx, 2.31, -26.1, 0.92, 0.14, 0.92, matCopper, { collide: false });
    addBox(gx, 2.45, -26.1, 0.36, 0.42, 0.36, matManaLamp, { collide: false });
    addBox(gx, 2.87, -26.1, 0.48, 0.12, 0.48, matIron, { collide: false });
  }

  // South City Gatehouse Archway (Z = +38.5)
  addBox(-7.0, 0.16, 38.5, 5.2, 5.8, 1.4, matSandstone);
  addBox(7.0, 0.16, 38.5, 5.2, 5.8, 1.4, matSandstone);
  addBox(0, 4.2, 38.5, 9.0, 1.76, 1.4, matSandstone);
  addBox(0, 4.15, 37.75, 3.2, 0.18, 0.12, matCopper, { collide: false });
  addBox(0, 4.15, 39.25, 3.2, 0.18, 0.12, matCopper, { collide: false });
  addHangingSign(-4.4, 3.4, 37.8, 1, signMarketTex, false);

  // West & East Cross-Street Gate Archways (X = ±37.8)
  addBox(-37.8, 0.16, 13.75, 1.2, 4.5, 2.5, matDarkBrick);
  addBox(-37.8, 0.16, 23.25, 1.2, 4.5, 2.5, matDarkBrick);
  addBox(-37.8, 4.1, 18.5, 1.2, 1.8, 7.2, matDarkBrick);
  addBox(37.8, 0.16, 13.75, 1.2, 5.2, 2.5, matSandstone);
  addBox(37.8, 0.16, 23.25, 1.2, 5.2, 2.5, matSandstone);
  addBox(37.8, 4.3, 18.5, 1.2, 2.0, 7.2, matSandstone);

  // =========================================================================
  // 2. HARBOURGATE LANE BUILDINGS (With Vibrant Plaster, Flower Boxes & Bunting)
  // =========================================================================

  // Accessible Interior #1: Vaelcrest Customs & Chandlery (X = -17..-9.5, Z = +4.0..+12.5)
  {
    const minX = -17.0;
    const maxX = -9.5;
    const minZ = 4.0;
    const maxZ = 12.5;
    const floorY = 0.18;
    const groundH = 3.6;

    addBox((minX + maxX) * 0.5, -0.4, (minZ + maxZ) * 0.5, maxX - minX, 0.58, maxZ - minZ, matTimber, {
      castShadow: false,
    });
    addBox(minX + 0.2, floorY, (minZ + maxZ) * 0.5, 0.4, groundH, maxZ - minZ, matSandstone);
    addBox((minX + maxX) * 0.5, floorY, minZ + 0.2, maxX - minX, groundH, 0.4, matSandstone);
    addBox((minX + maxX) * 0.5, floorY, maxZ - 0.2, maxX - minX, groundH, 0.4, matSandstone);

    addBox(maxX - 0.2, floorY, 5.525, 0.4, groundH, 3.05, matSandstone);
    addBox(maxX - 0.2, floorY, 10.975, 0.4, groundH, 3.05, matSandstone);
    addBox(maxX - 0.2, floorY + 2.65, 8.25, 0.4, 0.95, 2.4, matSandstone);

    addBox((minX + maxX) * 0.5, floorY + groundH, (minZ + maxZ) * 0.5, maxX - minX + 0.5, 2.7, maxZ - minZ, matPlaster);
    sculpted.addGabledRoofWithRidge((minX + maxX) * 0.5, floorY + groundH + 2.7, (minZ + maxZ) * 0.5, maxX - minX + 1.1, 2.1, maxZ - minZ + 0.5);
    sculpted.addChimneyStack(minX + 1.4, floorY + groundH + 3.2, minZ + 1.8);

    sculpted.addSculptedWindow(maxX + 0.05, floorY + 1.65, 5.5, '+x', 1.35, 1.45, true);
    sculpted.addSculptedWindow(maxX + 0.05, floorY + 1.65, 11.0, '+x', 1.35, 1.45, true);
    sculpted.addSculptedWindow(maxX + 0.26, floorY + groundH + 1.35, 6.4, '+x', 1.15, 1.3, false);
    sculpted.addSculptedWindow(maxX + 0.26, floorY + groundH + 1.35, 10.1, '+x', 1.15, 1.3, false);
    sculpted.addFlowerBox(maxX + 0.4, floorY + groundH + 0.55, 6.4, '+x', 'gold');
    sculpted.addFlowerBox(maxX + 0.4, floorY + groundH + 0.55, 10.1, '+x', 'red');
    sculpted.addSculptedWindow((minX + maxX) * 0.5, floorY + 1.65, maxZ + 0.05, '+z', 1.4, 1.4, true);
    addHangingSign(maxX + 0.05, floorY + 3.05, 6.8, 1, signChandleryTex);

    addBox(-14.6, floorY, 7.6, 1.0, 1.05, 3.8, matTimber);
    addBox(-14.6, floorY + 1.05, 7.6, 1.12, 0.08, 3.9, matCopper, { collide: false });
    addBox(-14.5, floorY + 1.13, 6.8, 0.48, 0.07, 0.62, matParchment, { collide: false });
    sculpted.addSculptedCrate(-15.7, floorY, 10.8, 0.85, 0.15);
    sculpted.addSculptedBarrel(-11.2, floorY, 5.1);

    addBox(-12.6, floorY + groundH - 0.55, 8.25, 0.26, 0.34, 0.26, matWarmLantern, { collide: false });
    const chandleryLight = new THREE.PointLight(0xffb86b, 3.2, 11, 1.8);
    chandleryLight.position.set(-12.6, floorY + groundH - 0.7, 8.25);
    group.add(chandleryLight);
  }

  // Covered Archway Bridge over Pedestrian Alley Shortcut
  {
    addBox(-13.25, 3.3, 2.75, 7.5, 2.8, 2.5, matOchrePlaster);
    addBox(-9.45, 3.3, 2.75, 0.2, 0.22, 2.6, matDarkTimber, { collide: false });
    sculpted.addGabledRoofWithRidge(-13.25, 6.1, 2.75, 8.0, 1.8, 2.8);
    sculpted.addSculptedWindow(-9.45, 4.7, 2.75, '+x', 1.1, 1.2, false);
    sculpted.addFlowerBox(-9.3, 3.9, 2.75, '+x', 'violet');
  }

  // Accessible Interior #2: The Salt & Brass Tavern (X = +9.5..+17.0, Z = -6.5..+2.5)
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
    addBox(maxX - 0.2, floorY, (minZ + maxZ) * 0.5, 0.4, groundH, maxZ - minZ, matBrick);
    addBox((minX + maxX) * 0.5, floorY, minZ + 0.2, maxX - minX, groundH, 0.4, matBrick);
    addBox((minX + maxX) * 0.5, floorY, maxZ - 0.2, maxX - minX, groundH, 0.4, matBrick);

    addBox(minX + 0.2, floorY, -4.85, 0.4, groundH, 3.3, matBrick);
    addBox(minX + 0.2, floorY, 0.85, 0.4, groundH, 3.3, matBrick);
    addBox(minX + 0.2, floorY + 2.65, -2.0, 0.4, 1.05, 2.4, matBrick);

    addBox((minX + maxX) * 0.5 - 0.25, floorY + groundH, (minZ + maxZ) * 0.5, maxX - minX + 0.5, 2.9, maxZ - minZ, matWarmPlaster);
    sculpted.addGabledRoofWithRidge((minX + maxX) * 0.5 - 0.25, floorY + groundH + 2.9, (minZ + maxZ) * 0.5, maxX - minX + 1.1, 2.3, maxZ - minZ + 0.6);
    addBox(maxX - 1.2, floorY + groundH + 2.7, maxZ - 1.2, 1.1, 3.4, 1.1, matBrick, { collide: false });
    sculpted.addChimneyStack(maxX - 1.2, floorY + groundH + 5.0, maxZ - 1.2);

    sculpted.addSculptedWindow(minX - 0.05, floorY + 1.65, -4.85, '-x', 1.4, 1.4, true);
    sculpted.addSculptedWindow(minX - 0.05, floorY + 1.65, 0.85, '-x', 1.4, 1.4, true);
    sculpted.addSculptedWindow(minX - 0.55, floorY + groundH + 1.45, -4.2, '-x', 1.2, 1.35, false);
    sculpted.addSculptedWindow(minX - 0.55, floorY + groundH + 1.45, 0.2, '-x', 1.2, 1.35, false);
    sculpted.addFlowerBox(minX - 0.68, floorY + groundH + 0.65, -4.2, '-x', 'red');
    sculpted.addFlowerBox(minX - 0.68, floorY + groundH + 0.65, 0.2, '-x', 'gold');
    addHangingSign(minX - 0.05, floorY + 3.05, -0.4, -1, signTavernTex);

    addBox(14.9, floorY, -3.3, 0.95, 1.05, 4.4, matDarkTimber);
    addBox(14.9, floorY + 1.05, -3.3, 1.08, 0.08, 4.5, matCopper, { collide: false });
    sculpted.addSculptedBarrel(16.0, floorY, -4.6);
    sculpted.addSculptedBarrel(16.0, floorY, -3.7);
    addBox(13.2, floorY, 1.85, 2.1, 2.4, 0.75, matSandstone);
    addBox(13.2, floorY + 0.15, 1.5, 0.95, 0.5, 0.25, matWarmLantern, { collide: false });
    addBox(12.2, floorY, -4.5, 1.35, 0.78, 0.9, matTimber);
    addBox(12.2, floorY, -0.3, 1.35, 0.78, 0.9, matTimber);

    addBox(13.0, floorY + groundH - 0.55, -2.0, 0.28, 0.34, 0.28, matWarmLantern, { collide: false });
    const tavernLight = new THREE.PointLight(0xffb060, 3.6, 12, 1.8);
    tavernLight.position.set(13.0, floorY + groundH - 0.7, -2.0);
    group.add(tavernLight);
  }

  // West Center: Aetheric Conduit & Horology Workshop
  {
    addBox(-13.25, 0.16, -4.25, 7.5, 3.8, 11.5, matBrick);
    addBox(-13.05, 3.96, -4.25, 7.9, 3.1, 11.5, matSandstone);
    sculpted.addGabledRoofWithRidge(-13.05, 7.06, -4.25, 8.5, 2.2, 12.0);
    sculpted.addChimneyStack(-15.5, 7.8, -7.5);

    sculpted.addSculptedWindow(-9.45, 1.9, -7.2, '+x', 1.6, 1.65, true);
    sculpted.addSculptedWindow(-9.45, 1.9, -1.3, '+x', 1.6, 1.65, true);
    sculpted.addSculptedWindow(-9.05, 5.5, -7.2, '+x', 1.2, 1.4, false);
    sculpted.addSculptedWindow(-9.05, 5.5, -4.25, '+x', 1.2, 1.4, false);
    sculpted.addSculptedWindow(-9.05, 5.5, -1.3, '+x', 1.2, 1.4, false);
    addHangingSign(-9.48, 3.2, -4.2, 1, signConduitTex);

    addBox(-9.35, 1.15, -4.2, 0.35, 1.5, 0.9, matIron);
    addBox(-9.2, 1.6, -4.2, 0.18, 0.75, 0.28, matManaLamp, { collide: false });
    addBox(-9.38, 2.85, -4.2, 0.14, 0.14, 10.5, matCopper, { collide: false });
  }

  // East Corner: Mariner's Trade House
  {
    addBox(13.25, 0.16, 9.0, 7.5, 7.8, 7.0, matTerracottaPlaster);
    addBox(13.25, 0.16, 9.0, 7.62, 3.4, 7.12, matSandstone, { collide: false });
    sculpted.addGabledRoofWithRidge(13.25, 7.96, 9.0, 8.2, 2.1, 7.4);
    sculpted.addSculptedWindow(9.45, 2.0, 7.4, '-x', 1.4, 1.7, true);
    sculpted.addSculptedWindow(9.45, 2.0, 10.6, '-x', 1.4, 1.7, true);
    sculpted.addSculptedWindow(9.45, 5.6, 7.4, '-x', 1.25, 1.5, false);
    sculpted.addSculptedWindow(9.45, 5.6, 10.6, '-x', 1.25, 1.5, false);
    sculpted.addFlowerBox(9.32, 4.7, 7.4, '-x', 'gold');
    sculpted.addFlowerBox(9.32, 4.7, 10.6, '-x', 'violet');
    sculpted.addSculptedWindow(13.25, 2.0, 12.55, '+z', 1.4, 1.6, true);
    addHangingSign(9.48, 3.3, 9.0, -1, signTradeTex);

    const awning = addBox(8.2, 2.65, 9.0, 2.6, 0.12, 4.0, matAwning, { collide: false });
    awning.rotation.z = 0.24;
    addBox(9.1, 0.16, 7.2, 0.14, 2.35, 0.14, matDarkTimber);
    addBox(9.1, 0.16, 10.8, 0.14, 2.35, 0.14, matDarkTimber);
    sculpted.addSculptedCrate(8.4, 0.16, 8.3, 0.8, 0.1);
    sculpted.addSculptedCrate(8.4, 0.16, 9.5, 0.8, -0.18);
    sculpted.addSculptedBarrel(8.5, 0.16, 10.35);
  }

  // North Flanking Buildings: Harbour Watchhouse (W) & Warehouse Annex (E)
  {
    addBox(-13.25, 0.16, -17.0, 7.5, 6.2, 11.0, matSandstone);
    sculpted.addGabledRoofWithRidge(-13.25, 6.36, -17.0, 8.2, 2.1, 11.4);
    sculpted.addSculptedWindow(-9.45, 2.0, -14.5, '+x', 1.3, 1.5, true);
    sculpted.addSculptedWindow(-9.45, 2.0, -19.2, '+x', 1.3, 1.5, true);
    sculpted.addSculptedWindow(-9.45, 4.7, -17.0, '+x', 1.3, 1.35, false);

    addBox(13.25, 0.16, -15.75, 7.5, 6.4, 13.5, matBrick);
    sculpted.addGabledRoofWithRidge(13.25, 6.56, -15.75, 8.2, 2.0, 13.9);
    addBox(8.6, 5.4, -15.5, 2.2, 0.22, 0.24, matDarkTimber, { collide: false });
    sculpted.addSculptedCrate(8.6, 0.16, -15.5, 0.95, 0.08);
    sculpted.addSculptedCrate(8.5, 0.16, -14.4, 0.78, -0.22);
    sculpted.addSculptedBarrel(8.6, 0.16, -16.7);
    sculpted.addSculptedWindow(9.45, 2.2, -12.0, '-x', 1.3, 1.4, true);
    sculpted.addSculptedWindow(9.45, 2.2, -19.2, '-x', 1.3, 1.4, true);
  }

  // Festive Bunting Strands Overhead on Harbourgate Lane!
  sculpted.addHangingBunting(-9.2, 5.1, -13.0, 9.2, 5.1, -11.0);
  sculpted.addHangingBunting(-9.2, 5.1, 4.8, 9.2, 5.1, 7.0);
  sculpted.addHangingBunting(-9.2, 5.1, 29.0, 9.2, 5.1, 31.0);
  sculpted.addHangingBunting(-9.2, 5.1, 44.0, 9.2, 5.1, 46.5);

  // =========================================================================
  // 3. EAST WING — COPPERWELL PUBLIC SQUARE & MIDDLE-CLASS QUARTER
  // =========================================================================
  {
    const fx = 25.5;
    const fz = 3.0;
    const basinGeo = new THREE.CylinderGeometry(2.3, 2.5, 0.65, 10);
    const waterGeo = new THREE.CylinderGeometry(2.05, 2.05, 0.56, 10);
    const spireGeo = new THREE.CylinderGeometry(0.28, 0.45, 2.2, 10);
    const bowlGeo = new THREE.CylinderGeometry(0.95, 0.45, 0.35, 10);
    const orbGeo = new THREE.OctahedronGeometry(0.28, 0);
    disposables.push(basinGeo, waterGeo, spireGeo, bowlGeo, orbGeo);

    const basin = new THREE.Mesh(basinGeo, matSandstone);
    basin.position.set(fx, 0.16 + 0.325, fz);
    basin.castShadow = true;
    basin.receiveShadow = true;

    const water = new THREE.Mesh(waterGeo, matWater);
    water.position.set(fx, 0.16 + 0.35, fz);

    const spire = new THREE.Mesh(spireGeo, matSandstone);
    spire.position.set(fx, 0.16 + 1.1, fz);
    spire.castShadow = true;

    const bowl = new THREE.Mesh(bowlGeo, matCopper);
    bowl.position.set(fx, 0.16 + 1.85, fz);

    const orb = new THREE.Mesh(orbGeo, matManaLamp);
    orb.position.set(fx, 0.16 + 2.45, fz);

    group.add(basin, water, spire, bowl, orb);
    raycastTargets.push(basin, spire);

    boxColliders.push({
      minX: fx - 2.45,
      maxX: fx + 2.45,
      minY: 0.16,
      maxY: 2.6,
      minZ: fz - 2.45,
      maxZ: fz + 2.45,
    });
  }

  sculpted.addSculptedTreePlanter(20.0, 0.16, -2.5, 1.05);
  sculpted.addSculptedTreePlanter(31.0, 0.16, -2.5, 0.95);
  sculpted.addSculptedTreePlanter(20.0, 0.16, 8.8, 1.0);
  sculpted.addSculptedTreePlanter(31.0, 0.16, 8.8, 1.1);
  sculpted.addSculptedBench(25.5, 0.16, -1.6, Math.PI / 2);
  sculpted.addSculptedBench(25.5, 0.16, 7.6, -Math.PI / 2);
  sculpted.addPottedShrub(20.2, 0.16, 3.0, true);
  sculpted.addPottedShrub(30.8, 0.16, 3.0, true);
  sculpted.addGoodsDisplay(19.5, 0.16, 11.2, 0);
  sculpted.addHangingBunting(17.5, 5.2, -5.0, 34.5, 5.2, 8.0);

  // North Plaza: Apothecary & Clinic (Sage Plaster)
  {
    addBox(26.0, 0.16, -10.0, 18.0, 7.6, 7.0, matSagePlaster);
    addBox(26.0, 0.16, -6.5, 18.0, 3.5, 0.4, matSandstone, { collide: false });
    sculpted.addGabledRoofWithRidge(26.0, 7.76, -10.0, 7.6, 2.2, 18.4, true);
    sculpted.addChimneyStack(21.0, 8.4, -11.5);

    sculpted.addSculptedWindow(21.5, 2.0, -6.45, '+z', 1.4, 1.55, true);
    sculpted.addSculptedWindow(29.5, 2.0, -6.45, '+z', 1.4, 1.55, true);
    sculpted.addSculptedWindow(21.5, 5.4, -6.45, '+z', 1.25, 1.35, false);
    sculpted.addSculptedWindow(25.5, 5.4, -6.45, '+z', 1.25, 1.35, false);
    sculpted.addSculptedWindow(29.5, 5.4, -6.45, '+z', 1.25, 1.35, false);
    sculpted.addFlowerBox(21.5, 4.5, -6.32, '+z', 'violet');
    sculpted.addFlowerBox(29.5, 4.5, -6.32, '+z', 'gold');
    addHangingSign(25.5, 3.25, -6.45, 1, signClinicTex, true);

    const clinicAwning = addBox(25.5, 2.65, -5.35, 5.2, 0.12, 2.2, matAwningGreen, { collide: false });
    clinicAwning.rotation.x = 0.22;
  }

  // East Plaza Perimeter: Bookbinder & Middle-Class Townhouses
  {
    addBox(38.5, 0.16, -4.5, 7.0, 8.2, 18.0, matWarmPlaster);
    sculpted.addGabledRoofWithRidge(38.5, 8.36, -4.5, 7.6, 2.2, 18.4);
    sculpted.addSculptedWindow(34.95, 2.1, -3.0, '-x', 1.3, 1.5, true);
    sculpted.addSculptedWindow(34.95, 2.1, 2.5, '-x', 1.3, 1.5, true);
    sculpted.addSculptedWindow(34.95, 5.6, -3.0, '-x', 1.2, 1.4, false);
    sculpted.addSculptedWindow(34.95, 5.6, 2.5, '-x', 1.2, 1.4, false);
    sculpted.addFlowerBox(34.82, 4.75, -3.0, '-x', 'red');

    addBox(38.5, 0.16, 8.5, 7.0, 6.8, 8.0, matBrick);
    sculpted.addGabledRoofWithRidge(38.5, 6.96, 8.5, 7.6, 2.0, 8.4);
    sculpted.addSculptedWindow(34.95, 2.1, 8.5, '-x', 1.3, 1.5, true);
    sculpted.addSculptedWindow(34.95, 5.0, 8.5, '-x', 1.2, 1.35, false);
  }

  // =========================================================================
  // 4. WEST WING — WORKER TENEMENT COURTYARD & PEDESTRIAN SHORTCUT
  // =========================================================================
  {
    const px = -26.0;
    const pz = 1.0;
    addBox(px, 0.16, pz, 1.4, 0.52, 1.4, matSandstone);
    addBox(px, 0.68, pz, 0.95, 0.1, 0.95, matWater, { collide: false });
    addBox(px - 0.55, 0.68, pz, 0.24, 1.15, 0.24, matIron);
    sculpted.addSculptedCrate(px + 1.5, 0.16, pz + 0.8, 0.72, 0.25);
    sculpted.addSculptedBarrel(px + 1.4, 0.16, pz - 0.7);
    sculpted.addPottedShrub(px - 4.2, 0.16, pz - 3.0, true);
  }

  {
    addBox(-38.5, 0.16, -4.0, 7.0, 6.6, 13.0, matDarkBrick);
    sculpted.addGabledRoofWithRidge(-38.5, 6.76, -4.0, 7.5, 1.8, 13.4);
    sculpted.addSculptedWindow(-34.95, 2.0, -7.2, '+x', 1.15, 1.3, true);
    sculpted.addSculptedWindow(-34.95, 2.0, -0.8, '+x', 1.15, 1.3, true);
    sculpted.addSculptedWindow(-34.95, 4.7, -7.2, '+x', 1.15, 1.25, false);
    sculpted.addSculptedWindow(-34.95, 4.7, -0.8, '+x', 1.15, 1.25, false);

    addBox(-38.5, 0.16, 7.5, 7.0, 5.8, 10.0, matBrick);
    sculpted.addGabledRoofWithRidge(-38.5, 5.96, 7.5, 7.5, 1.7, 10.4);
    sculpted.addSculptedWindow(-34.95, 2.0, 7.5, '+x', 1.15, 1.3, true);
    sculpted.addSculptedWindow(-34.95, 4.4, 7.5, '+x', 1.15, 1.25, false);
    sculpted.addFlowerBox(-34.82, 3.65, 7.5, '+x', 'gold');
  }

  {
    addBox(-26.0, 0.16, -13.25, 18.0, 6.4, 6.5, matDarkBrick);
    sculpted.addGabledRoofWithRidge(-26.0, 6.56, -13.25, 7.0, 1.8, 18.4, true);
    sculpted.addChimneyStack(-29.0, 7.2, -14.0);
    sculpted.addSculptedWindow(-30.5, 2.0, -9.95, '+z', 1.15, 1.3, true);
    sculpted.addSculptedWindow(-26.0, 2.0, -9.95, '+z', 1.15, 1.3, true);
    sculpted.addSculptedWindow(-21.5, 2.0, -9.95, '+z', 1.15, 1.3, true);
    sculpted.addSculptedWindow(-30.5, 4.6, -9.95, '+z', 1.1, 1.2, false);
    sculpted.addSculptedWindow(-21.5, 4.6, -9.95, '+z', 1.1, 1.2, false);
  }

  {
    addBox(-30.75, 0.16, 9.5, 8.5, 5.6, 6.0, matBrick);
    sculpted.addGabledRoofWithRidge(-30.75, 5.76, 9.5, 6.4, 1.7, 8.8, true);
    sculpted.addSculptedWindow(-30.75, 2.0, 12.55, '+z', 1.15, 1.25, true);
    sculpted.addSculptedWindow(-30.75, 4.3, 12.55, '+z', 1.1, 1.2, false);

    addBox(-19.5, 0.16, 9.5, 5.0, 5.8, 6.0, matDarkBrick);
    sculpted.addGabledRoofWithRidge(-19.5, 5.96, 9.5, 6.4, 1.7, 5.4, true);
    sculpted.addSculptedWindow(-19.5, 2.0, 12.55, '+z', 1.1, 1.25, true);
  }
  sculpted.addHangingBunting(-34.5, 4.6, -4.5, -17.5, 4.6, 1.5);

  // =========================================================================
  // 5. SOUTH SIDE OF FOUNDRY ROW & HARBOURGATE SOUTH SHOPS (Z = +24.5..+52)
  // =========================================================================
  {
    addBox(-15.5, 0.16, 30.0, 12.0, 6.4, 11.0, matBrick);
    sculpted.addGabledRoofWithRidge(-15.5, 6.56, 30.0, 11.4, 1.9, 12.4, true);
    sculpted.addSculptedWindow(-9.45, 2.0, 27.5, '+x', 1.3, 1.4, true);
    sculpted.addSculptedWindow(-9.45, 2.0, 32.5, '+x', 1.3, 1.4, true);
    sculpted.addSculptedWindow(-15.5, 2.0, 24.45, '-z', 1.3, 1.4, true);

    addBox(-29.5, 0.16, 30.0, 15.0, 6.0, 11.0, matDarkBrick);
    sculpted.addGabledRoofWithRidge(-29.5, 6.16, 30.0, 11.4, 1.8, 15.4, true);
    sculpted.addSculptedWindow(-26.0, 2.0, 24.45, '-z', 1.2, 1.35, true);
    sculpted.addSculptedWindow(-33.0, 2.0, 24.45, '-z', 1.2, 1.35, true);
  }

  {
    addBox(15.5, 0.16, 30.0, 12.0, 7.2, 11.0, matOchrePlaster);
    addBox(15.5, 0.16, 30.0, 12.12, 3.2, 11.12, matSandstone, { collide: false });
    sculpted.addGabledRoofWithRidge(15.5, 7.36, 30.0, 11.4, 2.0, 12.4, true);
    sculpted.addChimneyStack(13.0, 8.0, 32.0);
    sculpted.addSculptedWindow(9.45, 2.0, 27.5, '-x', 1.35, 1.5, true);
    sculpted.addSculptedWindow(9.45, 2.0, 32.5, '-x', 1.35, 1.5, true);
    sculpted.addSculptedWindow(15.5, 2.0, 24.45, '-z', 1.35, 1.5, true);
    sculpted.addSculptedWindow(15.5, 5.2, 24.45, '-z', 1.2, 1.35, false);
    sculpted.addFlowerBox(15.5, 4.35, 24.32, '-z', 'gold');
    addHangingSign(15.5, 3.2, 24.45, -1, signBakeryTex, true);

    sculpted.addSculptedCrate(14.5, 0.16, 23.6, 0.78, 0.12);
    sculpted.addSculptedBarrel(16.6, 0.16, 23.7);
    sculpted.addGoodsDisplay(10.8, 0.16, 23.6, 0);

    addBox(29.5, 0.16, 30.0, 15.0, 6.8, 11.0, matWarmPlaster);
    sculpted.addGabledRoofWithRidge(29.5, 6.96, 30.0, 11.4, 1.9, 15.4, true);
    sculpted.addSculptedWindow(26.0, 2.0, 24.45, '-z', 1.25, 1.4, true);
    sculpted.addSculptedWindow(33.0, 2.0, 24.45, '-z', 1.25, 1.4, true);
  }

  // Flanking Townhouses along Harbourgate South Approach
  {
    addBox(-15.5, 0.16, 45.5, 12.0, 6.4, 13.0, matSagePlaster);
    sculpted.addGabledRoofWithRidge(-15.5, 6.56, 45.5, 12.4, 2.0, 13.4);
    sculpted.addSculptedWindow(-9.45, 2.0, 43.0, '+x', 1.3, 1.4, true);
    sculpted.addSculptedWindow(-9.45, 2.0, 48.0, '+x', 1.3, 1.4, true);
    sculpted.addFlowerBox(-9.32, 1.15, 43.0, '+x', 'red');

    addBox(15.5, 0.16, 45.5, 12.0, 6.8, 13.0, matTerracottaPlaster);
    sculpted.addGabledRoofWithRidge(15.5, 6.96, 45.5, 12.4, 2.0, 13.4);
    sculpted.addSculptedWindow(9.45, 2.0, 43.0, '-x', 1.3, 1.4, true);
    sculpted.addSculptedWindow(9.45, 2.0, 48.0, '-x', 1.3, 1.4, true);
    sculpted.addFlowerBox(9.32, 1.15, 48.0, '-x', 'violet');

    // Plaza framing walls at Z = 51 connecting west & east
    addBox(-33.75, 0.16, 51.0, 24.5, 3.2, 2.0, matBrick);
    addBox(33.75, 0.16, 51.0, 24.5, 3.2, 2.0, matSandstone);
  }

  // =========================================================================
  // 6. SCULPTED STREET LAMPS, NOTICE BOARD, BENCHES & BOLLARDS
  // =========================================================================
  const lampPositions: Array<[number, number]> = [
    [-5.0, 29.0],
    [-5.0, 11.0],
    [-5.0, -1.5],
    [-5.0, -14.0],
    [5.0, 29.0],
    [5.0, 11.0],
    [5.0, -5.5],
    [5.0, -17.5],
    [18.5, 13.5],
    [31.5, 13.5],
    [-18.5, 13.5],
    [-31.5, 13.5],
    [-5.0, 45.0],
    [5.0, 45.0],
  ];
  for (const [lx, lz] of lampPositions) {
    sculpted.addSculptedStreetLamp(lx, 0.16, lz);
  }

  // Notice Board outside Salt & Brass Tavern
  {
    const nx = 9.05;
    const nz = 1.6;
    addBox(nx, 0.16, nz - 0.65, 0.12, 2.1, 0.12, matDarkTimber);
    addBox(nx, 0.16, nz + 0.65, 0.12, 2.1, 0.12, matDarkTimber);
    addBox(nx, 0.95, nz, 0.1, 1.05, 1.25, matTimber);
    addBox(nx - 0.06, 1.15, nz - 0.25, 0.03, 0.42, 0.32, matParchment, { collide: false });
    addBox(nx - 0.06, 1.42, nz + 0.22, 0.03, 0.34, 0.38, matParchment, { collide: false });
    addBox(nx, 2.25, nz, 0.45, 0.12, 1.65, matSlateRoof, { collide: false });
  }

  sculpted.addSculptedBench(-8.9, 0.16, -0.2, 0);
  sculpted.addSculptedBench(8.9, 0.16, -8.5, Math.PI);
  sculpted.addPottedShrub(-8.9, 0.16, -12.2, true);
  sculpted.addPottedShrub(8.9, 0.16, 4.2, true);

  // Instanced Curb Bollards
  const bollardGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.72, 10);
  disposables.push(bollardGeo);
  const bollardCoords: Array<[number, number]> = [
    [-4.85, -20],
    [-4.85, -12],
    [-4.85, -4],
    [-4.85, 5],
    [-4.85, 26],
    [-4.85, 34],
    [4.85, -20],
    [4.85, -12],
    [4.85, -4],
    [4.85, 5],
    [4.85, 26],
    [4.85, 34],
  ];
  const bollardInst = new THREE.InstancedMesh(bollardGeo, matSandstone, bollardCoords.length);
  bollardInst.castShadow = true;
  bollardInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  bollardCoords.forEach(([bx, bz], i) => {
    dummy.position.set(bx, 0.16 + 0.36, bz);
    dummy.updateMatrix();
    bollardInst.setMatrixAt(i, dummy.matrix);
    boxColliders.push({
      minX: bx - 0.18,
      maxX: bx + 0.18,
      minY: 0.16,
      maxY: 0.88,
      minZ: bz - 0.18,
      maxZ: bz + 0.18,
    });
  });
  bollardInst.computeBoundingSphere();
  group.add(bollardInst);

  // =========================================================================
  // 7. HARBOUR VISTA + 5 EXPANDED PLAYABLE DISTRICTS
  // =========================================================================
  const vista = buildElarionHarbourVista();
  group.add(vista.group);

  // -------------------------------------------------------------------------
  // 7A. GRAND HARBOUR QUAY & 3 WALKABLE CARGO PIERS (y = -0.30)
  // -------------------------------------------------------------------------
  for (let s = 0; s < 6; s++) {
    const t = (s + 0.5) / 6;
    const stepZ = -26.0 - t * 3.2;
    const stepTop = THREE.MathUtils.lerp(0.16, -0.3, t);
    addBox(0, -1.0, stepZ, 6.0, stepTop + 1.0, 3.2 / 6 + 0.04, matSandstone, { collide: false });
  }
  rampColliders.push({
    minX: -3.0,
    maxX: 3.0,
    minZ: -29.2,
    maxZ: -26.0,
    axis: '+z',
    yStart: -0.3,
    yEnd: 0.16,
  });
  addBox(-3.35, -0.3, -27.6, 0.7, 1.25, 3.2, matSandstone);
  addBox(3.35, -0.3, -27.6, 0.7, 1.25, 3.2, matSandstone);

  // Continuous Quay stone apron bridging Z = -34.0..-26.0 (X = -94..+94)
  addBox(0, -2.2, -30.0, 188.0, 1.9, 8.0, matPavement, { collide: false, castShadow: false });
  // Unified solid floor colliders for Quay + West Pier + Central Pier + East Pier (maxY = -0.30)
  boxColliders.push(
    { minX: -92.0, maxX: 92.0, minY: -2.2, maxY: -0.3, minZ: -62.5, maxZ: -26.0 },
    { minX: -35.0, maxX: -21.0, minY: -2.2, maxY: -0.3, minZ: -95.4, maxZ: -62.5 },
    { minX: -8.0, maxX: 8.0, minY: -2.2, maxY: -0.3, minZ: -87.4, maxZ: -62.5 },
    { minX: 15.0, maxX: 29.0, minY: -2.2, maxY: -0.3, minZ: -95.4, maxZ: -62.5 }
  );

  // District sea-wall retaining embankments along Z = -26.35 (leaving North Stairs [-3..+3] & West Quay Ramp [-63..-57] open!)
  addBox(-77.65, -0.3, -26.35, 28.7, 1.5, 0.65, matSandstone);
  addBox(-30.025, -0.3, -26.35, 53.35, 1.5, 0.65, matSandstone);
  addBox(47.675, -0.3, -26.35, 88.65, 1.5, 0.65, matSandstone);

  // Quay North Edge Safety Guardrails (leaving ALL THREE piers open: [-35..-21], [-8..+8], [+15..+29])
  addRailRunX(-91.8, -35.0, -0.3, -62.4);
  addRailRunX(-21.0, -8.0, -0.3, -62.4);
  addRailRunX(8.0, 15.0, -0.3, -62.4);
  addRailRunX(29.0, 91.8, -0.3, -62.4);
  addRailRunZ(-91.7, -0.3, -62.4, -26.0);
  addRailRunZ(91.7, -0.3, -62.4, -26.0);

  // West, Central & East Walkable Pier Guardrails
  addRailRunZ(-34.7, -0.3, -95.0, -62.4);
  addRailRunZ(-21.3, -0.3, -95.0, -62.4);
  addRailRunX(-34.7, -21.3, -0.3, -95.0);

  addRailRunZ(-7.7, -0.3, -87.0, -62.4);
  addRailRunZ(7.7, -0.3, -87.0, -62.4);
  addRailRunX(-7.7, 7.7, -0.3, -87.0);

  addRailRunZ(15.3, -0.3, -95.0, -62.4);
  addRailRunZ(28.7, -0.3, -95.0, -62.4);
  addRailRunX(15.3, 28.7, -0.3, -95.0);

  // Iron Mooring Bollards along all 3 piers
  for (const [bx, bz] of [
    [-33.6, -66],
    [-33.6, -76],
    [-33.6, -86],
    [-33.6, -92],
    [-22.4, -68],
    [-22.4, -80],
    [-22.4, -90],
    [-6.6, -66],
    [-6.6, -75],
    [-6.6, -83],
    [6.6, -66],
    [6.6, -75],
    [6.6, -83],
    [16.4, -68],
    [16.4, -80],
    [16.4, -90],
    [27.6, -66],
    [27.6, -76],
    [27.6, -86],
    [27.6, -92],
  ]) {
    addBox(bx, -0.3, bz, 0.42, 0.65, 0.42, matIron);
    addBox(bx, 0.35, bz, 0.56, 0.14, 0.56, matCopper, { collide: false });
  }

  // East Pier Harbour Beacon Tower (X = 22.0, Z = -89.5)
  {
    const bx = 22.0;
    const bz = -89.5;
    addBox(bx, -0.3, bz, 3.2, 5.4, 3.2, matSandstone);
    addBox(bx, 5.1, bz, 3.6, 0.35, 3.6, matCopper, { collide: false });
    addBox(bx, 5.45, bz, 1.9, 1.8, 1.9, matIron);
    addBox(bx, 5.75, bz, 1.2, 1.1, 1.2, matManaLamp, { collide: false });
    addBox(bx, 7.25, bz, 2.3, 0.8, 2.3, matCopper, { collide: false });
    sculpted.addCargoPallet(18.5, -0.3, -72.0, 0.15);
    sculpted.addCargoPallet(25.2, -0.3, -78.0, -0.2);
    sculpted.addCargoPallet(-28.0, -0.3, -89.5, 0.08);
  }

  // Central Shipyard Pier Landmarks & Cargo
  sculpted.addAnchorMonument(0, -0.3, -82.5, 0.25);
  sculpted.addCargoPallet(-4.8, -0.3, -72.0, 0.15);
  sculpted.addCargoPallet(4.8, -0.3, -76.5, -0.22);
  sculpted.addManaPylon(-5.6, -0.3, -84.2);
  sculpted.addManaPylon(5.6, -0.3, -84.2);

  // Synced Colliders for Viaduct Piers inside playable Quay (X = -82..+83)
  for (const px of [-82, -71, -60, -49, -38, -27, -16, -5, 6, 17, 28, 39, 50, 61, 72, 83]) {
    boxColliders.push({
      minX: px - 1.1,
      maxX: px + 1.1,
      minY: -0.3,
      maxY: 6.1,
      minZ: -36.6,
      maxZ: -32.4,
    });
  }

  // Synced Colliders for Harbour Warehouses, Guildhalls & Cranes from ElarionHarbourVista
  boxColliders.push(
    { minX: -86.0, maxX: -66.0, minY: -0.3, maxY: 6.8, minZ: -57.0, maxZ: -43.0 },
    { minX: -61.0, maxX: -39.0, minY: -0.3, maxY: 7.2, minZ: -57.0, maxZ: -43.0 },
    { minX: 33.0, maxX: 55.0, minY: -0.3, maxY: 7.4, minZ: -57.0, maxZ: -43.0 },
    { minX: 62.0, maxX: 84.0, minY: -0.3, maxY: 7.8, minZ: -57.0, maxZ: -43.0 },
    { minX: -31.8, maxX: -24.2, minY: -0.3, maxY: 5.2, minZ: -83.75, maxZ: -70.25 }
  );
  for (const [cx, cz] of [
    [-28, -58],
    [22, -65.5],
    [-4, -56],
  ]) {
    boxColliders.push({
      minX: cx - 2.15,
      maxX: cx + 2.15,
      minY: -0.3,
      maxY: 5.2,
      minZ: cz - 2.15,
      maxZ: cz + 2.15,
    });
  }

  // Customs Weighhouse & Harbourmaster Booth (X = +12.5..+17.5, Z = -41.5..-36.5)
  {
    const qy = -0.3;
    addBox(15.0, qy - 0.1, -39.0, 5.2, 0.2, 5.2, matTimber, { castShadow: false });
    addBox(17.3, qy, -39.0, 0.4, 3.2, 5.0, matSandstone);
    addBox(15.0, qy, -41.3, 5.0, 3.2, 0.4, matSandstone);
    addBox(15.0, qy, -36.7, 5.0, 3.2, 0.4, matSandstone);
    addBox(12.55, qy, -40.7, 0.4, 3.2, 1.4, matSandstone);
    addBox(12.55, qy, -37.3, 0.4, 3.2, 1.4, matSandstone);
    addBox(14.8, qy + 3.2, -39.0, 5.8, 0.35, 5.8, matCopper);
    sculpted.addGabledRoofWithRidge(14.8, qy + 3.55, -39.0, 5.8, 1.45, 5.8);
    addHangingSign(12.35, qy + 2.65, -39.0, -1, signHarbourTex);
    addBox(13.8, qy + 0.1, -39.0, 0.9, 1.0, 2.2, matDarkTimber);
    addBox(13.8, qy + 1.1, -39.0, 0.65, 0.08, 0.85, matParchment, { collide: false });
  }

  // Dockside Cargo Staging, Anchor Monument & Pallets along Expanded Quay
  addBox(-13.0, -0.3, -44.0, 5.6, 0.18, 4.6, matTimber);
  sculpted.addSculptedCrate(-14.2, -0.12, -45.0, 0.95, 0.12);
  sculpted.addSculptedCrate(-14.1, -0.12, -43.5, 0.85, -0.2);
  sculpted.addSculptedBarrel(-11.4, -0.12, -44.8);
  for (const cz of [-42.6, -43.4]) {
    addBox(-11.4, -0.12, cz, 0.65, 0.85, 0.65, matCopper);
    addBox(-11.4, 0.73, cz, 0.42, 0.28, 0.42, matManaLamp, { collide: false });
  }
  sculpted.addAnchorMonument(-64.0, -0.3, -38.5, -0.35);
  sculpted.addCargoPallet(67.0, -0.3, -40.0, 0.12);
  sculpted.addSculptedBench(64.5, -0.3, -30.0, Math.PI / 2);
  sculpted.addSculptedBench(-44.0, -0.3, -30.0, Math.PI / 2);
  sculpted.addHangingBunting(62.5, 4.6, -42.5, 83.5, 4.6, -42.5);
  sculpted.addHangingBunting(-85.5, 4.6, -42.5, -66.5, 4.6, -42.5);

  for (const [qx, qz] of [
    [-8.5, -31.0],
    [8.5, -31.0],
    [-20.0, -49.0],
    [10.0, -49.0],
    [-20.0, -60.5],
    [16.0, -60.5],
    [-54.0, -39.5],
    [-76.0, -39.5],
    [40.0, -39.5],
    [72.0, -39.5],
    [-22.2, -72.0],
    [-22.2, -88.0],
    [-5.8, -69.0],
    [5.8, -69.0],
    [16.5, -75.0],
    [16.5, -88.0],
  ]) {
    sculpted.addSculptedStreetLamp(qx, -0.3, qz);
  }

  // -------------------------------------------------------------------------
  // 7B. EXPANDED WEST INDUSTRIAL QUARTER (X = -132..-42, Z = -26..+50)
  // -------------------------------------------------------------------------
  // Continuous Industrial Yards (partitioned cleanly around Refinery Ave)
  addBox(-87.0, -0.4, -4.75, 90.0, 0.56, 34.5, matPavement, { castShadow: false });
  addBox(-87.0, -0.4, 37.25, 90.0, 0.56, 25.5, matPavement, { castShadow: false });

  // West Industrial Quay Descent Ramp (X = -63.0..-57.0, Z = -27.2..-22.0, y: -0.30 -> +0.16)
  for (let s = 0; s < 6; s++) {
    const t = (s + 0.5) / 6;
    const stepZ = THREE.MathUtils.lerp(-27.2, -22.0, t);
    const stepTop = THREE.MathUtils.lerp(-0.3, 0.16, t);
    addBox(-60.0, -1.0, stepZ, 6.0, stepTop + 1.0, 5.2 / 6 + 0.04, matSandstone, { collide: false });
  }
  rampColliders.push({
    minX: -63.0,
    maxX: -57.0,
    minZ: -27.2,
    maxZ: -22.0,
    axis: '+z',
    yStart: -0.3,
    yEnd: 0.16,
  });
  addBox(-63.3, -0.3, -24.6, 0.6, 1.35, 5.2, matSandstone);
  addBox(-56.7, -0.3, -24.6, 0.6, 1.35, 5.2, matSandstone);

  // North Industrial Yard Edge Safety Retaining Rails (Z = -22.1) & Split West Gatehouse Fence (Refinery Ave open Z=14.5..22.5!)
  addRailRunX(-131.5, -124.0, 0.16, -22.1);
  addRailRunX(-104.0, -87.0, 0.16, -22.1);
  addRailRunX(-56.6, -42.0, 0.16, -22.1);
  addBox(-131.7, 0.16, -3.75, 0.6, 2.8, 36.5, matIron);
  addBox(-131.7, 0.16, 36.25, 0.6, 2.8, 27.5, matIron);
  addBox(-131.7, 4.2, 18.5, 0.9, 1.5, 9.0, matDarkBrick);
  addBox(-87.0, 0.16, 50.0, 90.0, 4.2, 2.0, matDarkBrick);

  // Synced Colliders for Vista Pump House, Refinery Hall, Heavy Boiler Works & 4 Silos
  boxColliders.push(
    { minX: -56.75, maxX: -51.25, minY: 0.16, maxY: 9.0, minZ: -23.0, maxZ: -9.0 },
    { minX: -87.0, maxX: -67.0, minY: 0.16, maxY: 11.0, minZ: -27.0, maxZ: -11.0 },
    { minX: -124.0, maxX: -104.0, minY: 0.16, maxY: 11.6, minZ: -26.0, maxZ: -8.0 },
    { minX: -49.9, maxX: -44.1, minY: 0.16, maxY: 12.0, minZ: -14.4, maxZ: -8.6 },
    { minX: -49.9, maxX: -44.1, minY: 0.16, maxY: 12.0, minZ: -22.4, maxZ: -16.6 },
    { minX: -99.9, maxX: -94.1, minY: 0.16, maxY: 12.0, minZ: -14.4, maxZ: -8.6 },
    { minX: -99.9, maxX: -94.1, minY: 0.16, maxY: 12.0, minZ: -22.4, maxZ: -16.6 }
  );

  // Northwest Auxiliary Foundry Depot (X = -124..-100, Z = -3..+11)
  {
    addBox(-112.0, 0.16, 4.0, 24.0, 8.2, 14.0, matBrick);
    sculpted.addGabledRoofWithRidge(-112.0, 8.36, 4.0, 14.8, 2.4, 24.6, true);
    sculpted.addChimneyStack(-118.0, 9.2, 2.0);
    sculpted.addSculptedWindow(-106.0, 2.4, 11.05, '+z', 1.5, 1.5, false);
    sculpted.addSculptedWindow(-116.0, 2.4, 11.05, '+z', 1.5, 1.5, false);
    sculpted.addSculptedWindow(-99.95, 2.4, 4.0, '+x', 1.5, 1.5, false);
    sculpted.addCargoPallet(-96.0, 0.16, 8.5, 0.1);
  }

  // Mana Substation Pressure Regulator & Copper Conduit Manifold (X = -47.5, Z = +5.0)
  addBox(-47.5, 0.16, 5.0, 2.6, 1.65, 1.4, matIron);
  addBox(-47.5, 1.81, 5.0, 2.2, 0.35, 1.0, matCopper);
  addBox(-48.1, 1.25, 5.72, 0.26, 0.65, 0.2, matManaLamp, { collide: false });
  addBox(-47.5, 1.25, 5.72, 0.26, 0.65, 0.2, matManaLamp, { collide: false });
  addBox(-46.9, 1.25, 5.72, 0.26, 0.65, 0.2, matManaLamp, { collide: false });
  addBox(-47.5, 3.6, -2.5, 0.48, 0.48, 15.5, matCopper, { collide: false });

  // Accessible Interior #3: Mana-Smelting Foundry Hall (X = -86..-64, Z = -3.0..+11.0)
  {
    const minX = -86.0;
    const maxX = -64.0;
    const minZ = -3.0;
    const maxZ = 11.0;
    const floorY = 0.18;
    const wallH = 5.2;

    addBox((minX + maxX) * 0.5, -0.4, (minZ + maxZ) * 0.5, maxX - minX, 0.58, maxZ - minZ, matPavement, {
      castShadow: false,
    });
    addBox(minX + 0.3, floorY, (minZ + maxZ) * 0.5, 0.6, wallH, maxZ - minZ, matDarkBrick);
    addBox(maxX - 0.3, floorY, (minZ + maxZ) * 0.5, 0.6, wallH, maxZ - minZ, matDarkBrick);
    addBox((minX + maxX) * 0.5, floorY, minZ + 0.3, maxX - minX, wallH, 0.6, matDarkBrick);

    addBox(-82.0, floorY, maxZ - 0.3, 8.0, wallH, 0.6, matDarkBrick);
    addBox(-68.0, floorY, maxZ - 0.3, 8.0, wallH, 0.6, matDarkBrick);
    addBox(-75.0, floorY + 3.7, maxZ - 0.3, 6.0, 1.5, 0.6, matDarkBrick);
    addHangingSign(-71.2, floorY + 3.4, maxZ + 0.05, 1, signSmelteryTex, true);

    sculpted.addGabledRoofWithRidge((minX + maxX) * 0.5, floorY + wallH, (minZ + maxZ) * 0.5, maxZ - minZ + 0.8, 2.8, maxX - minX + 0.8, true);

    addBox(-75.0, floorY, -1.35, 4.2, 3.6, 2.2, matBrick);
    addBox(-75.0, floorY + 0.55, -0.2, 1.8, 1.25, 0.3, matFurnaceGlow, { collide: false });
    addBox(-75.0, floorY + 3.6, -1.35, 1.8, 2.2, 1.8, matCopper, { collide: false });
    addBox(-72.0, floorY, 3.6, 1.1, 0.95, 0.65, matIron);
    sculpted.addSculptedCrate(-67.0, floorY, 1.5, 0.9, 0.2);
    sculpted.addSculptedBarrel(-67.2, floorY, 3.2);
    sculpted.addSculptedCrate(-82.8, floorY, 2.2, 0.95, -0.1);

    const foundryLight = new THREE.PointLight(0xff8c42, 4.5, 18, 1.6);
    foundryLight.position.set(-75.0, floorY + 2.4, 2.2);
    group.add(foundryLight);
  }

  // Accessible Interior #4: West Forge & Assay Office (X = -62..-44, Z = +25..+36)
  {
    const minX = -62.0;
    const maxX = -44.0;
    const minZ = 25.0;
    const maxZ = 36.0;
    const floorY = 0.18;
    const wallH = 4.6;

    addBox((minX + maxX) * 0.5, -0.4, (minZ + maxZ) * 0.5, maxX - minX, 0.58, maxZ - minZ, matTimber, {
      castShadow: false,
    });
    addBox(minX + 0.3, floorY, (minZ + maxZ) * 0.5, 0.6, wallH, maxZ - minZ, matBrick);
    addBox(maxX - 0.3, floorY, (minZ + maxZ) * 0.5, 0.6, wallH, maxZ - minZ, matBrick);
    addBox((minX + maxX) * 0.5, floorY, maxZ - 0.3, maxX - minX, wallH, 0.6, matBrick);

    // North wall facing Refinery Ave with open 5.0m entrance (X = -55.5..-50.5)
    addBox(-58.75, floorY, minZ + 0.3, 6.5, wallH, 0.6, matBrick);
    addBox(-47.25, floorY, minZ + 0.3, 6.5, wallH, 0.6, matBrick);
    addBox(-53.0, floorY + 3.2, minZ + 0.3, 5.0, 1.4, 0.6, matBrick);
    addHangingSign(-49.6, floorY + 3.0, minZ - 0.05, -1, signAssayTex, true);

    sculpted.addSculptedWindow(-58.8, floorY + 1.9, minZ - 0.05, '-z', 1.4, 1.4, true);
    sculpted.addSculptedWindow(-47.2, floorY + 1.9, minZ - 0.05, '-z', 1.4, 1.4, true);
    sculpted.addGabledRoofWithRidge((minX + maxX) * 0.5, floorY + wallH, (minZ + maxZ) * 0.5, maxZ - minZ + 0.8, 2.4, maxX - minX + 0.8, true);
    sculpted.addChimneyStack(-53.0, floorY + wallH + 1.8, 34.0);

    // Assay Anvil, Brazier Hearth & Ingot Scales
    addBox(-53.0, floorY, 34.1, 3.2, 2.8, 1.6, matDarkBrick);
    addBox(-53.0, floorY + 0.5, 33.25, 1.4, 0.95, 0.25, matFurnaceGlow, { collide: false });
    addBox(-53.0, floorY, 32.1, 1.15, 0.92, 0.65, matIron);
    addBox(-59.2, floorY, 30.5, 1.2, 0.98, 3.4, matDarkTimber);
    addBox(-59.2, floorY + 0.98, 30.5, 0.52, 0.14, 1.2, matCopper, { collide: false });
    sculpted.addSculptedCrate(-46.5, floorY, 33.5, 0.85, 0.15);
    sculpted.addSculptedBarrel(-46.5, floorY, 28.0);

    const assayLight = new THREE.PointLight(0xff9b48, 3.8, 15, 1.7);
    assayLight.position.set(-53.0, floorY + 2.5, 30.5);
    group.add(assayLight);
  }

  // Assay Guildhouse (X = -124..-98, Z = +25..+44) & Worker Dining/Kilns (X = -92..-68, Z = +37..+50)
  {
    addBox(-111.0, 0.16, 34.5, 26.0, 7.8, 19.0, matSandstone);
    sculpted.addGabledRoofWithRidge(-111.0, 7.96, 34.5, 19.8, 2.6, 26.8, true);
    sculpted.addChimneyStack(-118.0, 8.8, 39.0);
    sculpted.addSculptedWindow(-116.0, 2.3, 24.95, '-z', 1.4, 1.5, true);
    sculpted.addSculptedWindow(-106.0, 2.3, 24.95, '-z', 1.4, 1.5, true);
    sculpted.addSculptedWindow(-111.0, 5.4, 24.95, '-z', 1.4, 1.4, false);
    sculpted.addFlowerBox(-116.0, 1.45, 24.82, '-z', 'gold');

    addBox(-80.0, 0.16, 43.5, 24.0, 6.8, 13.0, matTerracottaPlaster);
    addBox(-80.0, 0.16, 43.5, 24.15, 3.0, 13.15, matBrick, { collide: false });
    sculpted.addGabledRoofWithRidge(-80.0, 6.96, 43.5, 13.6, 2.2, 24.6, true);
    sculpted.addChimneyStack(-74.0, 7.6, 46.0);
    sculpted.addSculptedWindow(-86.0, 2.1, 36.95, '-z', 1.4, 1.4, true);
    sculpted.addSculptedWindow(-74.0, 2.1, 36.95, '-z', 1.4, 1.4, true);
    sculpted.addSculptedBench(-84.0, 0.16, 35.2, -Math.PI / 2);
    sculpted.addSculptedBench(-76.0, 0.16, 35.2, -Math.PI / 2);
  }

  for (const [lx, lz] of [
    [-42.5, 13.5],
    [-55.0, 13.5],
    [-68.0, 13.5],
    [-82.0, 13.5],
    [-96.0, 13.5],
    [-112.0, 13.5],
    [-125.0, 13.5],
    [-55.0, -5.0],
    [-62.0, -14.0],
    [-91.0, 2.0],
    [-93.0, 28.0],
    [-66.0, 32.0],
  ]) {
    sculpted.addSculptedStreetLamp(lx, 0.16, lz);
  }
  sculpted.addSculptedCrate(-49.6, 0.16, 10.5, 0.95, 0.08);
  sculpted.addSculptedBarrel(-49.8, 0.16, 12.0);
  sculpted.addMerchantCart(-60.5, 0.16, 5.5, 0.45);
  sculpted.addCargoPallet(-92.0, 0.16, 29.0, 0.2);
  sculpted.addManaPylon(-95.0, 0.16, -4.0);

  // -------------------------------------------------------------------------
  // 7C. SOUTH ARTISAN MARKET PLAZA & EXTENDED SOUTH BAZAAR BOULEVARD
  // -------------------------------------------------------------------------
  // Market Plaza Floor (X = -46..+46, Z = +52..+84, y = 0.16)
  addBox(0, -0.4, 68.0, 92.0, 0.56, 32.0, matPlaza, { castShadow: false });
  addBox(0, -0.4, 51.6, 9.0, 0.48, 0.8, matPavement, { collide: false, castShadow: false });

  // Central Southgate Market Obelisk Lantern (X = 0, Z = 66)
  {
    addBox(0, 0.16, 66.0, 2.8, 0.45, 2.8, matLimestone);
    addBox(0, 0.61, 66.0, 1.5, 2.2, 1.5, matSandstone);
    addBox(0, 2.81, 66.0, 0.85, 1.4, 0.85, matCopper);
    addBox(0, 4.21, 66.0, 0.65, 0.75, 0.65, matManaLamp, { collide: false });
    addBox(0, 4.96, 66.0, 0.95, 0.4, 0.95, matIron, { collide: false });
  }

  // 10 Canopied Market Stalls & Spoked-Wheel Merchant Carts + Dyed Goods Tables
  sculpted.addMarketStall(-12.5, 0.16, 59.5, Math.PI / 2, 'red');
  sculpted.addMarketStall(-12.5, 0.16, 66.5, Math.PI / 2, 'green');
  sculpted.addMarketStall(-12.5, 0.16, 73.5, Math.PI / 2, 'blue');
  sculpted.addMarketStall(12.5, 0.16, 59.5, -Math.PI / 2, 'blue');
  sculpted.addMarketStall(12.5, 0.16, 66.5, -Math.PI / 2, 'red');
  sculpted.addMarketStall(12.5, 0.16, 73.5, -Math.PI / 2, 'green');

  // 4 Additional Outer Market Stalls
  sculpted.addMarketStall(-27.5, 0.16, 61.5, Math.PI / 2, 'green');
  sculpted.addMarketStall(-27.5, 0.16, 72.5, Math.PI / 2, 'blue');
  sculpted.addMarketStall(27.5, 0.16, 61.5, -Math.PI / 2, 'red');
  sculpted.addMarketStall(27.5, 0.16, 72.5, -Math.PI / 2, 'green');

  sculpted.addGoodsDisplay(-20.0, 0.16, 67.0, Math.PI / 2);
  sculpted.addGoodsDisplay(20.0, 0.16, 67.0, -Math.PI / 2);
  sculpted.addMerchantCart(-22.5, 0.16, 56.5, -0.35);
  sculpted.addMerchantCart(22.5, 0.16, 76.5, 2.75);

  sculpted.addSculptedTreePlanter(-6.5, 0.16, 58.0, 1.0);
  sculpted.addSculptedTreePlanter(6.5, 0.16, 58.0, 1.0);
  sculpted.addSculptedTreePlanter(-6.5, 0.16, 74.5, 1.05);
  sculpted.addSculptedTreePlanter(6.5, 0.16, 74.5, 1.05);
  sculpted.addSculptedBench(-4.8, 0.16, 66.0, 0);
  sculpted.addSculptedBench(4.8, 0.16, 66.0, Math.PI);
  sculpted.addPottedShrub(-2.5, 0.16, 63.5, true);
  sculpted.addPottedShrub(2.5, 0.16, 63.5, true);
  sculpted.addPottedShrub(-2.5, 0.16, 68.5, true);
  sculpted.addPottedShrub(2.5, 0.16, 68.5, true);

  // Festive Market Plaza Hanging Bunting
  sculpted.addHangingBunting(-14.0, 4.6, 59.5, 14.0, 4.6, 59.5);
  sculpted.addHangingBunting(-14.0, 4.6, 66.5, 14.0, 4.6, 66.5);
  sculpted.addHangingBunting(-14.0, 4.6, 73.5, 14.0, 4.6, 73.5);

  // Market Plaza Perimeter Townhouses & South Arcade Archway (Z = 83 open X = -7..+7!)
  {
    addBox(-42.5, 0.16, 68.0, 7.0, 7.6, 32.0, matTerracottaPlaster);
    sculpted.addGabledRoofWithRidge(-42.5, 7.76, 68.0, 7.6, 2.2, 32.4);
    addBox(42.5, 0.16, 68.0, 7.0, 8.0, 32.0, matOchrePlaster);
    sculpted.addGabledRoofWithRidge(42.5, 8.16, 68.0, 7.6, 2.2, 32.4);

    // Split South Arcade Wall at Z = 83.0 leaving 14m open Arch into South Bazaar Boulevard!
    addBox(-23.0, 0.16, 83.0, 32.0, 6.8, 3.0, matSandstone);
    addBox(23.0, 0.16, 83.0, 32.0, 6.8, 3.0, matSandstone);
    addBox(0, 4.4, 83.0, 14.0, 2.56, 3.0, matSandstone);
    addBox(0, 4.35, 81.4, 5.2, 0.22, 0.18, matCopper, { collide: false });
    sculpted.addGabledRoofWithRidge(-23.0, 6.96, 83.0, 3.6, 1.6, 32.0, true);
    sculpted.addGabledRoofWithRidge(23.0, 6.96, 83.0, 3.6, 1.6, 32.0, true);

    for (const mz of [59.5, 66.5, 73.5]) {
      sculpted.addSculptedWindow(-38.95, 2.2, mz, '+x', 1.4, 1.5, true);
      sculpted.addSculptedWindow(-38.95, 5.2, mz, '+x', 1.25, 1.4, false);
      sculpted.addFlowerBox(-38.82, 4.35, mz, '+x', 'gold');
      sculpted.addSculptedWindow(38.95, 2.2, mz, '-x', 1.4, 1.5, true);
      sculpted.addSculptedWindow(38.95, 5.2, mz, '-x', 1.25, 1.4, false);
      sculpted.addFlowerBox(38.82, 4.35, mz, '-x', 'violet');
    }
    for (const [lx, lz] of [
      [-18.0, 54.5],
      [18.0, 54.5],
      [-26.0, 77.5],
      [26.0, 77.5],
      [-6.5, 79.5],
      [6.5, 79.5],
    ]) {
      sculpted.addSculptedStreetLamp(lx, 0.16, lz);
    }
  }

  // EXTENDED SOUTH BAZAAR BOULEVARD (X = -66..+66, Z = +84..+120.5)
  {
    addBox(0, -0.6, 102.0, 11.0, 0.6, 36.0, matRoad, { castShadow: false });
    addBox(0, -0.4, 84.0, 14.0, 0.48, 0.8, matPavement, { collide: false, castShadow: false });
    addBox(-35.75, -0.4, 102.25, 60.5, 0.56, 36.5, matPlaza, { castShadow: false });
    addBox(35.75, -0.4, 102.25, 60.5, 0.56, 36.5, matPlaza, { castShadow: false });

    // North connector walls closing off gaps at Z = 84.5 (X = -66..-46 and +46..+66)
    addBox(-56.0, 0.16, 84.5, 20.0, 4.6, 1.5, matBrick);
    addBox(56.0, 0.16, 84.5, 20.0, 4.6, 1.5, matSandstone);
    // West & East Boulevard Boundary Walls (X = ±65.5) & Grand Open South Bazaar Canal Archway (X = -7..+7 open!)
    addBox(-65.5, 0.16, 102.25, 1.5, 5.2, 36.5, matBrick);
    addBox(65.5, 0.16, 102.25, 1.5, 5.2, 36.5, matSandstone);
    addBox(-36.5, 0.16, 119.5, 59.0, 6.4, 2.0, matSandstone);
    addBox(36.5, 0.16, 119.5, 59.0, 6.4, 2.0, matSandstone);
    addBox(0, 4.8, 119.5, 14.0, 2.4, 2.4, matSandstone);
    sculpted.addManaPylon(-8.2, 0.16, 115.5);
    sculpted.addManaPylon(8.2, 0.16, 115.5);

    // Weaver's Guildhall (West: X = -44..-20, Z = +92..+112)
    addBox(-32.0, 0.16, 102.0, 24.0, 7.8, 20.0, matOchrePlaster);
    addBox(-32.0, 0.16, 102.0, 24.2, 3.2, 20.2, matSandstone, { collide: false });
    sculpted.addGabledRoofWithRidge(-32.0, 7.96, 102.0, 24.8, 2.6, 20.6);
    sculpted.addSculptedWindow(-19.95, 2.2, 97.5, '+x', 1.4, 1.6, true);
    sculpted.addSculptedWindow(-19.95, 2.2, 106.5, '+x', 1.4, 1.6, true);
    sculpted.addSculptedWindow(-19.95, 5.5, 97.5, '+x', 1.3, 1.4, false);
    sculpted.addSculptedWindow(-19.95, 5.5, 106.5, '+x', 1.3, 1.4, false);
    sculpted.addFlowerBox(-19.82, 4.65, 97.5, '+x', 'red');
    sculpted.addFlowerBox(-19.82, 4.65, 106.5, '+x', 'gold');
    addHangingSign(-19.95, 3.5, 102.0, 1, signWeaverTex);
    sculpted.addGoodsDisplay(-17.2, 0.16, 101.0, Math.PI / 2);
    sculpted.addGoodsDisplay(-17.2, 0.16, 104.5, Math.PI / 2);

    // Vintner's Guildhall & Cellars (East: X = +20..+44, Z = +92..+112)
    addBox(32.0, 0.16, 102.0, 24.0, 7.8, 20.0, matTerracottaPlaster);
    addBox(32.0, 0.16, 102.0, 24.2, 3.2, 20.2, matBrick, { collide: false });
    sculpted.addGabledRoofWithRidge(32.0, 7.96, 102.0, 24.8, 2.6, 20.6);
    sculpted.addSculptedWindow(19.95, 2.2, 97.5, '-x', 1.4, 1.6, true);
    sculpted.addSculptedWindow(19.95, 2.2, 106.5, '-x', 1.4, 1.6, true);
    sculpted.addSculptedWindow(19.95, 5.5, 97.5, '-x', 1.3, 1.4, false);
    sculpted.addSculptedWindow(19.95, 5.5, 106.5, '-x', 1.3, 1.4, false);
    sculpted.addFlowerBox(19.82, 4.65, 97.5, '-x', 'violet');
    addHangingSign(19.95, 3.5, 102.0, -1, signVintnerTex);
    sculpted.addSculptedBarrel(17.5, 0.16, 99.5);
    sculpted.addSculptedBarrel(17.5, 0.16, 100.7);
    sculpted.addSculptedBarrel(17.5, 0.16, 103.5);

    // Outer Boulevard Rowhouse Shops (X = -64..-48 and +48..+64)
    addBox(-56.0, 0.16, 102.0, 16.0, 6.8, 28.0, matSagePlaster);
    sculpted.addGabledRoofWithRidge(-56.0, 6.96, 102.0, 16.6, 2.2, 28.6);
    addBox(56.0, 0.16, 102.0, 16.0, 7.0, 28.0, matWarmPlaster);
    sculpted.addGabledRoofWithRidge(56.0, 7.16, 102.0, 16.6, 2.2, 28.6);

    // Boulevard Bazaar Stalls, Trees, Benches & Bunting
    sculpted.addMarketStall(-11.0, 0.16, 93.0, Math.PI / 2, 'blue');
    sculpted.addMarketStall(-11.0, 0.16, 109.0, Math.PI / 2, 'red');
    sculpted.addMarketStall(11.0, 0.16, 93.0, -Math.PI / 2, 'green');
    sculpted.addMarketStall(11.0, 0.16, 109.0, -Math.PI / 2, 'blue');

    sculpted.addSculptedTreePlanter(-11.5, 0.16, 101.0, 1.1);
    sculpted.addSculptedTreePlanter(11.5, 0.16, 101.0, 1.1);
    sculpted.addPottedShrub(-6.8, 0.16, 90.0, true);
    sculpted.addPottedShrub(6.8, 0.16, 90.0, true);
    sculpted.addPottedShrub(-6.8, 0.16, 112.0, true);
    sculpted.addPottedShrub(6.8, 0.16, 112.0, true);
    sculpted.addSculptedBench(-7.8, 0.16, 101.0, 0);
    sculpted.addSculptedBench(7.8, 0.16, 101.0, Math.PI);
    sculpted.addHangingBunting(-19.5, 5.2, 92.0, 19.5, 5.2, 94.0);
    sculpted.addHangingBunting(-19.5, 5.2, 108.0, 19.5, 5.2, 106.0);

    for (const [bx, bz] of [
      [-6.5, 89.0],
      [6.5, 89.0],
      [-6.5, 101.0],
      [6.5, 101.0],
      [-6.5, 113.0],
      [6.5, 113.0],
    ]) {
      sculpted.addSculptedStreetLamp(bx, 0.16, bz);
    }
  }

  // -------------------------------------------------------------------------
  // 7D. EXPANDED EAST ACADEMIC QUARTER COURTYARD (y = 1.76)
  // -------------------------------------------------------------------------
  // Paved East Concourse Plaza (X = +38.5..+46.5, Z = +12.5..+24.5, y = 0.16)
  addBox(42.5, -0.4, 18.5, 8.0, 0.56, 12.0, matPlaza, { castShadow: false });
  addBox(42.5, 0.16, 12.75, 8.0, 1.15, 0.5, matSandstone);
  addBox(42.5, 0.16, 24.25, 8.0, 1.15, 0.5, matSandstone);
  sculpted.addSculptedStreetLamp(42.0, 0.16, 14.0);
  sculpted.addSculptedStreetLamp(42.0, 0.16, 23.0);

  // Limestone Stairway ascending East (X = +46.5..+50.5, Z = +15.0..+22.0, y: 0.16 -> 1.76)
  for (let s = 0; s < 8; s++) {
    const t = (s + 0.5) / 8;
    const stepX = THREE.MathUtils.lerp(46.5, 50.5, t);
    const stepTop = THREE.MathUtils.lerp(0.16, 1.76, t);
    addBox(stepX, -0.4, 18.5, 4.0 / 8 + 0.04, stepTop + 0.4, 7.0, matLimestone, { collide: false });
  }
  rampColliders.push({
    minX: 46.5,
    maxX: 50.5,
    minZ: 15.0,
    maxZ: 22.0,
    axis: '+x',
    yStart: 0.16,
    yEnd: 1.76,
  });
  addBox(48.5, 0.16, 13.75, 4.0, 1.6, 2.5, matSandstone);
  addBox(48.5, 0.16, 23.25, 4.0, 1.6, 2.5, matSandstone);

  // Expanded Academic Courtyard Terraces (y = 1.76, cleanly partitioned west & south of Noble Heights)
  addBox(66.25, -0.4, 36.0, 31.5, 2.16, 96.0, matLimestone, { castShadow: false });
  addBox(87.0, -0.4, 71.0, 10.0, 2.16, 26.0, matLimestone, { castShadow: false });

  // Courtyard Retaining Balustrades + East Academic Descent Ramp toward East Canal Bridge (Z = 66..76)
  addRailRunZ(50.7, 1.76, -11.7, 15.0);
  addRailRunZ(50.7, 1.76, 22.0, 83.7);
  addRailRunX(50.7, 81.8, 1.76, -11.7);
  addRailRunX(50.7, 91.7, 1.76, 83.7);
  addRailRunZ(91.7, 1.76, 58.2, 66.0);
  addRailRunZ(91.7, 1.76, 76.0, 83.7);
  for (let s = 0; s < 8; s++) {
    const t = (s + 0.5) / 8;
    const stepX = THREE.MathUtils.lerp(92.0, 100.0, t);
    const stepTop = THREE.MathUtils.lerp(1.76, 0.16, t);
    addBox(stepX, -0.4, 71.0, 8.0 / 8 + 0.04, stepTop + 0.4, 10.0, matLimestone, { collide: false });
  }
  rampColliders.push({
    minX: 92.0,
    maxX: 100.0,
    minZ: 66.0,
    maxZ: 76.0,
    axis: '-x',
    yStart: 0.16,
    yEnd: 1.76,
  });

  // Twin Mana Beacons framing Academic Landing
  for (const bz of [14.6, 22.4]) {
    addBox(50.8, 1.76, bz, 0.72, 1.45, 0.72, matLimestone);
    addBox(50.8, 3.21, bz, 0.42, 0.35, 0.42, matCopper, { collide: false });
    addBox(50.8, 3.56, bz, 0.28, 0.38, 0.28, matManaLamp, { collide: false });
  }

  sculpted.addAstrolabeMonument(62.5, 1.76, 23.0);

  // North Wing: Aetheric Conservatory (X = +56..+78, Z = -10.0..+1.0)
  {
    addBox(67.0, 1.76, -4.5, 22.0, 8.2, 11.0, matLimestone);
    const glassAtriumGeo = new THREE.CylinderGeometry(4.2, 4.6, 3.8, 12);
    const atriumDomeGeo = new THREE.SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    disposables.push(glassAtriumGeo, atriumDomeGeo);
    const glassAtrium = new THREE.Mesh(glassAtriumGeo, matGlass);
    glassAtrium.position.set(67.0, 1.76 + 8.2 + 1.9, -4.5);
    const atriumDome = new THREE.Mesh(atriumDomeGeo, matCopper);
    atriumDome.position.set(67.0, 1.76 + 12.0, -4.5);
    group.add(glassAtrium, atriumDome);

    sculpted.addSculptedWindow(60.0, 4.2, 1.05, '+z', 1.6, 2.1, false);
    sculpted.addSculptedWindow(67.0, 4.2, 1.05, '+z', 1.6, 2.1, false);
    sculpted.addSculptedWindow(74.0, 4.2, 1.05, '+z', 1.6, 2.1, false);
    sculpted.addFlowerBox(60.0, 2.9, 1.18, '+z', 'violet');
    sculpted.addFlowerBox(74.0, 2.9, 1.18, '+z', 'gold');
    addHangingSign(67.0, 5.4, 1.05, 1, signConservatoryTex, true);
    sculpted.addPottedShrub(58.0, 1.76, 2.0, true);
    sculpted.addPottedShrub(76.0, 1.76, 2.0, true);
  }

  // Aetheric Lecture Hall (X = +55..+69, Z = +4.2..+12.2)
  {
    addBox(62.0, 1.76, 8.2, 14.0, 8.4, 8.0, matLimestone);
    sculpted.addGabledRoofWithRidge(62.0, 10.16, 8.2, 8.8, 2.4, 14.4, true);
    sculpted.addSculptedWindow(58.5, 4.0, 12.25, '+z', 1.5, 2.0, false);
    sculpted.addSculptedWindow(65.5, 4.0, 12.25, '+z', 1.5, 2.0, false);
    sculpted.addSculptedWindow(62.0, 7.4, 12.25, '+z', 1.4, 1.6, false);
    addHangingSign(62.0, 5.1, 12.25, 1, signArchiveTex, true);
  }

  // Academic Observatory Tower (X = +55..+69, Z = +37..+51, y = 1.76)
  {
    addBox(62.0, 1.76, 44.0, 14.0, 21.0, 14.0, matLimestone);
    addBox(62.0, 22.76, 44.0, 14.8, 0.85, 14.8, matSandstone, { collide: false });
    const obsDomeGeo = new THREE.SphereGeometry(5.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    disposables.push(obsDomeGeo);
    const obsDome = new THREE.Mesh(obsDomeGeo, matCopper);
    obsDome.position.set(62.0, 23.6, 44.0);
    obsDome.castShadow = true;
    group.add(obsDome);
    const scopeGeo = new THREE.CylinderGeometry(0.45, 0.65, 5.2, 10);
    disposables.push(scopeGeo);
    const scope = new THREE.Mesh(scopeGeo, matIron);
    scope.position.set(62.0, 26.8, 41.0);
    scope.rotation.x = 0.88;
    group.add(scope);

    for (const wy of [4.8, 10.2, 16.0]) {
      sculpted.addSculptedWindow(62.0, wy, 36.95, '-z', 1.8, 2.4, false);
      sculpted.addSculptedWindow(54.95, wy, 44.0, '-x', 1.8, 2.4, false);
    }
  }

  // Grand Archive & Library Hall (X = +69..+81, Z = +49..+63, y = 1.76)
  {
    addBox(75.0, 1.76, 56.0, 12.0, 18.0, 14.0, matSandstone);
    sculpted.addGabledRoofWithRidge(75.0, 19.76, 56.0, 12.8, 3.2, 14.6);
    addBox(68.8, 1.76, 56.0, 0.4, 4.2, 3.2, matDarkTimber, { collide: false });
    sculpted.addSculptedWindow(68.95, 7.6, 52.5, '-x', 1.5, 2.2, false);
    sculpted.addSculptedWindow(68.95, 7.6, 59.5, '-x', 1.5, 2.2, false);
    sculpted.addSculptedWindow(75.0, 7.6, 48.95, '-z', 1.6, 2.2, false);
  }

  // South Cartography Hall (X = +56..+78, Z = +69..+81, y = 1.76)
  {
    addBox(67.0, 1.76, 75.0, 22.0, 10.4, 12.0, matLimestone);
    sculpted.addGabledRoofWithRidge(67.0, 12.16, 75.0, 12.8, 2.8, 22.6, true);
    sculpted.addSculptedWindow(61.0, 4.4, 68.95, '-z', 1.6, 2.1, false);
    sculpted.addSculptedWindow(67.0, 4.4, 68.95, '-z', 1.6, 2.1, false);
    sculpted.addSculptedWindow(73.0, 4.4, 68.95, '-z', 1.6, 2.1, false);
    sculpted.addFlowerBox(61.0, 3.1, 68.82, '-z', 'gold');
    sculpted.addFlowerBox(73.0, 3.1, 68.82, '-z', 'red');
    sculpted.addManaPylon(86.0, 1.76, 70.0);
  }

  sculpted.addSculptedTreePlanter(55.5, 1.76, 28.0, 1.15);
  sculpted.addSculptedTreePlanter(69.5, 1.76, 28.0, 1.05);
  sculpted.addSculptedTreePlanter(55.5, 1.76, 58.0, 1.1);
  sculpted.addSculptedBench(56.0, 1.76, 19.0, 0);
  sculpted.addSculptedBench(63.0, 1.76, 32.5, -Math.PI / 2);
  sculpted.addHangingBunting(54.5, 5.8, 12.5, 69.5, 5.8, 14.5);
  for (const [ax, az] of [
    [52.5, 15.0],
    [52.5, 22.0],
    [68.0, 14.0],
    [68.0, 23.0],
    [68.0, 34.0],
    [76.0, 44.0],
    [56.0, 64.5],
    [83.5, 64.5],
  ]) {
    sculpted.addSculptedStreetLamp(ax, 1.76, az);
  }

  // -------------------------------------------------------------------------
  // 7E. EXPANDED NOBLE HEIGHTS TERRACE (y = 5.20) & CIVIC PLAZA
  // -------------------------------------------------------------------------
  // Grand Limestone Ceremonial Staircase climbing East (X = +71.0..+82.0, Z = +15.0..+22.0, y: 1.76 -> 5.20)
  for (let s = 0; s < 14; s++) {
    const t = (s + 0.5) / 14;
    const stepX = THREE.MathUtils.lerp(71.0, 82.0, t);
    const stepTop = THREE.MathUtils.lerp(1.76, 5.2, t);
    addBox(stepX, 0.0, 18.5, 11.0 / 14 + 0.04, stepTop, 7.0, matLimestone, { collide: false });
  }
  rampColliders.push({
    minX: 71.0,
    maxX: 82.0,
    minZ: 15.0,
    maxZ: 22.0,
    axis: '+x',
    yStart: 1.76,
    yEnd: 5.2,
  });
  addBox(76.5, 1.76, 14.3, 11.0, 3.6, 1.4, matLimestone);
  addBox(76.5, 1.76, 22.7, 11.0, 3.6, 1.4, matLimestone);

  // Elevated Noble Heights Upper Terrace (X = +82.0..+135.5, Z = -12.0..+58.0, y = 5.20) — East side open into Citadel!
  addBox(108.75, -0.4, 23.0, 53.5, 5.6, 70.0, matLimestone, { castShadow: false });
  addRailRunZ(82.3, 5.2, -11.7, 15.0);
  addRailRunZ(82.3, 5.2, 22.0, 57.7);
  addRailRunX(82.3, 135.2, 5.2, -11.7);
  addRailRunX(82.3, 135.2, 5.2, 57.7);

  // House Vaelcrest Council Dome Hall (X = +106..+132, Z = +10..+34, base y = 5.20)
  {
    addBox(119.0, 5.2, 22.0, 26.0, 14.5, 24.0, matLimestone);
    addBox(119.0, 19.7, 22.0, 27.2, 1.1, 25.2, matSandstone, { collide: false });
    addBox(119.0, 20.8, 22.0, 15.0, 2.8, 15.0, matLimestone, { collide: false });

    const councilDomeGeo = new THREE.SphereGeometry(7.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    disposables.push(councilDomeGeo);
    const councilDome = new THREE.Mesh(councilDomeGeo, matCopper);
    councilDome.position.set(119.0, 23.6, 22.0);
    councilDome.castShadow = true;
    group.add(councilDome);

    // Classical Limestone Portico Columns along West Facade (X = 104.8)
    const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 9.6, 12);
    disposables.push(colGeo);
    for (const cz of [14.5, 17.2, 19.8, 24.2, 26.8, 29.5]) {
      const col = new THREE.Mesh(colGeo, matLimestone);
      col.position.set(104.8, 5.2 + 4.8, cz);
      col.castShadow = true;
      group.add(col);
      boxColliders.push({
        minX: 104.3,
        maxX: 105.3,
        minY: 5.2,
        maxY: 14.8,
        minZ: cz - 0.5,
        maxZ: cz + 0.5,
      });
    }
    addBox(105.2, 14.8, 22.0, 2.8, 1.3, 17.0, matLimestone, { collide: false });
    addBox(105.9, 5.2, 22.0, 0.35, 5.6, 3.8, matCopper, { collide: false });

    // Lord Vaelcrest Manor Wing (North: X = +96..+124, Z = -9.0..+6.0)
    addBox(110.0, 5.2, -1.5, 28.0, 11.5, 15.0, matWarmPlaster);
    addBox(110.0, 5.2, -1.5, 28.2, 4.2, 15.2, matLimestone, { collide: false });
    sculpted.addGabledRoofWithRidge(110.0, 16.7, -1.5, 15.8, 3.2, 28.6, true);
    sculpted.addSculptedWindow(102.0, 8.2, 6.05, '+z', 1.6, 2.2, false);
    sculpted.addSculptedWindow(110.0, 8.2, 6.05, '+z', 1.6, 2.2, false);
    sculpted.addSculptedWindow(118.0, 8.2, 6.05, '+z', 1.6, 2.2, false);
    sculpted.addFlowerBox(102.0, 6.9, 6.18, '+z', 'gold');
    sculpted.addFlowerBox(118.0, 6.9, 6.18, '+z', 'red');

    // Chancery & Diplomatic Rotunda (South: X = +96..+124, Z = +38.0..+54.0)
    addBox(110.0, 5.2, 46.0, 28.0, 11.0, 16.0, matLimestone);
    sculpted.addGabledRoofWithRidge(110.0, 16.2, 46.0, 16.8, 3.0, 28.6, true);
    const chanceryDome = new THREE.Mesh(councilDomeGeo, matCopper);
    chanceryDome.scale.setScalar(0.68);
    chanceryDome.position.set(110.0, 16.2, 46.0);
    group.add(chanceryDome);
    sculpted.addSculptedWindow(102.0, 8.2, 37.95, '-z', 1.6, 2.2, false);
    sculpted.addSculptedWindow(110.0, 8.2, 37.95, '-z', 1.6, 2.2, false);
    sculpted.addSculptedWindow(118.0, 8.2, 37.95, '-z', 1.6, 2.2, false);
    sculpted.addFlowerBox(110.0, 6.9, 37.82, '-z', 'violet');

    // Twin Mana Brazier Beacons + Council Crest Stele + Pylons
    for (const bz of [16.0, 28.0]) {
      addBox(97.5, 5.2, bz, 0.85, 1.65, 0.85, matLimestone);
      addBox(97.5, 6.85, bz, 0.5, 0.4, 0.5, matCopper, { collide: false });
      addBox(97.5, 7.25, bz, 0.32, 0.42, 0.32, matManaLamp, { collide: false });
    }
    addBox(101.2, 5.2, 18.5, 0.65, 2.15, 1.5, matLimestone);
    addBox(100.85, 6.0, 18.5, 0.12, 0.95, 1.05, matCopper, { collide: false });

    sculpted.addManaPylon(89.5, 5.2, 9.0);
    sculpted.addManaPylon(89.5, 5.2, 35.0);
    sculpted.addSculptedTreePlanter(88.5, 5.2, -2.0, 1.15);
    sculpted.addSculptedTreePlanter(88.5, 5.2, 45.0, 1.15);
    sculpted.addPottedShrub(94.0, 5.2, 11.0, true);
    sculpted.addPottedShrub(94.0, 5.2, 33.0, true);
    sculpted.addSculptedBench(88.5, 5.2, 12.2, 0);
    sculpted.addSculptedBench(88.5, 5.2, 31.8, 0);
    sculpted.addSculptedStreetLamp(84.2, 5.2, 14.2);
    sculpted.addSculptedStreetLamp(84.2, 5.2, 22.8);
    sculpted.addSculptedStreetLamp(94.5, 5.2, 3.0);
    sculpted.addSculptedStreetLamp(94.5, 5.2, 40.0);
  }

  // =========================================================================
  // 8. EXPANDED DISTRICT NPC SPAWNS (38 Multi-Action Citizens across 5 Districts)
  // =========================================================================
  const npcSpawns: NpcSpawnSpec[] = [
    {
      id: 'npc_harbour_worker',
      role: 'Harbour Worker',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-6.5, 0.16, -23.5],
      facingYaw: Math.PI / 2,
      tunicColor: 0x4b5866,
      accentColor: 0xc27f4e,
      moveSpeed: 1.55,
      waypoints: [
        [-6.5, 0.16, -23.5],
        [6.5, 0.16, -23.5],
        [6.5, 0.16, -15.5],
        [6.5, 0.16, -23.5],
      ],
      dialogueLines: [
        'Three cargo piers stretch out into Elarion Bay now—West Pier, Central Shipyard Pier, and East Pier.',
        'Mind the railway viaduct overhead—the freight run from the West refineries barely slows for the curve.',
      ],
      randomDialogues: [
        [
          'Just finished checking the north parapet lamps along the overlook.',
          'You can see all the way to the outer breakwater lighthouse when the morning mist lifts.',
        ],
        [
          'Hear that rumble? West Boiler Works sent another string of copper tankers across the viaduct.',
          'Harbour traffic has doubled since House Vaelcrest opened the third pier.',
        ],
      ],
    },
    {
      id: 'npc_dock_porter',
      role: 'Dock Porter',
      behavior: 'work',
      actionKind: 'haul',
      position: [7.6, 0.16, -15.6],
      facingYaw: Math.PI / 2,
      tunicColor: 0x6b5340,
      accentColor: 0x3b444f,
      dialogueLines: [
        'Copper-sealed crates go to the Chandlery; bulk grain heads south through the gate into Artisan Market Plaza.',
        'Every lift crane on the quay runs off refined external mana piped from the West silos.',
      ],
      randomDialogues: [
        [
          'Feels like these oak crates gain five pounds every flight of stairs up from the quay.',
          'Good thing the Warehouse Annex hoist saves our backs on the heavy iron.',
        ],
        [
          'Vintner Hall down on South Bazaar Boulevard bought half our eastern cargo lot.',
          'Rest goes straight to the shipwrights on Central Pier.',
        ],
      ],
    },
    {
      id: 'npc_chandlery_clerk',
      role: 'Customs Clerk',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [-13.4, 0.18, 7.8],
      facingYaw: Math.PI / 2,
      tunicColor: 0x293b4d,
      accentColor: 0xb67a4e,
      dialogueLines: [
        'House Vaelcrest levies standard harbour dues on raw mana crystal and foreign timber alike.',
        'If your vessel is moored at the outer piers, check the quay booth below the viaduct for berth clearance.',
      ],
      randomDialogues: [
        [
          'Stamp, weigh, cross-index—three ledgers for every ship that drops anchor in Elarion.',
          'Even the West Forge Assay Office sends brass seal-dies here for inspection.',
        ],
      ],
    },
    {
      id: 'npc_tavern_barkeep',
      role: 'Tavern Barkeep',
      behavior: 'work',
      actionKind: 'sweep',
      position: [13.8, 0.18, -3.2],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x7a3d31,
      accentColor: 0xd4a65a,
      dialogueLines: [
        'Warm broth and bitter ale—best cure after a twelve-hour shift in the Smelting Hall.',
        'Check the notice board outside our door if you want the latest shipping and foundry bulletins.',
      ],
      randomDialogues: [
        [
          'Shipwrights from Central Pier drank half a cask before noon celebrating a clean keel launch.',
          'Keep your boots dry and pull up a stool whenever the rain squalls roll in.',
        ],
        [
          'Suncoast vintages arrived fresh from Vintner Hall this morning—brighter stuff than sailor grog!',
        ],
      ],
    },
    {
      id: 'npc_trade_merchant',
      role: 'Merchant',
      behavior: 'work',
      actionKind: 'announce',
      position: [7.6, 0.16, 9.0],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x3b5c49,
      accentColor: 0xd6963a,
      dialogueLines: [
        'Fine brass fittings, oiled canvas, and Vaelcrest harbour charts—step right up to the Trade House!',
        'Head south through the City Gate if you want the open-air stalls at Artisan Market Plaza.',
      ],
      randomDialogues: [
        [
          'Prices on precision horology gears dropped this week since Foundry Row boosted output!',
          'Even scholars from the Conservatory come down here for copper wire.',
        ],
      ],
    },
    {
      id: 'npc_plaza_resident_a',
      role: 'Resident',
      behavior: 'interact',
      actionKind: 'converse',
      position: [22.2, 0.16, 3.0],
      facingYaw: Math.PI / 2,
      tunicColor: 0x624b75,
      accentColor: 0xc9a36a,
      dialogueLines: [
        'Copperwell Square stays peaceful enough, even when the western refinery vents roar.',
        'The cistern fountain draws clean pressure from the district conduit line.',
      ],
      randomDialogues: [
        [
          'Look at the flower boxes along the Apothecary this season—sun-gold blooms all along the cornice.',
          'The whole neighbourhood looks twice as bright after festival bunting went up.',
        ],
      ],
    },
    {
      id: 'npc_plaza_resident_b',
      role: 'Resident',
      behavior: 'interact',
      actionKind: 'converse',
      position: [23.3, 0.16, 3.1],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x3c6b5e,
      accentColor: 0xd6963a,
      dialogueLines: [
        'My sister studies up at the new Aetheric Conservatory—climb the East concourse steps to walk the Academic Courtyard.',
        'From there the grand limestone stairway climbs all the way to House Vaelcrest Council Hall.',
      ],
      randomDialogues: [
        [
          'You should walk down South Bazaar Boulevard if you have time—the Weaver Guild hung teal silks everywhere.',
        ],
      ],
    },
    {
      id: 'npc_courtyard_worker',
      role: 'Resident',
      behavior: 'patrol',
      actionKind: 'haul',
      position: [-24.2, 0.16, 2.5],
      facingYaw: 0,
      tunicColor: 0x5c4f44,
      accentColor: 0x8f7a66,
      moveSpeed: 1.4,
      waypoints: [
        [-24.2, 0.16, 2.5],
        [-24.2, 0.16, 13.5],
        [-13.5, 0.16, 13.5],
        [-13.5, 0.16, 2.75],
        [-22.0, 0.16, 2.75],
      ],
      dialogueLines: [
        'We cut through the covered alley to reach Harbourgate Lane faster during shift change.',
        'Shared pump pressure drops whenever the Smelting Hall draws a full crucible charge.',
      ],
      randomDialogues: [
        [
          'Hauling spare pipe couplings from the tenement pump over to Foundry Row.',
          'Watch your step on the cobbles near the alley arch.',
        ],
      ],
    },
    {
      id: 'npc_city_guard',
      role: 'City Guard',
      behavior: 'patrol',
      actionKind: 'watch',
      position: [-5.8, 0.16, 14.2],
      facingYaw: 0,
      tunicColor: 0x26313d,
      accentColor: 0xb67a4e,
      moveSpeed: 1.65,
      waypoints: [
        [-5.8, 0.16, 14.2],
        [-5.8, 0.16, -6.0],
        [5.8, 0.16, -6.0],
        [5.8, 0.16, 14.2],
        [20.5, 0.16, 14.2],
        [5.8, 0.16, 14.2],
      ],
      dialogueLines: [
        'All five quarters are open—three Harbour Piers north, Boiler Works & West Forge west, Bazaar Boulevard south, Academic & Noble Plaza east.',
        'Keep clear of pressurized mana manifolds unless you hold a guild seal.',
      ],
      randomDialogues: [
        [
          'Quiet patrol so far—most trouble today was a runaway melon cart in Market Plaza.',
          'Hold E near any guild sign or monument if you want full civic records.',
        ],
      ],
    },
    {
      id: 'npc_harbourmaster',
      role: 'Harbourmaster',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [12.1, -0.3, -39.0],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x1f3344,
      accentColor: 0x6ecad9,
      dialogueLines: [
        'Welcome to Grand Harbour Quay. All three piers are active—West Pier, Central Shipyard Pier, and East Pier.',
        'Every ton of cargo logged here feeds the freight viaduct above us or the Chandlery up Harbourgate Lane.',
      ],
      randomDialogues: [
        [
          'Mariners Guildhall on the far east quay handles deep-sea pilot licenses now.',
          'Shipwright Drydock on the far west edge is fitting three new copper keels.',
        ],
      ],
    },
    {
      id: 'npc_quay_tallyman',
      role: 'Dock Porter',
      behavior: 'patrol',
      actionKind: 'haul',
      position: [-10.0, -0.3, -44.0],
      facingYaw: 0,
      tunicColor: 0x574b3d,
      accentColor: 0xb67a4e,
      moveSpeed: 1.5,
      waypoints: [
        [-10.0, -0.3, -44.0],
        [-10.0, -0.3, -52.5],
        [4.0, -0.3, -52.5],
        [4.0, -0.3, -44.0],
      ],
      dialogueLines: [
        'Watch the crane boom swings along the sea wall—the mana-driven slews run steady all afternoon.',
        'Outbound merchantman clears the breakwater once the customs manifest is stamped.',
      ],
      randomDialogues: [
        [
          'Sorting oak planking for the Central Shipyard crews—keep the pier deck clear!',
        ],
      ],
    },
    {
      id: 'npc_pier_lookout',
      role: 'Harbour Worker',
      behavior: 'idle',
      actionKind: 'watch',
      position: [20.2, -0.3, -84.5],
      facingYaw: 0,
      tunicColor: 0x3b4c5e,
      accentColor: 0x6ecad9,
      dialogueLines: [
        'From the East Pier beacon you can watch outbound vessels catch the tide beyond the stone breakwaters.',
        'The merchantman moored beside us is loading sealed cyan mana canisters bound for the southern straits.',
      ],
      randomDialogues: [
        [
          'Sea breeze hits clean out here—no foundry soot reaches past the viaduct.',
        ],
      ],
    },
    {
      id: 'npc_west_pier_docker',
      role: 'Dock Porter',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-22.8, -0.3, -66.0],
      facingYaw: Math.PI,
      tunicColor: 0x57483c,
      accentColor: 0xa66e46,
      moveSpeed: 1.45,
      waypoints: [
        [-22.8, -0.3, -66.0],
        [-22.8, -0.3, -90.5],
        [-32.8, -0.3, -90.5],
        [-32.8, -0.3, -66.0],
      ],
      dialogueLines: [
        'Mind the mooring lines along West Pier—crews are offloading oak timber and raw copper ingots.',
        'West Pier Warehouse holds bonded bulk ore before it moves west to the Refinery Hall.',
      ],
    },
    {
      id: 'npc_central_pier_shipwright',
      role: 'Engineer',
      behavior: 'work',
      actionKind: 'forge',
      position: [-2.5, -0.3, -72.0],
      facingYaw: Math.PI / 2,
      tunicColor: 0x45352c,
      accentColor: 0xc27f4e,
      dialogueLines: [
        'Forging bronze rudder pintles right on Central Shipyard Pier for the brigantine berthed beside us!',
        'External mana keeps every shipwright’s rivet brazier glowing steady even in harbour winds.',
      ],
      randomDialogues: [
        [
          'Clang-clang-temper! One clean hull bracket down, twelve more before evening bell.',
        ],
      ],
    },
    {
      id: 'npc_central_pier_rigger',
      role: 'Harbour Worker',
      behavior: 'patrol',
      actionKind: 'haul',
      position: [2.0, -0.3, -67.0],
      facingYaw: 0,
      tunicColor: 0x2c606e,
      accentColor: 0xd6963a,
      moveSpeed: 1.45,
      waypoints: [
        [2.0, -0.3, -67.0],
        [2.0, -0.3, -80.0],
        [-2.0, -0.3, -80.0],
        [-2.0, -0.3, -67.0],
      ],
      dialogueLines: [
        'Fresh hemp cordage and brass blocks going out to the Central Pier anchor monument!',
        'That old iron anchor at the pier head was salvaged from House Vaelcrest’s very first flagship.',
      ],
    },
    {
      id: 'npc_mariners_quartermaster',
      role: 'Customs Clerk',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [68.0, -0.3, -41.0],
      facingYaw: Math.PI,
      tunicColor: 0x263f4f,
      accentColor: 0x6ecad9,
      dialogueLines: [
        'Welcome to Mariners Guildhall at the eastern end of the quay.',
        'Sea-pilots draw coastal tide tables and external-mana compass seals from our hall.',
      ],
    },
    {
      id: 'npc_drydock_sweeper',
      role: 'Harbour Worker',
      behavior: 'work',
      actionKind: 'sweep',
      position: [-72.0, -0.3, -41.0],
      facingYaw: Math.PI,
      tunicColor: 0x52463d,
      accentColor: 0xa66e46,
      dialogueLines: [
        'Sweeping oak shavings clear of the Shipwright Drydock apron before the next tide-gate opens.',
        'Nothing catches a stray spark faster than dry pine sawdust near a mana-stoked forge.',
      ],
    },
    {
      id: 'npc_conduit_engineer',
      role: 'Engineer',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [-46.2, 0.16, 6.8],
      facingYaw: Math.PI,
      tunicColor: 0x3b3532,
      accentColor: 0x5299ae,
      dialogueLines: [
        'This substation steps down external mana pressure from the four storage silos before feeding Harbourgate lamps.',
        'Walk north past the twin silos and copper flywheel to take the ramp right down onto the Quay.',
      ],
    },
    {
      id: 'npc_smeltery_smith',
      role: 'Engineer',
      behavior: 'work',
      actionKind: 'forge',
      position: [-73.5, 0.18, 3.2],
      facingYaw: Math.PI,
      tunicColor: 0x453028,
      accentColor: 0xd1824b,
      dialogueLines: [
        'Mana-stoked crucibles reach tempering heat in half the time of coal—and leave zero soot on Vaelcrest bronze.',
        'Careful near the hearth mouth; raw crucible coils run hot enough to melt iron tongs.',
      ],
      randomDialogues: [
        [
          'Every viaduct rail overhead started as raw ore in this very hall!',
        ],
      ],
    },
    {
      id: 'npc_refinery_patrol',
      role: 'Harbour Worker',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-61.0, 0.16, 18.5],
      facingYaw: Math.PI / 2,
      tunicColor: 0x4a4e54,
      accentColor: 0xb67a4e,
      moveSpeed: 1.55,
      waypoints: [
        [-61.0, 0.16, 18.5],
        [-88.5, 0.16, 18.5],
        [-88.5, 0.16, 12.2],
        [-61.0, 0.16, 12.2],
      ],
      dialogueLines: [
        'Refinery Avenue keeps wagons rolling from Boiler Works and Smelting Hall all the way down Foundry Row.',
        'The Pump House flywheel never stops turning while the eastern harbour cranes are drawing load.',
      ],
    },
    {
      id: 'npc_west_forge_assayer',
      role: 'Engineer',
      behavior: 'work',
      actionKind: 'forge',
      position: [-53.0, 0.18, 31.4],
      facingYaw: 0,
      tunicColor: 0x4f2f28,
      accentColor: 0xd98a4e,
      dialogueLines: [
        'Step inside the West Forge & Assay Office! Every copper ingot from the Smelting Hall gets stamped for purity here.',
        'You can inspect our assay counter and live brazier hearth right inside.',
      ],
      randomDialogues: [
        [
          'Purity tests keep guild merchants honest—House Vaelcrest accepts zero brittle slag in bridge iron!',
        ],
      ],
    },
    {
      id: 'npc_boiler_engineer',
      role: 'Engineer',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [-114.0, 0.16, -5.5],
      facingYaw: Math.PI,
      tunicColor: 0x2b3640,
      accentColor: 0x6ecad9,
      dialogueLines: [
        'Heavy Boiler Works feeds both the western viaduct pumps and the Assay Guildhouse down across Refinery Ave.',
        'Those twin silos beside us hold enough condensed mana to run the district for a fortnight.',
      ],
    },
    {
      id: 'npc_assay_hauler',
      role: 'Dock Porter',
      behavior: 'patrol',
      actionKind: 'haul',
      position: [-105.0, 0.16, 19.5],
      facingYaw: Math.PI / 2,
      tunicColor: 0x5e4938,
      accentColor: 0xd6963a,
      moveSpeed: 1.5,
      waypoints: [
        [-105.0, 0.16, 19.5],
        [-62.0, 0.16, 19.5],
        [-62.0, 0.16, 23.0],
        [-105.0, 0.16, 23.0],
      ],
      dialogueLines: [
        'Moving assayed brass bars from the West Forge out to the Assay Guildhouse!',
        'Refinery Avenue stretches twice as far west now that the Boiler Works opened.',
      ],
    },
    {
      id: 'npc_yard_sweeper',
      role: 'Resident',
      behavior: 'work',
      actionKind: 'sweep',
      position: [-29.5, 0.16, 4.0],
      facingYaw: Math.PI / 2,
      tunicColor: 0x4f463e,
      accentColor: 0x7a6c5d,
      dialogueLines: [
        'Keeping the Worker Courtyard cobbles neat around the water pump.',
        'Folks hang flower boxes out on every sill once spring winds warm the bay.',
      ],
    },
    {
      id: 'npc_apothecary_herbalist',
      role: 'Merchant',
      behavior: 'idle',
      actionKind: 'browse',
      position: [25.5, 0.16, -4.5],
      facingYaw: 0,
      tunicColor: 0x3b6351,
      accentColor: 0xd6963a,
      dialogueLines: [
        'Tinctures, willow-bark salves, and sea-salt poultices—fresh from the Conservatory gardens!',
        'Step into Copperwell Square whenever you need rest beside the fountain.',
      ],
    },
    {
      id: 'npc_market_clothier',
      role: 'Merchant',
      behavior: 'work',
      actionKind: 'announce',
      position: [-10.5, 0.16, 66.5],
      facingYaw: Math.PI / 2,
      tunicColor: 0x7a3946,
      accentColor: 0xd6963a,
      dialogueLines: [
        'Dyed wool, sea-cloak canvas, and brass-buckled belts—fresh off the Weaver Guild looms!',
        'Ten stalls open across Artisan Market Plaza today—crimson, emerald, and sea-blue canopies all stocked!',
      ],
      randomDialogues: [
        [
          'Gold-threaded trim straight from South Bazaar Boulevard—come have a look!',
        ],
      ],
    },
    {
      id: 'npc_market_grocer',
      role: 'Merchant',
      behavior: 'work',
      actionKind: 'announce',
      position: [10.5, 0.16, 59.5],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x3b6944,
      accentColor: 0xf2b738,
      dialogueLines: [
        'Orchard apples and kiln-baked loaves straight from the inland rail sidings!',
        'Leave room on the main cobbles when the freight carters bring in fresh spice barrels.',
      ],
    },
    {
      id: 'npc_market_browser',
      role: 'Resident',
      behavior: 'patrol',
      actionKind: 'browse',
      position: [-3.5, 0.16, 56.0],
      facingYaw: 0,
      tunicColor: 0x4b4b63,
      accentColor: 0xc9a36a,
      moveSpeed: 1.35,
      waypoints: [
        [-3.5, 0.16, 56.0],
        [-3.5, 0.16, 76.0],
        [3.5, 0.16, 76.0],
        [3.5, 0.16, 56.0],
      ],
      dialogueLines: [
        'Every trade guild in Elarion keeps a stall south of the City Gate—and the South Arcade now opens right onto South Bazaar Boulevard!',
        'Walk south past the obelisk to visit the Weaver Guildhall and Vintner Cellars.',
      ],
    },
    {
      id: 'npc_market_potter',
      role: 'Merchant',
      behavior: 'patrol',
      actionKind: 'browse',
      position: [22.0, 0.16, 63.0],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x8f4e3b,
      accentColor: 0xe6c88a,
      moveSpeed: 1.2,
      waypoints: [
        [22.0, 0.16, 63.0],
        [22.0, 0.16, 72.5],
        [24.5, 0.16, 72.5],
        [24.5, 0.16, 63.0],
      ],
      dialogueLines: [
        'Glazed amphorae, copper-rimmed urns, and painted flower planters for courtyard gardens!',
        'Check our dyed cloth and pottery display table beside the outer arcade.',
      ],
    },
    {
      id: 'npc_weaver_artisan',
      role: 'Merchant',
      behavior: 'interact',
      actionKind: 'converse',
      position: [-18.5, 0.16, 98.0],
      facingYaw: Math.PI / 2,
      tunicColor: 0x2c8c99,
      accentColor: 0xd6963a,
      dialogueLines: [
        'Welcome to South Bazaar Boulevard and the Weaver’s Guildhall!',
        'Our looms dye every bolt in harbour teal, crimson ochre, and sea-violet before shipping across Aincendra.',
      ],
      randomDialogues: [
        [
          'Even the festive bunting draped across Harbourgate Lane came off our guild looms this morning.',
        ],
      ],
    },
    {
      id: 'npc_vintner_steward',
      role: 'Merchant',
      behavior: 'work',
      actionKind: 'haul',
      position: [18.5, 0.16, 102.0],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x6e2d39,
      accentColor: 0xd6963a,
      dialogueLines: [
        'Vintner’s Guildhall stores oak-aged suncoast casks bound for both Salt & Brass Tavern and Noble Heights banquets!',
        'Try our spiced cider reserve whenever the autumn trade fleets drop anchor.',
      ],
    },
    {
      id: 'npc_boulevard_crier',
      role: 'Resident',
      behavior: 'work',
      actionKind: 'announce',
      position: [7.2, 0.16, 94.0],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x355c7d,
      accentColor: 0xf2b738,
      dialogueLines: [
        'Hear ye! All gates of South Bazaar Boulevard stand open—Weaver’s silks west, Vintner’s casks east!',
        'Festival lanterns stay lit all night from the Harbour Quay to the Terminus Gate!',
      ],
    },
    {
      id: 'npc_boulevard_guard',
      role: 'City Guard',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [-7.0, 0.16, 86.0],
      facingYaw: 0,
      tunicColor: 0x26313d,
      accentColor: 0xb67a4e,
      moveSpeed: 1.6,
      waypoints: [
        [-7.0, 0.16, 86.0],
        [-7.0, 0.16, 113.0],
        [7.0, 0.16, 113.0],
        [7.0, 0.16, 86.0],
      ],
      dialogueLines: [
        'South Terminus Gate secures the inland caravan road into Elarion.',
        'Between Artisan Market Plaza and South Bazaar Boulevard, trade volume hits record highs every week.',
      ],
    },
    {
      id: 'npc_academic_scholar',
      role: 'Scholar',
      behavior: 'work',
      actionKind: 'clipboard',
      position: [59.5, 1.76, 23.0],
      facingYaw: Math.PI / 2,
      tunicColor: 0x3a4759,
      accentColor: 0xc9a36a,
      dialogueLines: [
        'This brass astrolabe calibrates Elarion’s harbour beacons against high-altitude mana currents.',
        'North stands our new Aetheric Conservatory; south stand the Observatory Tower, Grand Archive, and Cartography Hall.',
      ],
    },
    {
      id: 'npc_archive_researcher',
      role: 'Scholar',
      behavior: 'patrol',
      actionKind: 'patrol',
      position: [53.0, 1.76, 13.5],
      facingYaw: 0,
      tunicColor: 0x2f4352,
      accentColor: 0x9fbcd1,
      moveSpeed: 1.35,
      waypoints: [
        [53.0, 1.76, 13.5],
        [68.5, 1.76, 13.5],
        [68.5, 1.76, 35.0],
        [53.0, 1.76, 35.0],
      ],
      dialogueLines: [
        'The Archive Hall preserves centuries of House Vaelcrest maritime charters and mana-refining treatises.',
        'Down at the South Cartography Hall, scholars chart every sea route beyond the breakwaters.',
      ],
    },
    {
      id: 'npc_conservatory_botanist',
      role: 'Scholar',
      behavior: 'patrol',
      actionKind: 'browse',
      position: [60.0, 1.76, 2.5],
      facingYaw: Math.PI / 2,
      tunicColor: 0x34614b,
      accentColor: 0x6ecad9,
      moveSpeed: 1.25,
      waypoints: [
        [60.0, 1.76, 2.5],
        [76.0, 1.76, 2.5],
        [76.0, 1.76, 0.2],
        [60.0, 1.76, 0.2],
      ],
      dialogueLines: [
        'Our glass-domed Aetheric Conservatory cultivates medicinal coastal flora under warmed external-mana skylights.',
        'We supply the Apothecary down in Copperwell Square with fresh balm and dye blossoms.',
      ],
    },
    {
      id: 'npc_noble_sentinel',
      role: 'City Guard',
      behavior: 'idle',
      actionKind: 'watch',
      position: [89.0, 5.2, 18.5],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x1d2836,
      accentColor: 0xd4a45e,
      dialogueLines: [
        'You stand on Noble Heights Civic Plaza—crowned by House Vaelcrest Council Hall, the Manor Wing, and Chancery Rotunda.',
        'Look west from the balustrade—every district of Elarion unfolds from the Council columns down to the sea.',
      ],
    },
    {
      id: 'npc_vaelcrest_chancellor',
      role: 'Scholar',
      behavior: 'interact',
      actionKind: 'converse',
      position: [96.5, 5.2, 24.5],
      facingYaw: -Math.PI / 2,
      tunicColor: 0x4c2e3c,
      accentColor: 0xd4a45e,
      dialogueLines: [
        'Welcome to House Vaelcrest Civic Plaza. The Chancery Rotunda south of us ratifies all trade charters for Elarion.',
        'Between our three harbour piers, western foundries, southern bazaars, and eastern scholars, the city thrives.',
      ],
      randomDialogues: [
        [
          'From this 5.2-metre terrace, watch how the viaduct freight feeds the entire bayfront economy.',
        ],
      ],
    },
  ];

  // =========================================================================
  // 9. EXPANDED WORLD INTERACTABLES (24 Environmental Storytelling Objects)
  // =========================================================================
  const interactables: InteractableSpec[] = [
    {
      id: 'int_notice_board',
      title: 'Harbourgate Notice Board',
      subtitle: 'Public Bulletins · Harbourgate Lane',
      category: 'Notice',
      promptAction: 'Read',
      position: [9.05, 0.16, 1.6],
      radius: 2.6,
      lines: [
        'SHIPPING LEDGER: Three merchant hulls berthed across West, Central Shipyard, and East Piers; outbound tide opens at dusk.',
        'FOUNDRY NOTICE: West Forge & Assay Office now open on Refinery Avenue for ingot stamping and furnace tours.',
        'BAZAAR BULLETIN: Southgate Arcade now opens straight onto South Bazaar Boulevard—visit the Weaver and Vintner Guildhalls.',
      ],
    },
    {
      id: 'int_conduit_manifold',
      title: 'Mana Conduit Manifold',
      subtitle: 'Aetheric Conduit & Horology Workshop',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-9.2, 0.16, -4.2],
      radius: 2.5,
      lines: [
        'Heavy iron housing fitted with braided copper feed-pipes and a glowing cyan pressure sight-glass.',
        'Regulates external mana drawn from the West Industrial Quarter to power Harbourgate street lamps and precision workshop lathes.',
      ],
    },
    {
      id: 'int_chandlery_ledger',
      title: 'Chandlery Customs Counter',
      subtitle: 'Vaelcrest Customs & Chandlery',
      category: 'Commerce',
      promptAction: 'Inspect',
      position: [-13.8, 0.18, 7.6],
      radius: 2.6,
      lines: [
        'Stamped brass seals, coil-rope manifests, and copper-lined ledgers line the timber counter.',
        'Merchants register hull drafts and bonded warehouse space here before ascending toward Copperwell Square.',
      ],
    },
    {
      id: 'int_tavern_bar',
      title: 'The Salt & Brass Taproom',
      subtitle: 'Sailors Taproom · Harbourgate Lane',
      category: 'Commerce',
      promptAction: 'Inspect',
      position: [13.8, 0.18, -3.0],
      radius: 2.7,
      lines: [
        'Warm hearth smoke and polished copper taps welcome dockworkers, carters, and merchant crews off the quays.',
        'Chalked above the bar: "House Vaelcrest Harbor Toll Paid — No Live Mana Coils Beside the Hearth."',
      ],
    },
    {
      id: 'int_copperwell_fountain',
      title: 'Copperwell Cistern Fountain',
      subtitle: 'Copperwell Public Square',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [25.5, 0.16, 3.0],
      radius: 3.4,
      lines: [
        'An octagonal sandstone basin crowned with a copper bowl and a suspended cyan mana-regulator crystal.',
        'External mana keeps groundwater circulating cleanly for the surrounding apothecary, bookbinder, and townhouse blocks.',
      ],
    },
    {
      id: 'int_courtyard_pump',
      title: 'Courtyard Iron Water Pump',
      subtitle: 'Worker Tenement Courtyard',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-26.0, 0.16, 1.0],
      radius: 2.6,
      lines: [
        'A well-worn cast-iron hand pump set into a sunken sandstone trough, serving dozens of tenement households.',
        'Rust stains and stacked cargo barrels mark the daily rhythm of the working-class quarter behind Harbourgate Lane.',
      ],
    },
    {
      id: 'int_harbour_manifest',
      title: 'Quay Customs Manifest Desk',
      subtitle: 'Grand Harbour Quay Booth',
      category: 'Commerce',
      promptAction: 'Read',
      position: [13.4, -0.3, -39.0],
      radius: 2.7,
      lines: [
        'QUAY BERTH LOG: West Pier unloading oak timber; Central Shipyard Pier fitting brigantine rudders; East Pier loading mana canisters.',
        'VIADUCT FREIGHT: Elevated mana locomotive runs continuously between Mariners Guildhall and Heavy Boiler Works.',
      ],
    },
    {
      id: 'int_viaduct_pillar',
      title: 'Mana-Railway Viaduct Arch',
      subtitle: 'Grand Harbour Infrastructure',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-5.0, -0.3, -32.4],
      radius: 3.2,
      lines: [
        'Massive dressed-stone piers support the 5.8-metre rail deck carrying external-mana freight trains above the harbourfront.',
        'A copper central conductor rail runs between the iron tracks, feeding traction power directly to passing locomotives.',
      ],
    },
    {
      id: 'int_west_pier_mooring',
      title: 'West Pier Merchantman Berth',
      subtitle: 'West Cargo Pier · Grand Harbour',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [-33.6, -0.3, -76.0],
      radius: 3.2,
      lines: [
        'Deep-draft timber merchantman moored fast to iron bollards, fitted with a glowing cyan stern mana-propulsion fin.',
        'Crane crews swing copper-banded cargo crates directly between the pier apron and the ship hold.',
      ],
    },
    {
      id: 'int_central_anchor_monument',
      title: 'Flagship Anchor Monument',
      subtitle: 'Central Shipyard Pier · Grand Harbour',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [0, -0.3, -82.5],
      radius: 3.2,
      lines: [
        'A two-ton wrought-iron bower anchor with copper cross-stock mounted beside coils of tarred hemp cable.',
        'Commemorates House Vaelcrest’s opening of the Central Shipyard Pier and expanded Elarion drydocks.',
      ],
    },
    {
      id: 'int_east_pier_beacon',
      title: 'East Pier Harbour Beacon',
      subtitle: 'East Cargo Pier · Grand Harbour',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [22.0, -0.3, -87.5],
      radius: 3.4,
      lines: [
        'Sandstone signal tower housing a high-output cyan mana lantern that guides vessels past Elarion’s outer breakwaters.',
        'From the pier head, incoming tall-masted cargo ships tack steadily across the bay.',
      ],
    },
    {
      id: 'int_substation_gauge',
      title: 'Industrial Mana Substation',
      subtitle: 'West Industrial Quarter',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-47.5, 0.16, 5.5],
      radius: 2.8,
      questInspectTrigger: {
        questId: 'q_gate_conduit',
        stageIndex: 0,
        increment: 2,
      },
      lines: [
        'Three cyan sight-gauges hum steadily beneath heavy overhead copper mains linking directly to the storage silos.',
        'You calibrate the bypass valve and record the pressure reading — ready to synthesize a Stabilized Crystal Core ([B]).',
      ],
    },
    {
      id: 'int_industrial_silos',
      title: 'External Mana Storage Silos',
      subtitle: 'West Refinery Yard',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-44.2, 0.16, -15.5],
      radius: 3.6,
      lines: [
        'Four riveted iron pressure cylinders banded with copper ribs hold refined liquid-state external mana.',
        'Pressurized overhead mains feed both Heavy Boiler Works to the west and the Grand Harbour cranes north.',
      ],
    },
    {
      id: 'int_smeltery_crucible',
      title: 'Mana-Heated Crucible Furnace',
      subtitle: 'Smelting Hall · Industrial Quarter',
      category: 'Infrastructure',
      promptAction: 'Inspect',
      position: [-75.0, 0.18, 0.5],
      radius: 3.2,
      lines: [
        'Radiant heat pours from an arched brick furnace stoked by focused external-mana coils rather than coal.',
        'Refined bronze and Vaelcrest iron ingots cast here forge viaduct rails, crane sheaves, and astrolabe rings.',
      ],
    },
    {
      id: 'int_west_forge_assay',
      title: 'West Forge & Assay Bench',
      subtitle: 'Accessible Assay Office · Refinery Ave',
      category: 'Commerce',
      promptAction: 'Inspect',
      position: [-57.8, 0.18, 30.5],
      radius: 3.0,
      lines: [
        'Precision copper balance pans, hallmark punches, and warm hearth tongs sit ready for grading smelted ingots.',
        'Only bars carrying the Vaelcrest purity stamp qualify for high-pressure viaduct and mana-silo castings.',
      ],
    },
    {
      id: 'int_south_market_obelisk',
      title: 'Southgate Market Obelisk',
      subtitle: 'Artisan Market Plaza',
      category: 'Landmark',
      promptAction: 'Read',
      position: [0, 0.16, 66.0],
      radius: 3.2,
      lines: [
        'Carved sandstone market standard marking the heart of Elarion’s ten-stall open-air bazaar.',
        'Pass south through the arched gallery below to enter the Weaver and Vintner halls on South Bazaar Boulevard.',
      ],
    },
    {
      id: 'int_weaver_guildhall',
      title: 'Weaver’s Guild Silk Display',
      subtitle: 'South Bazaar Boulevard · West',
      category: 'Commerce',
      promptAction: 'Inspect',
      position: [-17.2, 0.16, 102.5],
      radius: 3.0,
      lines: [
        'Bolts of teal, crimson, and saffron cloth sit beside hammered copper dye-urns outside the Weaver’s Guildhall.',
        'Sea-windproof wool woven here outfits both Vaelcrest sailors and Noble Heights diplomats.',
      ],
    },
    {
      id: 'int_vintner_guildhall',
      title: 'Vintner’s Guild Reserve Casks',
      subtitle: 'South Bazaar Boulevard · East',
      category: 'Commerce',
      promptAction: 'Inspect',
      position: [17.5, 0.16, 101.0],
      radius: 3.0,
      lines: [
        'Iron-hooped oak casks branded with the Suncoast grape seal await cartage up Harbourgate Lane.',
        'Thick brick cellar walls keep vintages cool even beneath midday sun.',
      ],
    },
    {
      id: 'int_academic_conservatory',
      title: 'Aetheric Botany Conservatory',
      subtitle: 'Academic Courtyard · North Wing',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [67.0, 1.76, 1.5],
      radius: 3.2,
      lines: [
        'A copper-ribbed glass atrium crowning limestone halls where coastal herbs and dye-blossoms grow year-round.',
        'Gentle external-mana lamps warm the upper glass dome through harbour fog.',
      ],
    },
    {
      id: 'int_academic_astrolabe',
      title: 'Aetheric Brass Astrolabe',
      subtitle: 'Academic Quarter Courtyard',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [62.5, 1.76, 23.0],
      radius: 3.5,
      lines: [
        'Three concentric copper-and-iron armillary rings orbit a suspended cyan mana crystal above an octagonal limestone plinth.',
        'Scholars use it to align harbour navigation beacons and measure regional aetheric tide shifts.',
      ],
    },
    {
      id: 'int_observatory_tower',
      title: 'Academic Observatory & Archive',
      subtitle: 'Academic Quarter Courtyard',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [62.0, 1.76, 36.6],
      radius: 3.2,
      lines: [
        'A copper-domed limestone tower crowned with an iron celestial spyglass overlooking Elarion Bay.',
        'Beside it stand the Grand Archive Hall and South Cartography Hall housing regional sea charts.',
      ],
    },
    {
      id: 'int_cartography_hall',
      title: 'South Cartography Hall',
      subtitle: 'Academic Courtyard · South Wing',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [67.0, 1.76, 68.5],
      radius: 3.2,
      lines: [
        'Windowed limestone drafting hall where guild cartographers survey soundings, breakwater depths, and rail spurs.',
      ],
    },
    {
      id: 'int_vaelcrest_council_crest',
      title: 'House Vaelcrest Council Crest',
      subtitle: 'Noble Heights Upper Plaza',
      category: 'Landmark',
      promptAction: 'Read',
      position: [100.8, 5.2, 18.5],
      radius: 3.0,
      lines: [
        'An engraved limestone stele inlaid with the copper crest of House Vaelcrest before the colonnade of the Council Dome Hall.',
        'Flanked north by Lord Vaelcrest’s Manor Wing and south by the Chancery & Diplomatic Rotunda.',
      ],
    },
    {
      id: 'int_noble_overlook_balustrade',
      title: 'Noble Heights City Overlook',
      subtitle: 'Noble Heights Terrace · 5.2m Elevation',
      category: 'Landmark',
      promptAction: 'Inspect',
      position: [83.2, 5.2, 28.0],
      radius: 2.8,
      lines: [
        'From the elevated limestone balustrade, all five districts of Elarion spread out in clear relief:',
        'Three Harbour piers and viaduct north, Boiler Works & West Forge west, Market & Bazaar Boulevard south, Academic towers below.',
      ],
    },
  ];

  // =========================================================================
  // 10. PICKABLE PROPS ACROSS ALL 5 DISTRICTS (10 Collectible Field Items)
  // =========================================================================
  const pickableSpecs: PickablePropSpec[] = [
    {
      id: 'pick_harbourgate_mana_shard',
      title: 'Aetheric Mana Shard',
      subtitle: 'Harbourgate Lane · Unrefined Conduit Crystal',
      propKind: 'mana-crystal',
      position: [5.2, 0.16, 23.5],
      lines: [
        'A palm-sized cyan conduit crystal dropped beside the Harbourgate lantern curb, humming with external mana.',
      ],
    },
    {
      id: 'pick_chandlery_cargo_seal',
      title: 'Vaelcrest Customs Seal',
      subtitle: 'Vaelcrest Chandlery · Bonded Brass Coffer',
      propKind: 'cargo-seal',
      position: [-8.2, 0.16, 6.2],
      lines: [
        'An official wax-stamped customs coffer clearing dry-dock timber for the Central Shipyard Pier.',
      ],
    },
    {
      id: 'pick_copperwell_herb_satchel',
      title: 'Apothecary Herb Satchel',
      subtitle: 'Copperwell Square · Clinic Field Kit',
      propKind: 'herb-satchel',
      position: [22.4, 0.16, 4.6],
      lines: [
        'A woven satchel packed with dried coastal sea-fennel and a stoppered tonic phial.',
      ],
    },
    {
      id: 'pick_quay_dispatch_scroll',
      title: 'Harbourmaster Dispatch',
      subtitle: 'Grand Harbour Quay · Sealed Pier Orders',
      propKind: 'dispatch-scroll',
      position: [-4.2, -0.3, -44.0],
      lines: [
        'Rolled parchment bearing tide-gate timings for the West and East Cargo Piers.',
      ],
    },
    {
      id: 'pick_shipyard_astrolabe',
      title: 'Shipwright Brass Astrolabe',
      subtitle: 'Central Shipyard Pier · Navigation Instrument',
      propKind: 'brass-astrolabe',
      position: [3.4, -0.3, -72.0],
      lines: [
        'A calibrated twin-ring brass astrolabe used to align brigantine compass binnacles.',
      ],
    },
    {
      id: 'pick_refinery_copper_ingot',
      title: 'Assayed Copper Ingot Stack',
      subtitle: 'Refinery Avenue · Foundry Lot #14',
      propKind: 'copper-ingot',
      position: [-48.5, 0.16, 23.0],
      lines: [
        'Three freshly cast copper-bronze ingots stamped for the elevated viaduct conductor rail.',
      ],
    },
    {
      id: 'pick_smeltery_mana_core',
      title: 'Refined Crucible Mana Core',
      subtitle: 'Smelting Hall · West Industrial Quarter',
      propKind: 'mana-crystal',
      position: [-71.0, 0.18, 5.5],
      lines: [
        'A high-output aetheric core stabilized in a cast-iron collar for furnace ignition.',
      ],
    },
    {
      id: 'pick_market_guild_seal',
      title: 'Bazaar Guild Charter Box',
      subtitle: 'Artisan Market Plaza · Southgate',
      propKind: 'cargo-seal',
      position: [6.8, 0.16, 63.0],
      lines: [
        'Stallholder dues chest sealed in crimson wax for the Weaver and Vintner guilds.',
      ],
    },
    {
      id: 'pick_academic_armillary',
      title: 'Calibration Armillary Ring',
      subtitle: 'Academic Courtyard · Observatory Terrace',
      propKind: 'brass-astrolabe',
      position: [57.5, 1.76, 18.5],
      lines: [
        'Precision scholarly armillary instrument tuned to Elarion’s harbour beacons.',
      ],
    },
    {
      id: 'pick_noble_chancery_scroll',
      title: 'Chancery Diplomatic Folio',
      subtitle: 'Noble Heights Plaza · Upper Terrace',
      propKind: 'dispatch-scroll',
      position: [92.0, 5.2, 19.5],
      lines: [
        'Gilded diplomatic dispatches bound for House Vaelcrest’s Council Dome Hall.',
      ],
    },
  ];

  // =========================================================================
  // 11. METROPOLIS OUTER WARDS EXPANSION (600m x 430m Continuous City)
  // =========================================================================
  const expansion = buildElarionMetropolisExpansion(
    boxColliders,
    rampColliders,
    raycastTargets,
    disposables,
    {
      road: matRoad,
      crossRoad: matCrossRoad,
      pavement: matPavement,
      plaza: matPlaza,
      marbleInlay: matMarbleInlay,
      sandstone: matSandstone,
      limestone: matLimestone,
      brick: matBrick,
      darkBrick: matDarkBrick,
      timber: matTimber,
      darkTimber: matDarkTimber,
      plaster: matPlaster,
      warmPlaster: matWarmPlaster,
      terracottaPlaster: matTerracottaPlaster,
      sagePlaster: matSagePlaster,
      ochrePlaster: matOchrePlaster,
      slateRoof: matSlateRoof,
      iron: matIron,
      copper: matCopper,
      glass: matGlass,
      manaLamp: matManaLamp,
      warmLantern: matWarmLantern,
      furnaceGlow: matFurnaceGlow,
      water: matWater,
      foliage: matFoliage,
      foliageLight: matFoliageLight,
      awningRed: matAwning,
      awningGreen: matAwningGreen,
      awningBlue: matAwningBlue,
    }
  );
  group.add(expansion.group);
  npcSpawns.push(...expansion.npcSpawns);
  interactables.push(...expansion.interactables);

  const countryside = buildVaelcrestCountryside(maxAnisotropy);
  group.add(countryside.group);
  boxColliders.push(...countryside.boxColliders);

  // =========================================================================
  // 12. MANA-RAIL STATION TICKET KIOSKS (6 Interactive District Terminals)
  // =========================================================================
  {
    const kioskBaseGeo = new THREE.BoxGeometry(1.1, 0.36, 0.9);
    const kioskBodyGeo = new THREE.BoxGeometry(0.84, 1.55, 0.56);
    const kioskScreenGeo = new THREE.BoxGeometry(0.68, 0.58, 0.08);
    const kioskCanopyGeo = new THREE.BoxGeometry(1.42, 0.16, 1.15);
    const kioskTrimGeo = new THREE.BoxGeometry(0.92, 0.14, 0.64);
    disposables.push(kioskBaseGeo, kioskBodyGeo, kioskScreenGeo, kioskCanopyGeo, kioskTrimGeo);

    for (const st of RAIL_STATIONS) {
      const [kx, ky, kz] = st.kioskPos;
      const kiosk = new THREE.Group();
      kiosk.name = `ManaRailKiosk_${st.id}`;
      kiosk.position.set(kx, ky, kz);
      kiosk.rotation.y = st.kioskYaw;

      const base = new THREE.Mesh(kioskBaseGeo, matSandstone);
      base.position.y = 0.18;
      const body = new THREE.Mesh(kioskBodyGeo, matIron);
      body.position.y = 1.13;
      const screen = new THREE.Mesh(kioskScreenGeo, matManaLamp);
      screen.position.set(0, 1.38, 0.27);
      const trim = new THREE.Mesh(kioskTrimGeo, matCopper);
      trim.position.y = 1.96;
      const canopy = new THREE.Mesh(kioskCanopyGeo, matSlateRoof);
      canopy.position.y = 2.18;

      kiosk.add(base, body, screen, trim, canopy);
      group.add(kiosk);
      raycastTargets.push(body, canopy);
      boxColliders.push({
        minX: kx - 0.58,
        maxX: kx + 0.58,
        minY: ky,
        maxY: ky + 2.35,
        minZ: kz - 0.58,
        maxZ: kz + 0.58,
      });

      interactables.push({
        id: `rail_kiosk_${st.id}`,
        title: st.name,
        subtitle: `${st.lineLabel} · Ticket Terminal`,
        category: 'Infrastructure',
        promptAction: 'Mana-Rail',
        position: [kx, ky, kz],
        radius: 3.1,
        labelHeight: 2.55,
        opensRailStationId: st.id,
        lines: [st.summary],
      });
    }
  }

  const allPickables: PickablePropSpec[] = [...pickableSpecs, ...expansion.pickableSpecs];
  const pickables = new PickablePropSystem(allPickables);
  group.add(pickables.group);
  interactables.push(...pickables.toInteractables());

  const stationsAndLoot = buildWorldStationsAndLoot(modelCache, getCountrysideGroundY);
  group.add(stationsAndLoot.group);
  boxColliders.push(...stationsAndLoot.boxColliders);
  for (const item of stationsAndLoot.interactables) {
    const stationKind = stationsAndLoot.isCraftingTrigger(item.id);
    if (stationKind) {
      interactables.push({ ...item, opensCraftingStation: stationKind });
    } else {
      interactables.push(item);
    }
  }

  const combatDummies: CombatDummySpec[] = [
    {
      id: 'el_dummy_harbourgate',
      name: 'Watch Post Training Dummy',
      position: [-6.8, 0.16, 26.0],
      facingYaw: 0.72,
      maxHp: 150,
    },
    {
      id: 'el_dummy_courtyard',
      name: 'Courtyard Sparring Dummy',
      position: [-22.5, 0.16, 3.8],
      facingYaw: 1.2,
      maxHp: 150,
    },
    {
      id: 'el_dummy_copperwell',
      name: 'Vaelcrest Guard Dummy',
      position: [20.8, 0.16, -2.5],
      facingYaw: -0.9,
      maxHp: 220,
      armored: true,
    },
    ...expansion.combatDummies,
  ];

  return {
    group,
    boxColliders,
    rampColliders,
    raycastTargets,
    spawnPoint: new THREE.Vector3(0, 0, 29),
    worldBoundsRadius: 720.0,
    worldBounds: { minX: -460.0, maxX: 460.0, minZ: -94.8, maxZ: 675.0 },
    defaultGroundY: -1.8,
    groundHeightAt: getCountrysideGroundY,
    npcSpawns,
    interactables,
    combatDummies,
    wildlifeCount: countryside.wildlifeCount,
    unlockGate: expansion.unlockGate,
    isGateOpen: expansion.isGateOpen,
    collectProp: (id: string) => pickables.collect(id),
    collectLoot: (id: string) => stationsAndLoot.collectLoot(id),
    getNearestStation: stationsAndLoot.getNearestStation,
    isCraftingTrigger: stationsAndLoot.isCraftingTrigger,
    update: (dt: number, playerPosition?: THREE.Vector3) => {
      waterBump.offset.x = (waterBump.offset.x + dt * 0.018) % 1;
      waterBump.offset.y = (waterBump.offset.y + dt * 0.011) % 1;
      vista.update(dt);
      expansion.update(dt);
      countryside.update(dt, playerPosition);
      pickables.update(dt);
      stationsAndLoot.update(dt);
    },
    dispose: () => {
      vista.dispose();
      countryside.dispose();
      pickables.dispose();
      stationsAndLoot.dispose();
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
