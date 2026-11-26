import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemToInventory,
  canCraftRecipe,
  CRAFTING_RECIPES,
  craftRecipe,
  equipItem,
  getItemCount,
  getPlayerGearBonuses,
  useConsumable,
} from './craftingData';
import {
  applyMeleeCapacitorGain,
  awardXpAndLevelUp,
  resolveExothermicVent,
  resolvePlayerDamageTaken,
  resolveSpellCast,
  stepRpgVitals,
} from './magicCombatRules';
import { advanceQuestProgress, createInitialQuests } from './questData';
import type { RpgPlayerState } from './rpgTypes';

function makeTestState(): RpgPlayerState {
  return {
    hp: 100,
    maxHp: 100,
    baseMaxHp: 100,
    mana: 100,
    maxMana: 100,
    baseMaxMana: 100,
    thermalHeat: 0,
    burnoutTimer: 0,
    capacitorCharge: 0,
    level: 1,
    xp: 0,
    xpToNext: 100,
    crowns: 50,
    equippedWeaponId: 'vaelcrest_sabre',
    equippedArmorId: 'harbour_coat',
    equippedRelicId: null,
    inventory: [
      { itemId: 'mana_shard', qty: 3 },
      { itemId: 'copper_ingot', qty: 2 },
      { itemId: 'iron_ore', qty: 2 },
      { itemId: 'aether_herb', qty: 2 },
      { itemId: 'vitality_elixir', qty: 1 },
    ],
    quests: createInitialQuests(),
    trackedQuestId: 'q_gate_conduit',
    factionRep: { vaelcrest: 10, manaworks: 5, purists: 5 },
    spellCooldowns: { arc_bolt: 0, pyre_nova: 0, chrono_ward: 0, ley_lance: 0 },
    ventCooldown: 0,
    activeWardTimer: 0,
    overdriveTimer: 0,
    enemiesDefeated: 0,
    bossesDefeated: 0,
    itemsCrafted: 0,
    gatheringNodesLooted: 0,
  };
}

test('crafting checks station requirements, consumes ingredients, and auto-equips upgrades', () => {
  const s0 = makeTestState();
  const bladeRecipe = CRAFTING_RECIPES.find((r) => r.id === 'rcp_volt_edge_sabre')!;

  // Field station cannot forge weapons
  assert.equal(canCraftRecipe(s0, bladeRecipe, 'field').ok, false);
  // Forge station succeeds
  assert.equal(canCraftRecipe(s0, bladeRecipe, 'forge').ok, true);

  const res = craftRecipe(s0, 'rcp_volt_edge_sabre', 'forge');
  assert.equal(res.crafted, true);
  assert.equal(res.state.equippedWeaponId, 'volt_edge_sabre');
  assert.equal(getItemCount(res.state.inventory, 'copper_ingot'), 0);
  assert.equal(res.state.crowns, 28);
  assert.equal(getPlayerGearBonuses(res.state).attackBonus, 10);
});

test('thermal-aether spell casting consumes mana, builds heat, uses capacitor, and vents cleanly', () => {
  let s = makeTestState();
  s = applyMeleeCapacitorGain(s, 40);
  assert.equal(s.capacitorCharge, 40);

  const cast1 = resolveSpellCast(s, 'arc_bolt');
  assert.equal(cast1.ok, true);
  assert.equal(cast1.usedCapacitor, true);
  assert.ok(cast1.damage > 45);
  assert.equal(cast1.state.thermalHeat, 18);

  // Overheat into burnout and clear via Exothermic Vent
  let hotState: RpgPlayerState = { ...cast1.state, thermalHeat: 85, mana: 100 };
  const overclockedCast = resolveSpellCast(hotState, 'pyre_nova');
  assert.equal(overclockedCast.ok, true);
  assert.equal(overclockedCast.overclocked, true);
  assert.equal(overclockedCast.triggeredBurnout, true);
  assert.equal(overclockedCast.state.thermalHeat, 100);

  // Cannot cast during burnout
  const blocked = resolveSpellCast(overclockedCast.state, 'arc_bolt');
  assert.equal(blocked.ok, false);

  // Exothermic Vent dumps heat, clears burnout, and deals AoE damage
  const vented = resolveExothermicVent(overclockedCast.state);
  assert.equal(vented.ok, true);
  assert.equal(vented.state.thermalHeat, 0);
  assert.equal(vented.state.burnoutTimer, 0);
  assert.ok(vented.damage >= 80);
});

test('damage mitigation, timed parry, consumables, and XP leveling work deterministically', () => {
  let s = makeTestState();
  s = { ...s, inventory: addItemToInventory(s.inventory, 'copper_brigandine', 1) };
  s = equipItem(s, 'copper_brigandine');
  assert.equal(s.maxHp, 125);

  const parried = resolvePlayerDamageTaken(s, 40, { guarding: true, parried: true });
  assert.equal(parried.damageTaken, 0);
  assert.equal(parried.parried, true);
  assert.ok(parried.state.capacitorCharge > 0);

  const hit = resolvePlayerDamageTaken(parried.state, 50, { guarding: false, parried: false });
  assert.ok(hit.damageTaken > 20 && hit.damageTaken < 50);

  const healed = useConsumable(hit.state, 'vitality_elixir');
  assert.equal(healed.used, true);
  assert.equal(healed.state.hp, Math.min(hit.state.maxHp, hit.state.hp + 45));

  const leveled = awardXpAndLevelUp(healed.state, 120, 30);
  assert.equal(leveled.leveledUp, true);
  assert.equal(leveled.state.level, 2);
  assert.equal(leveled.state.crowns, 80);
  assert.equal(leveled.state.hp, leveled.state.maxHp);

  const stepped = stepRpgVitals({ ...leveled.state, thermalHeat: 20 }, 0.05);
  assert.ok(stepped.thermalHeat < 20);
});

test('branching quests advance stages, grant rewards, and update faction reputation', () => {
  let s = makeTestState();
  const st0 = advanceQuestProgress(s, 'q_gate_conduit', 0, 2);
  assert.equal(st0.stageAdvanced, true);
  assert.equal(st0.state.quests.q_gate_conduit.stageIndex, 1);

  const st1 = advanceQuestProgress(st0.state, 'q_gate_conduit', 1, 1);
  assert.equal(st1.stageAdvanced, true);
  assert.equal(st1.state.quests.q_gate_conduit.stageIndex, 2);

  const st2 = advanceQuestProgress(st1.state, 'q_gate_conduit', 2, 1, {
    label: 'Aligned with Mana-Works Guild',
    faction: 'manaworks',
    repDelta: 25,
  });
  assert.equal(st2.completedNow, true);
  assert.equal(st2.state.quests.q_gate_conduit.status, 'completed');
  assert.equal(st2.state.factionRep.manaworks, 30);
  assert.equal(getItemCount(st2.state.inventory, 'capacitor_coil'), 1);
});

import {
  applyEnemyStanceDamage,
  evaluateGasAttributes,
  resolveRiposteStrike,
} from './gasAttributes';

test('GAS attributes, stance break, and riposte finisher scale cleanly', () => {
  const s0 = makeTestState();
  const clearAttrs = evaluateGasAttributes(s0, 'clear');
  assert.equal(clearAttrs.activeTags.length, 0);
  assert.equal(clearAttrs.spellDamageMult, 1.0);

  const stormOverclockAttrs = evaluateGasAttributes(
    { ...s0, thermalHeat: 80, overdriveTimer: 3 },
    'rainy'
  );
  assert.ok(stormOverclockAttrs.activeTags.includes('State.Overclock'));
  assert.ok(stormOverclockAttrs.activeTags.includes('Env.StormConductive'));
  assert.ok(stormOverclockAttrs.activeTags.includes('Buff.Overdrive'));
  assert.ok(stormOverclockAttrs.spellDamageMult > 1.7);
  assert.ok(stormOverclockAttrs.poiseDamageMult > 1.3);

  const chip = applyEnemyStanceDamage(60, 60, 25);
  assert.equal(chip.nextPoise, 35);
  assert.equal(chip.staggeredNow, false);

  const broken = applyEnemyStanceDamage(chip.nextPoise, 60, 40);
  assert.equal(broken.nextPoise, 0);
  assert.equal(broken.staggeredNow, true);

  const riposte = resolveRiposteStrike(clearAttrs.attackPower, clearAttrs.spellPower);
  assert.ok(riposte.damage >= 50);
  assert.equal(riposte.capacitorGain, 35);
  assert.equal(riposte.heatRelief, 35);
});

