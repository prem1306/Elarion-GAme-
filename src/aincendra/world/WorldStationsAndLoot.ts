import * as THREE from 'three';
import type { BoxCollider, InteractableSpec } from '../core/types';
import type { CraftingStationKind } from '../rpg/rpgTypes';
import { ModelAssetCache, type LocalModelKey } from './ModelAssetCache';

export interface StationPlacement {
  id: string;
  station: CraftingStationKind;
  title: string;
  modelKey: LocalModelKey;
  targetHeight: number;
  position: [number, number, number];
  yaw: number;
}

export interface LootPropSpec {
  id: string;
  title: string;
  kind: 'chest' | 'mana_node' | 'ore_vein' | 'herb_patch';
  position: [number, number, number];
  lootItems: Array<{ itemId: string; qty: number }>;
  crowns: number;
}

export interface WorldStationsAndLootSystem {
  group: THREE.Group;
  interactables: InteractableSpec[];
  boxColliders: BoxCollider[];
  getNearestStation: (pos: THREE.Vector3) => CraftingStationKind;
  isCraftingTrigger: (id: string) => CraftingStationKind | null;
  collectLoot: (id: string) => LootPropSpec | null;
  update: (dt: number) => void;
  dispose: () => void;
}

function buildFallbackStationMesh(
  modelKey: LocalModelKey,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x52565e, roughness: 0.78, metalness: 0.15 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x61412b, roughness: 0.82, metalness: 0.05 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x7de2f0,
    emissive: 0x2299b3,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    emissive: 0xea580c,
    emissiveIntensity: 1.15,
    roughness: 0.3,
  });
  disposables.push(stoneMat, woodMat, glowMat, emberMat);

  if (modelKey === 'blacksmith_forge' || modelKey === 'anvil') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), stoneMat);
    base.position.y = 0.35;
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.7), emberMat);
    hearth.position.y = 0.82;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 4), stoneMat);
    hood.rotation.y = Math.PI / 4;
    hood.position.y = 1.65;
    disposables.push(base.geometry, hearth.geometry, hood.geometry);
    g.add(base, hearth, hood);
  } else if (modelKey === 'alchemy_bench') {
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.8), woodMat);
    table.position.y = 0.42;
    const flaskA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.32, 8), glowMat);
    flaskA.position.set(-0.32, 1.01, 0);
    const flaskB = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), emberMat);
    flaskB.position.set(0.28, 0.98, 0.1);
    disposables.push(table.geometry, flaskA.geometry, flaskB.geometry);
    g.add(table, flaskA, flaskB);
  } else if (modelKey === 'ancestral_shrine' || modelKey === 'ley_portal') {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.65, 8), stoneMat);
    plinth.position.y = 0.32;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.16, 8, 20), glowMat);
    arch.position.y = 1.65;
    disposables.push(plinth.geometry, arch.geometry);
    g.add(plinth, arch);
  } else {
    const chestBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.56, 0.62), woodMat);
    chestBody.position.y = 0.28;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.12, 0.66), glowMat);
    trim.position.y = 0.44;
    disposables.push(chestBody.geometry, trim.geometry);
    g.add(chestBody, trim);
  }
  return g;
}

export function buildWorldStationsAndLoot(
  modelCache: ModelAssetCache,
  groundHeightAt?: (x: number, z: number) => number
): WorldStationsAndLootSystem {
  const group = new THREE.Group();
  group.name = 'Aincendra_World_Stations_And_Loot';
  const interactables: InteractableSpec[] = [];
  const boxColliders: BoxCollider[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const gy = (x: number, z: number) => (groundHeightAt ? groundHeightAt(x, z) : 0.16);

  const stations: StationPlacement[] = [
    {
      id: 'station_alchemy_copperwell',
      station: 'alchemy',
      title: 'Copperwell Alchemist Bench',
      modelKey: 'alchemy_bench',
      targetHeight: 1.45,
      position: [19.5, 0.16, 7.5],
      yaw: -0.7,
    },
    {
      id: 'station_forge_smelting',
      station: 'forge',
      title: 'Smelting Hall Runesmith Forge',
      modelKey: 'blacksmith_forge',
      targetHeight: 2.65,
      position: [-72.0, 0.18, 4.0],
      yaw: 0.4,
    },
    {
      id: 'station_anvil_westforge',
      station: 'forge',
      title: 'West Forge Runesmith Anvil',
      modelKey: 'anvil',
      targetHeight: 1.05,
      position: [-52.0, 0.18, 30.0],
      yaw: 0.0,
    },
    {
      id: 'station_alchemy_conservatory',
      station: 'alchemy',
      title: 'Conservatory Aether Bench',
      modelKey: 'alchemy_bench',
      targetHeight: 1.45,
      position: [64.0, 1.76, 6.0],
      yaw: -1.2,
    },
    {
      id: 'station_shrine_temple',
      station: 'shrine',
      title: 'Temple Quarter Ley-Shrine',
      modelKey: 'ancestral_shrine',
      targetHeight: 2.85,
      position: [-192.0, 0.16, -12.0],
      yaw: 0.25,
    },
    {
      id: 'station_shrine_wilds',
      station: 'shrine',
      title: 'Emerald Glade Ley-Shrine',
      modelKey: 'ancestral_shrine',
      targetHeight: 2.85,
      position: [-76.0, gy(-76, 456), 456.0],
      yaw: 0.9,
    },
  ];

  const stationIdMap = new Map<string, CraftingStationKind>();
  for (const st of stations) {
    stationIdMap.set(st.id, st.station);
    const holder = new THREE.Group();
    holder.position.set(...st.position);
    holder.rotation.y = st.yaw;
    const fallback = buildFallbackStationMesh(st.modelKey, disposables);
    holder.add(fallback);
    group.add(holder);

    modelCache.mountIntoContainer(holder, st.modelKey, st.targetHeight, fallback);

    const [sx, sy, sz] = st.position;
    boxColliders.push({
      minX: sx - 0.85,
      maxX: sx + 0.85,
      minY: sy,
      maxY: sy + 2.0,
      minZ: sz - 0.85,
      maxZ: sz + 0.85,
    });

    interactables.push({
      id: st.id,
      title: st.title,
      subtitle:
        st.station === 'forge'
          ? 'Runesmith Forge · Weapons & Armor'
          : st.station === 'alchemy'
            ? 'Alchemy Bench · Tonics & Phials'
            : 'Ley-Shrine · Relics & Synthesis',
      category: 'Commerce',
      promptAction: 'Craft',
      position: st.position,
      radius: 3.4,
      labelHeight: 2.1,
      lines: [
        `Step close to the ${st.title} and press [B] to unlock ${st.station.toUpperCase()} crafting recipes.`,
      ],
    });
  }

  // Mythic Countryside Landmarks (Ancient Ley Portal & Spectral Stag)
  const portalPos: [number, number, number] = [0, gy(0, 542), 542];
  const portalGroup = new THREE.Group();
  portalGroup.position.set(...portalPos);
  const portalFallback = buildFallbackStationMesh('ley_portal', disposables);
  portalGroup.add(portalFallback);
  group.add(portalGroup);
  modelCache.mountIntoContainer(portalGroup, 'ley_portal', 5.8, portalFallback);
  interactables.push({
    id: 'landmark_ley_portal',
    title: 'Ancient Vaelcrest Ley-Portal',
    subtitle: 'Emerald Wilds · Epicenter',
    category: 'Landmark',
    promptAction: 'Inspect',
    position: portalPos,
    radius: 4.5,
    labelHeight: 4.2,
    lines: [
      'A towering runic arch humming with raw Aetheric current. Vanquish the Crystal Wyrm guarding this threshold to restore the Emerald Wilds.',
    ],
  });

  const stagPos: [number, number, number] = [-84, gy(-84, 464), 464];
  const stagGroup = new THREE.Group();
  stagGroup.position.set(...stagPos);
  stagGroup.rotation.y = 0.65;
  group.add(stagGroup);
  let stagMixer: THREE.AnimationMixer | null = null;
  modelCache.mountIntoContainer(stagGroup, 'spectral_stag', 2.4, undefined, (m, anims) => {
    if (anims.length > 0) {
      stagMixer = new THREE.AnimationMixer(m);
      stagMixer.clipAction(anims[0]).play();
    }
  });

  // Chests & Gatherable Resource Nodes across District & Countryside
  const lootDefs: LootPropSpec[] = [
    {
      id: 'loot_chest_harbour',
      title: 'Mariner Supply Chest',
      kind: 'chest',
      position: [-14.0, 0.16, 15.0],
      lootItems: [
        { itemId: 'copper_ingot', qty: 2 },
        { itemId: 'vitality_elixir', qty: 1 },
      ],
      crowns: 24,
    },
    {
      id: 'loot_mana_substation',
      title: 'Condenser Mana Cluster',
      kind: 'mana_node',
      position: [-41.0, 0.16, 7.5],
      lootItems: [{ itemId: 'mana_shard', qty: 2 }],
      crowns: 10,
    },
    {
      id: 'loot_ore_foundry',
      title: 'Refinery Iron & Copper Cache',
      kind: 'ore_vein',
      position: [-68.0, 0.16, 17.5],
      lootItems: [
        { itemId: 'iron_ore', qty: 2 },
        { itemId: 'copper_ingot', qty: 1 },
      ],
      crowns: 14,
    },
    {
      id: 'loot_herb_conservatory',
      title: 'Conservatory Botanical Planter',
      kind: 'herb_patch',
      position: [62.0, 1.76, -1.5],
      lootItems: [
        { itemId: 'aether_herb', qty: 2 },
        { itemId: 'mana_shard', qty: 1 },
      ],
      crowns: 12,
    },
    {
      id: 'loot_chest_exchange',
      title: 'Guild Reserve Strongbox',
      kind: 'chest',
      position: [26.0, 0.16, 212.0],
      lootItems: [
        { itemId: 'crystal_core', qty: 1 },
        { itemId: 'aether_draught', qty: 1 },
      ],
      crowns: 35,
    },
    {
      id: 'loot_mana_wilds_gate',
      title: 'Wilds Ley-Fissure Crystal',
      kind: 'mana_node',
      position: [16.0, gy(16, 362), 362.0],
      lootItems: [
        { itemId: 'mana_shard', qty: 2 },
        { itemId: 'aether_herb', qty: 1 },
      ],
      crowns: 16,
    },
    {
      id: 'loot_chest_wilds_glade',
      title: 'Runesmith Trail Chest',
      kind: 'chest',
      position: [-68.0, gy(-68, 452), 452.0],
      lootItems: [
        { itemId: 'iron_ore', qty: 3 },
        { itemId: 'crystal_core', qty: 1 },
      ],
      crowns: 45,
    },
  ];

  const lootMap = new Map<string, { spec: LootPropSpec; group: THREE.Group; collected: boolean }>();
  const manaNodeGeo = new THREE.OctahedronGeometry(0.42, 0);
  const manaNodeMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x0891b2,
    emissiveIntensity: 1.1,
    roughness: 0.18,
  });
  const oreGeo = new THREE.DodecahedronGeometry(0.45, 0);
  const oreMat = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.42, metalness: 0.72 });
  const herbGeo = new THREE.ConeGeometry(0.32, 0.55, 7);
  const herbMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x166534, emissiveIntensity: 0.5, roughness: 0.65 });
  disposables.push(manaNodeGeo, manaNodeMat, oreGeo, oreMat, herbGeo, herbMat);

  for (const spec of lootDefs) {
    const holder = new THREE.Group();
    holder.position.set(...spec.position);
    group.add(holder);

    if (spec.kind === 'chest') {
      const fb = buildFallbackStationMesh('treasure_chest', disposables);
      holder.add(fb);
      modelCache.mountIntoContainer(holder, 'treasure_chest', 0.85, fb);
    } else if (spec.kind === 'mana_node') {
      const m1 = new THREE.Mesh(manaNodeGeo, manaNodeMat);
      m1.position.y = 0.45;
      const m2 = new THREE.Mesh(manaNodeGeo, manaNodeMat);
      m2.scale.setScalar(0.62);
      m2.position.set(0.32, 0.28, 0.18);
      m2.rotation.z = -0.35;
      holder.add(m1, m2);
    } else if (spec.kind === 'ore_vein') {
      const o1 = new THREE.Mesh(oreGeo, oreMat);
      o1.position.y = 0.32;
      const o2 = new THREE.Mesh(oreGeo, oreMat);
      o2.scale.setScalar(0.68);
      o2.position.set(-0.34, 0.24, 0.2);
      holder.add(o1, o2);
    } else {
      for (let i = 0; i < 3; i++) {
        const h = new THREE.Mesh(herbGeo, herbMat);
        h.position.set((i - 1) * 0.22, 0.28, (i % 2) * 0.16);
        holder.add(h);
      }
    }

    lootMap.set(spec.id, { spec, group: holder, collected: false });
    interactables.push({
      id: spec.id,
      title: spec.title,
      subtitle: spec.kind === 'chest' ? 'Lootable Cache' : 'Gatherable Resource',
      category: 'Item',
      promptAction: spec.kind === 'chest' ? 'Open' : 'Harvest',
      position: spec.position,
      radius: 2.75,
      labelHeight: 1.25,
      pickable: true,
      lines: [spec.title],
    });
  }

  return {
    group,
    interactables,
    boxColliders,
    getNearestStation: (pos: THREE.Vector3): CraftingStationKind => {
      let best: CraftingStationKind = 'field';
      let bestDist = 4.6;
      for (const st of stations) {
        const d = Math.hypot(pos.x - st.position[0], pos.z - st.position[2]);
        if (d <= bestDist && Math.abs(pos.y - st.position[1]) < 2.5) {
          bestDist = d;
          best = st.station;
        }
      }
      return best;
    },
    isCraftingTrigger: (id: string) => stationIdMap.get(id) ?? null,
    collectLoot: (id: string) => {
      const entry = lootMap.get(id);
      if (!entry || entry.collected) return null;
      entry.collected = true;
      entry.group.visible = false;
      return entry.spec;
    },
    update: (dt: number) => {
      stagMixer?.update(Math.min(dt, 0.05));
    },
    dispose: () => {
      stagMixer?.stopAllAction();
      for (const d of disposables) d.dispose();
    },
  };
}
