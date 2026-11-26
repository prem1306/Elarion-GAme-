import type {
  CraftingRecipe,
  CraftingStationKind,
  InventoryEntry,
  ItemDef,
  RpgPlayerState,
} from './rpgTypes';

export const ITEMS: Record<string, ItemDef> = {
  // Materials
  mana_shard: {
    id: 'mana_shard',
    name: 'Aetheric Mana Shard',
    category: 'material',
    description: 'Crystallized ley-energy condensed in Elarion conduits and wild fissures.',
    value: 14,
  },
  copper_ingot: {
    id: 'copper_ingot',
    name: 'Assayed Copper Ingot',
    category: 'material',
    description: 'High-conductivity Vaelcrest copper forged for mana rails and runeblades.',
    value: 12,
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Tempered Iron Ore',
    category: 'material',
    description: 'Dense coastal iron mined along the Vaelcrest highland ridges.',
    value: 10,
  },
  aether_herb: {
    id: 'aether_herb',
    name: 'Sea-Fennel & Sage',
    category: 'material',
    description: 'Botanical reagents used in district clinics and field alchemy.',
    value: 9,
  },
  crystal_core: {
    id: 'crystal_core',
    name: 'Stabilized Crystal Core',
    category: 'material',
    description: 'High-output core salvaged from industrial conduits and furnace constructs.',
    value: 32,
  },
  wyrm_scale: {
    id: 'wyrm_scale',
    name: 'Wyrm Resonant Scale',
    category: 'material',
    description: 'Iridescent crystalline plating shed by the Emerald Wilds Crystal Wyrm.',
    value: 65,
  },

  // Consumables
  vitality_elixir: {
    id: 'vitality_elixir',
    name: 'Vitality Elixir',
    category: 'consumable',
    description: 'Restores 45 HP immediately. Hotkey: [Q].',
    value: 18,
    healHp: 45,
  },
  aether_draught: {
    id: 'aether_draught',
    name: 'Aether Draught',
    category: 'consumable',
    description: 'Restores 45 Mana and stabilizes conduit flow. Hotkey: [5].',
    value: 18,
    restoreMana: 45,
  },
  coolant_phial: {
    id: 'coolant_phial',
    name: 'Cryo-Coolant Phial',
    category: 'consumable',
    description: 'Drops Thermal Heat by 60% and clears Thermal Burnout.',
    value: 22,
    coolHeat: 60,
  },
  overclock_tonic: {
    id: 'overclock_tonic',
    name: 'Overclock Tonic',
    category: 'consumable',
    description: 'Boosts melee & spell power by 30% and restores 25 Mana for 12s.',
    value: 30,
    restoreMana: 25,
    overclockBoost: true,
  },

  // Weapons
  vaelcrest_sabre: {
    id: 'vaelcrest_sabre',
    name: 'Vaelcrest Training Sabre',
    category: 'weapon',
    description: 'Standard copper-hilted guard sabre with a thin mana-etched fuller.',
    value: 25,
    attackBonus: 0,
    spellBonus: 0,
  },
  volt_edge_sabre: {
    id: 'volt_edge_sabre',
    name: 'Volt-Edge Runeblade',
    category: 'weapon',
    description: 'Runesmithed copper-steel sabre channeling +10 melee & +8 spell damage.',
    value: 75,
    attackBonus: 10,
    spellBonus: 8,
  },
  aether_reaver: {
    id: 'aether_reaver',
    name: 'Aether-Core Reaver',
    category: 'weapon',
    description: 'Masterwork magitech blade forged with a crystal core (+20 attack, +16 spell).',
    value: 140,
    attackBonus: 20,
    spellBonus: 16,
  },

  // Armor
  harbour_coat: {
    id: 'harbour_coat',
    name: 'Mariner Greatcoat',
    category: 'armor',
    description: 'Salt-treated woollen greatcoat worn across Elarion Bay.',
    value: 20,
    armorBonus: 0,
    maxHpBonus: 0,
  },
  copper_brigandine: {
    id: 'copper_brigandine',
    name: 'Copper-Riveted Brigandine',
    category: 'armor',
    description: 'Reinforced dockguard coat (+6 armor, +25 Max HP).',
    value: 70,
    armorBonus: 6,
    maxHpBonus: 25,
  },
  runic_cuirass: {
    id: 'runic_cuirass',
    name: 'Vaelcrest Runic Cuirass',
    category: 'armor',
    description: 'Spell-warded steel plate (+14 armor, +55 Max HP, +20 Max Mana).',
    value: 150,
    armorBonus: 14,
    maxHpBonus: 55,
    maxManaBonus: 20,
  },

  // Relics
  capacitor_coil: {
    id: 'capacitor_coil',
    name: 'Guild Capacitor Coil',
    category: 'relic',
    description: 'Braided mana-works focus (+10 spell power, +20 Max Mana).',
    value: 85,
    spellBonus: 10,
    maxManaBonus: 20,
  },
  wyrm_heart_seal: {
    id: 'wyrm_heart_seal',
    name: 'Crystal Wyrm Heartstone',
    category: 'relic',
    description: 'Resonant apex trophy (+18 spell power, +12 attack, +35 Max HP & Mana).',
    value: 220,
    attackBonus: 12,
    spellBonus: 18,
    maxHpBonus: 35,
    maxManaBonus: 35,
  },
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'rcp_vitality_elixir',
    outputItemId: 'vitality_elixir',
    outputQty: 2,
    station: 'field',
    craftTimeLabel: 'Instant Field Brew',
    ingredients: [{ itemId: 'aether_herb', qty: 1 }],
    crownCost: 4,
  },
  {
    id: 'rcp_aether_draught',
    outputItemId: 'aether_draught',
    outputQty: 2,
    station: 'field',
    craftTimeLabel: 'Instant Condensation',
    ingredients: [{ itemId: 'mana_shard', qty: 1 }],
    crownCost: 4,
  },
  {
    id: 'rcp_coolant_phial',
    outputItemId: 'coolant_phial',
    outputQty: 2,
    station: 'alchemy',
    craftTimeLabel: 'Alchemy Bench',
    ingredients: [
      { itemId: 'aether_herb', qty: 1 },
      { itemId: 'mana_shard', qty: 1 },
    ],
    crownCost: 6,
  },
  {
    id: 'rcp_overclock_tonic',
    outputItemId: 'overclock_tonic',
    outputQty: 1,
    station: 'alchemy',
    craftTimeLabel: 'Alchemy Bench',
    ingredients: [
      { itemId: 'mana_shard', qty: 2 },
      { itemId: 'aether_herb', qty: 1 },
    ],
    crownCost: 10,
  },
  {
    id: 'rcp_crystal_core',
    outputItemId: 'crystal_core',
    outputQty: 1,
    station: 'field',
    craftTimeLabel: 'Conduit Synthesis',
    ingredients: [
      { itemId: 'mana_shard', qty: 2 },
      { itemId: 'copper_ingot', qty: 1 },
    ],
    crownCost: 8,
  },
  {
    id: 'rcp_volt_edge_sabre',
    outputItemId: 'volt_edge_sabre',
    outputQty: 1,
    station: 'forge',
    craftTimeLabel: 'Runesmith Forge',
    ingredients: [
      { itemId: 'copper_ingot', qty: 2 },
      { itemId: 'iron_ore', qty: 1 },
      { itemId: 'mana_shard', qty: 1 },
    ],
    crownCost: 22,
  },
  {
    id: 'rcp_aether_reaver',
    outputItemId: 'aether_reaver',
    outputQty: 1,
    station: 'forge',
    craftTimeLabel: 'Masterwork Forge',
    ingredients: [
      { itemId: 'copper_ingot', qty: 2 },
      { itemId: 'crystal_core', qty: 1 },
      { itemId: 'iron_ore', qty: 2 },
    ],
    crownCost: 45,
  },
  {
    id: 'rcp_copper_brigandine',
    outputItemId: 'copper_brigandine',
    outputQty: 1,
    station: 'forge',
    craftTimeLabel: 'Armourer Anvil',
    ingredients: [
      { itemId: 'iron_ore', qty: 2 },
      { itemId: 'copper_ingot', qty: 1 },
    ],
    crownCost: 18,
  },
  {
    id: 'rcp_runic_cuirass',
    outputItemId: 'runic_cuirass',
    outputQty: 1,
    station: 'forge',
    craftTimeLabel: 'Masterwork Forge',
    ingredients: [
      { itemId: 'iron_ore', qty: 3 },
      { itemId: 'crystal_core', qty: 1 },
      { itemId: 'copper_ingot', qty: 2 },
    ],
    crownCost: 50,
  },
  {
    id: 'rcp_capacitor_coil',
    outputItemId: 'capacitor_coil',
    outputQty: 1,
    station: 'shrine',
    craftTimeLabel: 'Ley-Shrine Focus',
    ingredients: [
      { itemId: 'crystal_core', qty: 1 },
      { itemId: 'copper_ingot', qty: 2 },
    ],
    crownCost: 25,
  },
  {
    id: 'rcp_wyrm_heart_seal',
    outputItemId: 'wyrm_heart_seal',
    outputQty: 1,
    station: 'shrine',
    craftTimeLabel: 'Ancient Ley-Altar',
    ingredients: [
      { itemId: 'wyrm_scale', qty: 1 },
      { itemId: 'crystal_core', qty: 1 },
    ],
    crownCost: 40,
  },
];

export function getItemCount(inventory: InventoryEntry[], itemId: string): number {
  return inventory.find((e) => e.itemId === itemId)?.qty ?? 0;
}

export function addItemToInventory(
  inventory: InventoryEntry[],
  itemId: string,
  qty: number
): InventoryEntry[] {
  if (qty <= 0) return inventory;
  const existing = inventory.find((e) => e.itemId === itemId);
  if (existing) {
    return inventory.map((e) => (e.itemId === itemId ? { ...e, qty: e.qty + qty } : e));
  }
  return [...inventory, { itemId, qty }];
}

export function removeItemFromInventory(
  inventory: InventoryEntry[],
  itemId: string,
  qty: number
): InventoryEntry[] {
  if (qty <= 0) return inventory;
  return inventory
    .map((e) => (e.itemId === itemId ? { ...e, qty: e.qty - qty } : e))
    .filter((e) => e.qty > 0);
}

export function isStationCompatible(
  recipeStation: CraftingStationKind,
  activeStation: CraftingStationKind
): boolean {
  if (recipeStation === 'field') return true;
  if (activeStation === recipeStation) return true;
  // Ley-shrines can also channel alchemy; forges can do field synthesis
  if (activeStation === 'shrine' && recipeStation === 'alchemy') return true;
  return false;
}

export function canCraftRecipe(
  state: Pick<RpgPlayerState, 'inventory' | 'crowns'>,
  recipe: CraftingRecipe,
  activeStation: CraftingStationKind = 'field'
): { ok: boolean; reason?: string } {
  if (!isStationCompatible(recipe.station, activeStation)) {
    const label =
      recipe.station === 'forge'
        ? 'Runesmith Forge'
        : recipe.station === 'alchemy'
          ? 'Alchemy Bench'
          : 'Ley-Shrine';
    return { ok: false, reason: `Requires ${label}` };
  }
  if (state.crowns < recipe.crownCost) {
    return { ok: false, reason: `Need ${recipe.crownCost} Crowns` };
  }
  for (const ing of recipe.ingredients) {
    if (getItemCount(state.inventory, ing.itemId) < ing.qty) {
      const name = ITEMS[ing.itemId]?.name ?? ing.itemId;
      return { ok: false, reason: `Missing ${name}` };
    }
  }
  return { ok: true };
}

export function craftRecipe(
  state: RpgPlayerState,
  recipeId: string,
  activeStation: CraftingStationKind = 'field'
): { state: RpgPlayerState; crafted: boolean; reason?: string } {
  const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) {
    return { state, crafted: false, reason: 'Unknown recipe' };
  }
  const check = canCraftRecipe(state, recipe, activeStation);
  if (!check.ok) {
    return { state, crafted: false, reason: check.reason };
  }

  let nextInv = [...state.inventory];
  for (const ing of recipe.ingredients) {
    nextInv = removeItemFromInventory(nextInv, ing.itemId, ing.qty);
  }
  nextInv = addItemToInventory(nextInv, recipe.outputItemId, recipe.outputQty);

  const outputItem = ITEMS[recipe.outputItemId];
  let nextState: RpgPlayerState = {
    ...state,
    crowns: state.crowns - recipe.crownCost,
    inventory: nextInv,
    itemsCrafted: state.itemsCrafted + 1,
  };

  // Auto-equip newly forged upgrades if strictly better
  if (outputItem?.category === 'weapon') {
    const curAtk = ITEMS[nextState.equippedWeaponId]?.attackBonus ?? 0;
    if ((outputItem.attackBonus ?? 0) > curAtk) {
      nextState = equipItem(nextState, outputItem.id);
    }
  } else if (outputItem?.category === 'armor') {
    const curArm = ITEMS[nextState.equippedArmorId]?.armorBonus ?? 0;
    if ((outputItem.armorBonus ?? 0) > curArm) {
      nextState = equipItem(nextState, outputItem.id);
    }
  } else if (outputItem?.category === 'relic') {
    const curRel = nextState.equippedRelicId ? ITEMS[nextState.equippedRelicId]?.spellBonus ?? 0 : -1;
    if ((outputItem.spellBonus ?? 0) > curRel) {
      nextState = equipItem(nextState, outputItem.id);
    }
  }

  return { state: nextState, crafted: true };
}

export function getPlayerGearBonuses(
  state: Pick<
    RpgPlayerState,
    'equippedWeaponId' | 'equippedArmorId' | 'equippedRelicId' | 'level' | 'overdriveTimer'
  >
): {
  attackBonus: number;
  spellBonus: number;
  armorBonus: number;
  maxHpBonus: number;
  maxManaBonus: number;
} {
  const weapon = ITEMS[state.equippedWeaponId];
  const armor = ITEMS[state.equippedArmorId];
  const relic = state.equippedRelicId ? ITEMS[state.equippedRelicId] : undefined;
  const levelBonus = (state.level - 1) * 3;
  const overdriveMult = state.overdriveTimer > 0 ? 1.3 : 1.0;

  const rawAtk = (weapon?.attackBonus ?? 0) + (relic?.attackBonus ?? 0) + levelBonus;
  const rawSpell = (weapon?.spellBonus ?? 0) + (relic?.spellBonus ?? 0) + levelBonus;

  return {
    attackBonus: Math.round(rawAtk * overdriveMult),
    spellBonus: Math.round(rawSpell * overdriveMult),
    armorBonus: (armor?.armorBonus ?? 0) + (relic?.armorBonus ?? 0),
    maxHpBonus: (armor?.maxHpBonus ?? 0) + (relic?.maxHpBonus ?? 0) + (state.level - 1) * 12,
    maxManaBonus: (armor?.maxManaBonus ?? 0) + (relic?.maxManaBonus ?? 0) + (state.level - 1) * 10,
  };
}

export function equipItem(state: RpgPlayerState, itemId: string): RpgPlayerState {
  const def = ITEMS[itemId];
  if (!def || getItemCount(state.inventory, itemId) <= 0) return state;

  const updated: RpgPlayerState = { ...state };
  if (def.category === 'weapon') {
    updated.equippedWeaponId = itemId;
  } else if (def.category === 'armor') {
    updated.equippedArmorId = itemId;
  } else if (def.category === 'relic') {
    updated.equippedRelicId = itemId;
  } else {
    return state;
  }

  const bonuses = getPlayerGearBonuses(updated);
  updated.maxHp = updated.baseMaxHp + bonuses.maxHpBonus;
  updated.maxMana = updated.baseMaxMana + bonuses.maxManaBonus;
  updated.hp = Math.min(updated.maxHp, updated.hp);
  updated.mana = Math.min(updated.maxMana, updated.mana);
  return updated;
}

export function useConsumable(
  state: RpgPlayerState,
  itemId: string
): { state: RpgPlayerState; used: boolean } {
  const def = ITEMS[itemId];
  if (!def || def.category !== 'consumable') return { state, used: false };
  if (getItemCount(state.inventory, itemId) <= 0) return { state, used: false };

  let nextHp = state.hp;
  let nextMana = state.mana;
  let nextHeat = state.thermalHeat;
  let nextBurnout = state.burnoutTimer;
  let nextOverdrive = state.overdriveTimer;

  if (def.healHp) nextHp = Math.min(state.maxHp, nextHp + def.healHp);
  if (def.restoreMana) nextMana = Math.min(state.maxMana, nextMana + def.restoreMana);
  if (def.coolHeat) {
    nextHeat = Math.max(0, nextHeat - def.coolHeat);
    if (nextHeat < 50) nextBurnout = 0;
  }
  if (def.overclockBoost) nextOverdrive = Math.max(nextOverdrive, 12.0);

  return {
    used: true,
    state: {
      ...state,
      hp: nextHp,
      mana: nextMana,
      thermalHeat: nextHeat,
      burnoutTimer: nextBurnout,
      overdriveTimer: nextOverdrive,
      inventory: removeItemFromInventory(state.inventory, itemId, 1),
    },
  };
}
