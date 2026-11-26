export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';
export type GameOutcome = 'none' | 'defeat' | 'victory';

export type ItemCategory = 'material' | 'consumable' | 'weapon' | 'armor' | 'relic';
export type CraftingStationKind = 'field' | 'forge' | 'alchemy' | 'shrine';
export type SpellId = 'arc_bolt' | 'pyre_nova' | 'chrono_ward' | 'ley_lance';
export type FactionId = 'vaelcrest' | 'manaworks' | 'purists';
export type EnemyArchetype = 'sentinel' | 'ley-mage' | 'furnace-golem' | 'crystal-wyrm';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  value: number;
  attackBonus?: number;
  spellBonus?: number;
  armorBonus?: number;
  maxHpBonus?: number;
  maxManaBonus?: number;
  healHp?: number;
  restoreMana?: number;
  coolHeat?: number;
  overclockBoost?: boolean;
}

export interface InventoryEntry {
  itemId: string;
  qty: number;
}

export interface CraftingIngredient {
  itemId: string;
  qty: number;
}

export interface CraftingRecipe {
  id: string;
  outputItemId: string;
  outputQty: number;
  station: CraftingStationKind;
  craftTimeLabel: string;
  ingredients: CraftingIngredient[];
  crownCost: number;
}

export interface SpellDef {
  id: SpellId;
  hotkey: '1' | '2' | '3' | '4';
  name: string;
  school: 'Voltaic' | 'Pyre' | 'Chrono' | 'Aether';
  manaCost: number;
  heatGain: number;
  cooldown: number;
  baseDamage: number;
  radius?: number;
  range?: number;
  description: string;
  accentHex: string;
}

export type QuestStatus = 'available' | 'active' | 'completed';

export interface QuestStage {
  id: string;
  description: string;
  targetCount: number;
}

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  district: string;
  summary: string;
  stages: QuestStage[];
  rewardCrowns: number;
  rewardXp: number;
  rewardItemId?: string;
}

export interface QuestProgress {
  questId: string;
  status: QuestStatus;
  stageIndex: number;
  stageCount: number;
  branchChosen?: string;
}

export interface RpgPlayerState {
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  mana: number;
  maxMana: number;
  baseMaxMana: number;
  thermalHeat: number;
  burnoutTimer: number;
  capacitorCharge: number;
  level: number;
  xp: number;
  xpToNext: number;
  crowns: number;
  equippedWeaponId: string;
  equippedArmorId: string;
  equippedRelicId: string | null;
  inventory: InventoryEntry[];
  quests: Record<string, QuestProgress>;
  trackedQuestId: string;
  factionRep: Record<FactionId, number>;
  spellCooldowns: Record<SpellId, number>;
  ventCooldown: number;
  activeWardTimer: number;
  overdriveTimer: number;
  enemiesDefeated: number;
  bossesDefeated: number;
  itemsCrafted: number;
  gatheringNodesLooted: number;
}

export interface RpgHudSnapshot {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  thermalHeat: number;
  burnoutActive: boolean;
  overclocked: boolean;
  capacitorCharge: number;
  level: number;
  xp: number;
  xpToNext: number;
  crowns: number;
  attackPower: number;
  spellPower: number;
  armorRating: number;
  equippedWeaponName: string;
  equippedArmorName: string;
  equippedRelicName: string | null;
  spellCooldowns: Record<SpellId, number>;
  ventCooldown: number;
  activeWardTimer: number;
  overdriveTimer: number;
  inventory: InventoryEntry[];
  quests: Record<string, QuestProgress>;
  trackedQuestId: string;
  factionRep: Record<FactionId, number>;
  enemiesDefeated: number;
  bossesDefeated: number;
  itemsCrafted: number;
  elixirCount: number;
  draughtCount: number;
  nearestStation: CraftingStationKind;
  nearbyEnemyCount: number;
  stormConductive?: boolean;
  activeBoss: {
    name: string;
    hp: number;
    maxHp: number;
    poise: number;
    maxPoise: number;
    staggered: boolean;
  } | null;
}

export interface ActiveWorldNotification {
  id: string;
  title: string;
  detail: string;
  tone: 'quest' | 'craft' | 'combat' | 'loot' | 'level';
}
