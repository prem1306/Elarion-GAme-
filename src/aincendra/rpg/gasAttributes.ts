import type { WeatherState } from '../core/types';
import { getPlayerGearBonuses } from './craftingData';
import type { RpgPlayerState } from './rpgTypes';

export type GameplayTag =
  | 'State.Overclock'
  | 'State.Burnout'
  | 'Buff.ChronoWard'
  | 'Buff.Overdrive'
  | 'Env.StormConductive'
  | 'Env.EmberHeat';

export interface GasAttributeSet {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  thermalHeat: number;
  capacitorCharge: number;
  attackPower: number;
  spellPower: number;
  armor: number;
  poiseDamageMult: number;
  spellDamageMult: number;
  heatCoolingMult: number;
  activeTags: GameplayTag[];
}

export interface StanceBreakResult {
  nextPoise: number;
  staggeredNow: boolean;
}

export interface RiposteResolution {
  damage: number;
  capacitorGain: number;
  heatRelief: number;
}

export function evaluateGasAttributes(
  rpg: RpgPlayerState,
  weather: WeatherState = 'clear'
): GasAttributeSet {
  const gear = getPlayerGearBonuses(rpg);
  const levelAtk = (rpg.level - 1) * 3;
  const levelSpell = (rpg.level - 1) * 3;
  const activeTags: GameplayTag[] = [];

  const overclocked = rpg.thermalHeat >= 75 && rpg.burnoutTimer <= 0;
  if (overclocked) activeTags.push('State.Overclock');
  if (rpg.burnoutTimer > 0) activeTags.push('State.Burnout');
  if (rpg.activeWardTimer > 0) activeTags.push('Buff.ChronoWard');
  if (rpg.overdriveTimer > 0) activeTags.push('Buff.Overdrive');

  if (weather === 'rainy') {
    activeTags.push('Env.StormConductive');
  } else if (weather === 'overcast') {
    activeTags.push('Env.EmberHeat');
  }

  let spellDamageMult = 1.0;
  let poiseDamageMult = 1.0;
  let heatCoolingMult = 1.0;
  let attackPower = 22 + gear.attackBonus + levelAtk;
  const spellPower = gear.spellBonus + levelSpell;

  if (overclocked) {
    spellDamageMult += 0.35;
    poiseDamageMult += 0.25;
  }
  if (rpg.overdriveTimer > 0) {
    attackPower = Math.round(attackPower * 1.3);
    spellDamageMult += 0.3;
    poiseDamageMult += 0.2;
  }
  if (weather === 'rainy') {
    spellDamageMult += 0.2;
    heatCoolingMult += 0.25;
  }

  return {
    hp: rpg.hp,
    maxHp: rpg.maxHp,
    mana: rpg.mana,
    maxMana: rpg.maxMana,
    thermalHeat: rpg.thermalHeat,
    capacitorCharge: rpg.capacitorCharge,
    attackPower,
    spellPower,
    armor: gear.armorBonus,
    poiseDamageMult,
    spellDamageMult,
    heatCoolingMult,
    activeTags,
  };
}

export function applyEnemyStanceDamage(
  currentPoise: number,
  maxPoise: number,
  incomingStanceDamage: number
): StanceBreakResult {
  if (maxPoise <= 0 || currentPoise <= 0) {
    return { nextPoise: 0, staggeredNow: false };
  }
  const dmg = Math.max(0, Math.round(incomingStanceDamage));
  const nextPoise = Math.max(0, currentPoise - dmg);
  return {
    nextPoise,
    staggeredNow: nextPoise === 0,
  };
}

export function resolveRiposteStrike(attackPower: number, spellPower: number): RiposteResolution {
  const damage = Math.max(45, Math.round(attackPower * 2.3 + spellPower * 1.35));
  return {
    damage,
    capacitorGain: 35,
    heatRelief: 35,
  };
}
