import { addItemToInventory } from './craftingData';
import { awardXpAndLevelUp } from './magicCombatRules';
import type { FactionId, QuestDef, QuestProgress, RpgPlayerState } from './rpgTypes';

export const QUEST_CATALOG: Record<string, QuestDef> = {
  q_gate_conduit: {
    id: 'q_gate_conduit',
    title: 'The Gate & The Conduit',
    giver: 'Captain Vane & Chief Artificer Rowan',
    district: 'South Bastion Gate · Mana Works',
    summary:
      'Stabilize the Mana-Silo manifold to unlock the South Bastion Gate into the Emerald Wilds. Choose whether to empower the Mana-Works Guild or the Aetheric Purists.',
    stages: [
      {
        id: 'inspect_silo',
        description: 'Gather 2 Mana Shards or inspect the Industrial Mana Substation (-47, 5).',
        targetCount: 2,
      },
      {
        id: 'craft_core',
        description: 'Synthesize a Stabilized Crystal Core (press [B] Crafting).',
        targetCount: 1,
      },
      {
        id: 'deliver_choice',
        description: 'Speak with Captain Vane at South Bastion Gate (0, 326) to choose alignment & open the gate.',
        targetCount: 1,
      },
    ],
    rewardCrowns: 60,
    rewardXp: 120,
    rewardItemId: 'capacitor_coil',
  },
  q_smelting_ashes: {
    id: 'q_smelting_ashes',
    title: 'Ashes of the Smelting Hall',
    giver: 'Master Forger Bram',
    district: 'West Industrial Quarter',
    summary:
      'Corrupted Sentinels prowl the freight yards. Defeat them and forge an enchanted blade at a Runesmith Forge.',
    stages: [
      {
        id: 'defeat_sentinels',
        description: 'Defeat 2 hostile Sentinels or Constructs across Elarion.',
        targetCount: 2,
      },
      {
        id: 'forge_blade',
        description: 'Craft a Volt-Edge Runeblade or Copper Brigandine at a Forge.',
        targetCount: 1,
      },
    ],
    rewardCrowns: 75,
    rewardXp: 150,
  },
  q_emerald_shadows: {
    id: 'q_emerald_shadows',
    title: 'Shadows in the Emerald Wilds',
    giver: 'Scholar Lyra',
    district: 'Vaelcrest Countryside',
    summary:
      'Beyond the Bastion Gate, corrupted ley-lines have awakened Rogue Mages, a Furnace Golem, and the Aetheric Crystal Wyrm.',
    stages: [
      {
        id: 'clear_wilds',
        description: 'Defeat 3 corrupted foes in the Vaelcrest Wilds.',
        targetCount: 3,
      },
      {
        id: 'slay_wyrm',
        description: 'Vanquish the Aetheric Crystal Wyrm at the Ancient Ley-Portal (South Wilds).',
        targetCount: 1,
      },
    ],
    rewardCrowns: 200,
    rewardXp: 350,
    rewardItemId: 'wyrm_scale',
  },
  q_council_conspiracy: {
    id: 'q_council_conspiracy',
    title: 'The Three-Council Ledger',
    giver: 'Harbourmaster & Chancery',
    district: 'Grand Harbour · Noble Heights',
    summary:
      'Recover 3 field dispatches or seals across Elarion’s piers and squares, then decide how to settle the Reserve Bank tariff dispute.',
    stages: [
      {
        id: 'gather_seals',
        description: 'Collect 3 field relics or dispatches across Elarion.',
        targetCount: 3,
      },
      {
        id: 'settle_charter',
        description: 'Speak with Captain Vane or a District Clerk to file your Council verdict.',
        targetCount: 1,
      },
    ],
    rewardCrowns: 95,
    rewardXp: 140,
  },
};

export const QUEST_ORDER = [
  'q_gate_conduit',
  'q_smelting_ashes',
  'q_emerald_shadows',
  'q_council_conspiracy',
];

export function createInitialQuests(): Record<string, QuestProgress> {
  return {
    q_gate_conduit: { questId: 'q_gate_conduit', status: 'active', stageIndex: 0, stageCount: 0 },
    q_smelting_ashes: { questId: 'q_smelting_ashes', status: 'active', stageIndex: 0, stageCount: 0 },
    q_emerald_shadows: { questId: 'q_emerald_shadows', status: 'active', stageIndex: 0, stageCount: 0 },
    q_council_conspiracy: { questId: 'q_council_conspiracy', status: 'active', stageIndex: 0, stageCount: 0 },
  };
}

export function advanceQuestProgress(
  state: RpgPlayerState,
  questId: string,
  expectedStageIndex: number,
  increment = 1,
  branchChoice?: { label: string; faction: FactionId; repDelta: number }
): { state: RpgPlayerState; completedNow: boolean; stageAdvanced: boolean } {
  const current = state.quests[questId];
  const def = QUEST_CATALOG[questId];
  if (!current || !def || current.status === 'completed') {
    return { state, completedNow: false, stageAdvanced: false };
  }
  if (current.stageIndex !== expectedStageIndex) {
    return { state, completedNow: false, stageAdvanced: false };
  }

  const stage = def.stages[expectedStageIndex];
  const nextCount = Math.min(stage.targetCount, current.stageCount + increment);
  let nextStageIdx = current.stageIndex;
  let nextStageCount = nextCount;
  let nextStatus: QuestProgress['status'] = current.status;
  let completedNow = false;
  let stageAdvanced = false;

  if (nextCount >= stage.targetCount) {
    stageAdvanced = true;
    if (expectedStageIndex + 1 < def.stages.length) {
      nextStageIdx = expectedStageIndex + 1;
      nextStageCount = 0;
    } else {
      nextStatus = 'completed';
      completedNow = true;
    }
  }

  let nextState: RpgPlayerState = {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...current,
        status: nextStatus,
        stageIndex: nextStageIdx,
        stageCount: nextStageCount,
        branchChosen: branchChoice?.label ?? current.branchChosen,
      },
    },
  };

  if (branchChoice) {
    nextState = {
      ...nextState,
      factionRep: {
        ...nextState.factionRep,
        [branchChoice.faction]: (nextState.factionRep[branchChoice.faction] ?? 0) + branchChoice.repDelta,
      },
    };
  }

  if (completedNow) {
    if (def.rewardItemId) {
      nextState = {
        ...nextState,
        inventory: addItemToInventory(nextState.inventory, def.rewardItemId, 1),
      };
    }
    const leveled = awardXpAndLevelUp(nextState, def.rewardXp, def.rewardCrowns);
    nextState = leveled.state;

    // Auto-select next active quest if tracked one finished
    if (nextState.trackedQuestId === questId) {
      const nextActive = QUEST_ORDER.find((id) => nextState.quests[id]?.status === 'active');
      if (nextActive) {
        nextState = { ...nextState, trackedQuestId: nextActive };
      }
    }
  }

  return { state: nextState, completedNow, stageAdvanced };
}
