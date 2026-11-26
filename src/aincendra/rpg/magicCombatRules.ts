import { getPlayerGearBonuses } from './craftingData';
import type { RpgPlayerState, SpellDef, SpellId } from './rpgTypes';

export const SPELLS: Record<SpellId, SpellDef> = {
  arc_bolt: {
    id: 'arc_bolt',
    hotkey: '1',
    name: 'Arc Bolt',
    school: 'Voltaic',
    manaCost: 16,
    heatGain: 18,
    cooldown: 1.1,
    baseDamage: 34,
    range: 26,
    description: 'Fires a lightning bolt. Consumes Capacitor Charge for +45% arc surge.',
    accentHex: '#6ee3f5',
  },
  pyre_nova: {
    id: 'pyre_nova',
    hotkey: '2',
    name: 'Pyre Nova',
    school: 'Pyre',
    manaCost: 26,
    heatGain: 30,
    cooldown: 4.2,
    baseDamage: 48,
    radius: 5.8,
    description: 'Erupts a radial mana-flame blast around you, staggering nearby foes.',
    accentHex: '#f59e0b',
  },
  chrono_ward: {
    id: 'chrono_ward',
    hotkey: '3',
    name: 'Chrono Ward',
    school: 'Chrono',
    manaCost: 22,
    heatGain: 18,
    cooldown: 7.0,
    baseDamage: 0,
    radius: 4.5,
    description: '4.5s Aether Shield (-45% damage taken) that chills & slows attackers.',
    accentHex: '#a78bfa',
  },
  ley_lance: {
    id: 'ley_lance',
    hotkey: '4',
    name: 'Ley-Siphon Lance',
    school: 'Aether',
    manaCost: 32,
    heatGain: 26,
    cooldown: 5.5,
    baseDamage: 62,
    range: 22,
    description: 'Piercing arcane lance that drains +18 HP on impact.',
    accentHex: '#34d399',
  },
};

export const SPELL_ORDER: SpellId[] = ['arc_bolt', 'pyre_nova', 'chrono_ward', 'ley_lance'];

export function isOverclocked(state: Pick<RpgPlayerState, 'thermalHeat' | 'burnoutTimer'>): boolean {
  return state.burnoutTimer <= 0 && state.thermalHeat >= 75;
}

export function resolveSpellCast(
  state: RpgPlayerState,
  spellId: SpellId
): {
  ok: boolean;
  reason?: string;
  state: RpgPlayerState;
  damage: number;
  usedCapacitor: boolean;
  overclocked: boolean;
  triggeredBurnout: boolean;
} {
  const spell = SPELLS[spellId];
  if (state.burnoutTimer > 0) {
    return {
      ok: false,
      reason: 'Core Burnout — cool down or press [G] Vent!',
      state,
      damage: 0,
      usedCapacitor: false,
      overclocked: false,
      triggeredBurnout: false,
    };
  }
  if (state.spellCooldowns[spellId] > 0) {
    return {
      ok: false,
      reason: `${spell.name} recharging`,
      state,
      damage: 0,
      usedCapacitor: false,
      overclocked: false,
      triggeredBurnout: false,
    };
  }
  if (state.mana < spell.manaCost) {
    return {
      ok: false,
      reason: `Need ${spell.manaCost} Mana`,
      state,
      damage: 0,
      usedCapacitor: false,
      overclocked: false,
      triggeredBurnout: false,
    };
  }

  const bonuses = getPlayerGearBonuses(state);
  const overclocked = isOverclocked(state);
  let damage = spell.baseDamage > 0 ? spell.baseDamage + bonuses.spellBonus : 0;
  let usedCapacitor = false;
  let nextCap = state.capacitorCharge;

  if (spellId === 'arc_bolt' && state.capacitorCharge >= 35) {
    damage = Math.round(damage * 1.45);
    nextCap = Math.max(0, state.capacitorCharge - 35);
    usedCapacitor = true;
  }
  if (overclocked && damage > 0) {
    damage = Math.round(damage * 1.3);
  }

  const nextHeat = Math.min(100, state.thermalHeat + spell.heatGain);
  const triggeredBurnout = nextHeat >= 100;

  const nextState: RpgPlayerState = {
    ...state,
    mana: state.mana - spell.manaCost,
    thermalHeat: nextHeat,
    burnoutTimer: triggeredBurnout ? 2.8 : state.burnoutTimer,
    capacitorCharge: nextCap,
    activeWardTimer: spellId === 'chrono_ward' ? 4.5 : state.activeWardTimer,
    spellCooldowns: {
      ...state.spellCooldowns,
      [spellId]: spell.cooldown,
    },
  };

  return {
    ok: true,
    state: nextState,
    damage,
    usedCapacitor,
    overclocked,
    triggeredBurnout,
  };
}

export function resolveExothermicVent(state: RpgPlayerState): {
  ok: boolean;
  reason?: string;
  state: RpgPlayerState;
  damage: number;
  ventedHeat: number;
} {
  if (state.ventCooldown > 0) {
    return { ok: false, reason: 'Vent recharging', state, damage: 0, ventedHeat: 0 };
  }
  if (state.thermalHeat < 25) {
    return { ok: false, reason: 'Need >= 25% Heat to Vent', state, damage: 0, ventedHeat: 0 };
  }
  const bonuses = getPlayerGearBonuses(state);
  const ventedHeat = state.thermalHeat;
  const damage = Math.round(22 + ventedHeat * 0.65 + bonuses.spellBonus * 0.8);
  return {
    ok: true,
    ventedHeat,
    damage,
    state: {
      ...state,
      thermalHeat: 0,
      burnoutTimer: 0,
      ventCooldown: 3.5,
      mana: Math.min(state.maxMana, state.mana + Math.round(ventedHeat * 0.18)),
    },
  };
}

export function applyMeleeCapacitorGain(state: RpgPlayerState, gain = 18): RpgPlayerState {
  return {
    ...state,
    capacitorCharge: Math.min(100, state.capacitorCharge + gain),
    mana: Math.min(state.maxMana, state.mana + 4),
  };
}

export function resolvePlayerDamageTaken(
  state: RpgPlayerState,
  rawDamage: number,
  options: { guarding: boolean; parried: boolean }
): {
  state: RpgPlayerState;
  damageTaken: number;
  parried: boolean;
  defeated: boolean;
} {
  if (options.parried) {
    return {
      state: {
        ...state,
        capacitorCharge: Math.min(100, state.capacitorCharge + 28),
        mana: Math.min(state.maxMana, state.mana + 12),
      },
      damageTaken: 0,
      parried: true,
      defeated: false,
    };
  }

  const bonuses = getPlayerGearBonuses(state);
  const armorMitigation = 100 / (100 + bonuses.armorBonus * 3.5);
  let scaled = rawDamage * armorMitigation;
  if (options.guarding) scaled *= 0.28;
  if (state.activeWardTimer > 0) scaled *= 0.55;

  const damageTaken = Math.max(1, Math.round(scaled));
  const nextHp = Math.max(0, state.hp - damageTaken);
  return {
    state: {
      ...state,
      hp: nextHp,
    },
    damageTaken,
    parried: false,
    defeated: nextHp === 0,
  };
}

export function awardXpAndLevelUp(
  state: RpgPlayerState,
  xpGain: number,
  crownsGain = 0
): { state: RpgPlayerState; leveledUp: boolean } {
  let xp = state.xp + xpGain;
  let level = state.level;
  let xpToNext = state.xpToNext;
  let leveledUp = false;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(xpToNext * 1.45);
    leveledUp = true;
  }

  const updated: RpgPlayerState = {
    ...state,
    xp,
    level,
    xpToNext,
    crowns: state.crowns + crownsGain,
  };

  if (leveledUp) {
    const bonuses = getPlayerGearBonuses(updated);
    updated.maxHp = updated.baseMaxHp + bonuses.maxHpBonus;
    updated.maxMana = updated.baseMaxMana + bonuses.maxManaBonus;
    updated.hp = updated.maxHp;
    updated.mana = updated.maxMana;
  }

  return { state: updated, leveledUp };
}

export function stepRpgVitals(state: RpgPlayerState, dt: number): RpgPlayerState {
  const clamped = Math.min(dt, 0.05);
  const nextBurnout = Math.max(0, state.burnoutTimer - clamped);
  const heatCoolRate = state.burnoutTimer > 0 ? 18 : 7.5;
  const nextHeat = Math.max(0, state.thermalHeat - heatCoolRate * clamped);
  const manaRegen = state.burnoutTimer > 0 ? 1.5 : 5.2;

  return {
    ...state,
    mana: Math.min(state.maxMana, state.mana + manaRegen * clamped),
    hp: Math.min(state.maxHp, state.hp + 0.65 * clamped),
    thermalHeat: nextHeat,
    burnoutTimer: nextBurnout,
    ventCooldown: Math.max(0, state.ventCooldown - clamped),
    activeWardTimer: Math.max(0, state.activeWardTimer - clamped),
    overdriveTimer: Math.max(0, state.overdriveTimer - clamped),
    spellCooldowns: {
      arc_bolt: Math.max(0, state.spellCooldowns.arc_bolt - clamped),
      pyre_nova: Math.max(0, state.spellCooldowns.pyre_nova - clamped),
      chrono_ward: Math.max(0, state.spellCooldowns.chrono_ward - clamped),
      ley_lance: Math.max(0, state.spellCooldowns.ley_lance - clamped),
    },
  };
}
