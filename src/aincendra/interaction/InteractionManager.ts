import * as THREE from 'three';
import type {
  ActiveInteractPrompt,
  ActiveInspection,
  FloatingInteractLabel,
  InteractableSpec,
  NpcDialogueChoice,
  NpcDialogueNode,
  NpcReactionKind,
  NpcSpawnSpec,
  PlayerEmoteKind,
} from '../core/types';
import type { NpcManager } from '../npc/NpcManager';
import type { CraftingStationKind, FactionId } from '../rpg/rpgTypes';

const _targetPos = new THREE.Vector3();
const _anchorPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _toAnchor = new THREE.Vector3();

const MAX_FLOATING_LABELS = 4;

interface InternalInteractable extends InteractableSpec {
  dialoguePool?: string[][];
  lastPoolIndex?: number;
  collected?: boolean;
}

interface NearbyEntry {
  item: InternalInteractable;
  distance: number;
  score: number;
}

function buildFallbackCitizenChoices(role: string): NpcDialogueNode[] {
  return [
    {
      id: 'greet',
      npcReaction: role === 'City Guard' || role === 'Heavy Infantry' ? 'salute' : 'wave',
      lines: [`Good day, traveller. All districts of Elarion are brisk with trade and craft today.`],
      choices: [
        {
          label: 'Ask about local life in Elarion',
          nextNodeId: 'life',
          npcReaction: 'nod',
        },
        {
          label: 'Offer a friendly salute',
          nextNodeId: 'salute_back',
          npcReaction: 'salute',
          playerEmote: 'salute',
        },
        {
          label: 'Bid farewell',
          closeDialogue: true,
          npcReaction: 'bow',
        },
      ],
    },
    {
      id: 'life',
      npcReaction: 'point',
      lines: [
        'Cargo barges arrive down the Grand Canal all morning while mana rails feed the Harbour and Citadel.',
        'Beyond the Southern Bastion Gate lie the emerald meadows and forests of the Vaelcrest Domain—speak to Captain Vane at the gate if you wish passage.',
      ],
      choices: [
        {
          label: 'Thank them for the guidance',
          closeDialogue: true,
          npcReaction: 'nod',
        },
      ],
    },
    {
      id: 'salute_back',
      npcReaction: 'salute',
      lines: ['Well met! May House Vaelcrest’s winds keep your compass true.'],
      choices: [
        {
          label: 'Farewell',
          closeDialogue: true,
          npcReaction: 'wave',
        },
      ],
    },
  ];
}

/**
 * Proximity-Based Interaction, Floating UI Label & Branching Dialogue Manager:
 * - Tracks nearby world props, pickable items, and live NPC positions within interaction radius
 * - Projects in-range 3D anchor points above props and NPC heads into 2D screen coordinates
 * - Drives branching dialogue nodes, NPC animation reactions, gate clearance unlocks, & pickups
 */
export class InteractionManager {
  private interactables: InternalInteractable[] = [];
  private nearbyTargets: NearbyEntry[] = [];
  private activeTarget: InternalInteractable | null = null;
  private activeInspectionTarget: InternalInteractable | null = null;
  private activeNpcActionSubtitle: string | undefined = undefined;
  private activeLinesSnapshot: string[] = [];
  private activeNode: NpcDialogueNode | null = null;
  private activeNpcReaction: NpcReactionKind | undefined = undefined;
  private promptChanged = false;

  private onCollectProp?: (id: string) => boolean;
  private onOpenRailStation?: (stationId: string) => void;
  private onOpenCraftingStation?: (station: CraftingStationKind) => void;
  private onQuestInspect?: (trigger: { questId: string; stageIndex: number; increment?: number }) => void;
  private totalPickablesCount = 0;
  private collectedPickablesCount = 0;
  private recentPickupTitle: string | null = null;
  private recentPickupTimer = 0;

  private lastNpcManager: NpcManager | null = null;

  public setRailOpenHandler(cb?: (stationId: string) => void): void {
    this.onOpenRailStation = cb;
  }

  public setCraftingOpenHandler(cb?: (station: CraftingStationKind) => void): void {
    this.onOpenCraftingStation = cb;
  }

  public setQuestInspectHandler(
    cb?: (trigger: { questId: string; stageIndex: number; increment?: number }) => void
  ): void {
    this.onQuestInspect = cb;
  }

  public setTargets(
    worldInteractables: InteractableSpec[] = [],
    npcSpawns: NpcSpawnSpec[] = [],
    onCollectProp?: (id: string) => boolean
  ): void {
    this.onCollectProp = onCollectProp;
    this.interactables = worldInteractables.map((item) => ({
      ...item,
      collected: false,
    }));
    this.totalPickablesCount = worldInteractables.filter((i) => i.pickable).length;
    this.collectedPickablesCount = 0;
    this.recentPickupTitle = null;
    this.recentPickupTimer = 0;

    for (const npc of npcSpawns) {
      const pool: string[][] = [];
      if (npc.dialogueLines && npc.dialogueLines.length > 0) {
        pool.push(npc.dialogueLines);
      }
      if (npc.randomDialogues && npc.randomDialogues.length > 0) {
        for (const variant of npc.randomDialogues) {
          if (variant.length > 0) pool.push(variant);
        }
      }
      const tree =
        npc.dialogueTree && npc.dialogueTree.length > 0
          ? npc.dialogueTree
          : buildFallbackCitizenChoices(npc.role);

      if (pool.length === 0 && tree.length > 0) {
        pool.push(tree[0].lines);
      }

      this.interactables.push({
        id: `npc_interact_${npc.id}`,
        title: npc.role,
        subtitle: npc.behavior === 'patrol' ? 'Patrolling Elarion' : 'At post',
        category: 'Citizen',
        promptAction: 'Speak',
        lines: pool[0] ?? ['Good day, citizen.'],
        dialoguePool: pool,
        lastPoolIndex: -1,
        dialogueTree: tree,
        initialDialogueNodeId: npc.initialDialogueNodeId ?? tree[0].id,
        position: npc.position,
        radius: npc.role === 'Heavy Infantry' ? 3.4 : 2.9,
        npcId: npc.id,
        labelHeight: 2.08,
      });
    }

    this.nearbyTargets = [];
    this.activeTarget = null;
    this.activeInspectionTarget = null;
    this.activeNpcActionSubtitle = undefined;
    this.activeLinesSnapshot = [];
    this.activeNode = null;
    this.activeNpcReaction = undefined;
    this.promptChanged = true;
  }

  public clear(): void {
    this.interactables = [];
    this.nearbyTargets = [];
    this.activeTarget = null;
    this.activeInspectionTarget = null;
    this.activeNpcActionSubtitle = undefined;
    this.activeLinesSnapshot = [];
    this.activeNode = null;
    this.activeNpcReaction = undefined;
    this.onCollectProp = undefined;
    this.totalPickablesCount = 0;
    this.collectedPickablesCount = 0;
    this.recentPickupTitle = null;
    this.recentPickupTimer = 0;
    this.promptChanged = true;
  }

  public getCollectedCount(): number {
    return this.collectedPickablesCount;
  }

  public getTotalPickables(): number {
    return this.totalPickablesCount;
  }

  public getRecentPickupTitle(): string | null {
    return this.recentPickupTitle;
  }

  public hasOpenDialogueChoices(): boolean {
    return Boolean(this.activeNode && this.activeNode.choices.length > 0);
  }

  public getActivePrompt(): ActiveInteractPrompt | null {
    if (!this.activeTarget) return null;
    return {
      id: this.activeTarget.id,
      title: this.activeTarget.title,
      promptAction: this.activeTarget.promptAction,
      category: this.activeTarget.category,
    };
  }

  public getActiveInspection(): ActiveInspection | null {
    if (!this.activeInspectionTarget) return null;
    return {
      id: this.activeInspectionTarget.id,
      title: this.activeInspectionTarget.title,
      subtitle: this.activeNpcActionSubtitle ?? this.activeInspectionTarget.subtitle,
      category: this.activeInspectionTarget.category,
      lines:
        this.activeLinesSnapshot.length > 0
          ? this.activeLinesSnapshot
          : this.activeInspectionTarget.lines,
      npcId: this.activeInspectionTarget.npcId,
      choices: this.activeNode?.choices,
      npcReaction: this.activeNpcReaction,
    };
  }

  public consumeDirty(): boolean {
    const dirty = this.promptChanged;
    this.promptChanged = false;
    return dirty;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    cameraYaw: number,
    npcManager: NpcManager
  ): void {
    this.lastNpcManager = npcManager;

    if (this.recentPickupTimer > 0) {
      this.recentPickupTimer -= dt;
      if (this.recentPickupTimer <= 0) {
        this.recentPickupTimer = 0;
        this.recentPickupTitle = null;
        this.promptChanged = true;
      }
    }

    _camForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));

    this.nearbyTargets.length = 0;
    let bestTarget: InternalInteractable | null = null;
    let bestScore = Infinity;

    for (const item of this.interactables) {
      if (item.collected) continue;

      if (item.npcId && npcManager.getNpcPosition(item.npcId, _targetPos)) {
        // Live position
      } else {
        _targetPos.set(item.position[0], item.position[1], item.position[2]);
      }

      const dy = Math.abs(playerPos.y - _targetPos.y);
      if (dy > 2.2) continue;

      const dx = _targetPos.x - playerPos.x;
      const dz = _targetPos.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > item.radius * item.radius) continue;

      const dist = Math.sqrt(distSq);
      let alignPenalty = 0;
      if (dist > 0.15) {
        const dot = (dx * _camForward.x + dz * _camForward.z) / dist;
        alignPenalty = (1 - dot) * 0.85;
      }

      const score = dist + alignPenalty;
      this.nearbyTargets.push({ item, distance: dist, score });

      if (score < bestScore) {
        bestScore = score;
        bestTarget = item;
      }
    }

    if (this.nearbyTargets.length > 1) {
      this.nearbyTargets.sort((a, b) => a.score - b.score);
    }

    if (bestTarget?.id !== this.activeTarget?.id) {
      this.activeTarget = bestTarget;
      this.promptChanged = true;
    }

    if (this.activeInspectionTarget) {
      const item = this.activeInspectionTarget;
      if (item.npcId && npcManager.getNpcPosition(item.npcId, _targetPos)) {
        // Live position
      } else {
        _targetPos.set(item.position[0], item.position[1], item.position[2]);
      }
      const dx = _targetPos.x - playerPos.x;
      const dz = _targetPos.z - playerPos.z;
      const maxStay = item.radius + 2.2;
      if (dx * dx + dz * dz > maxStay * maxStay || Math.abs(playerPos.y - _targetPos.y) > 2.8) {
        this.closeInspection();
      }
    }
  }

  public computeFloatingLabels(
    camera: THREE.Camera,
    viewportWidth: number,
    viewportHeight: number,
    npcManager: NpcManager
  ): FloatingInteractLabel[] {
    if (this.activeInspectionTarget || this.nearbyTargets.length === 0) {
      return [];
    }
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return [];
    }

    camera.getWorldDirection(_camForward);
    const labels: FloatingInteractLabel[] = [];
    const limit = Math.min(this.nearbyTargets.length, MAX_FLOATING_LABELS);

    for (let i = 0; i < limit; i++) {
      const entry = this.nearbyTargets[i];
      const item = entry.item;
      if (item.collected) continue;

      if (item.npcId && npcManager.getNpcPosition(item.npcId, _anchorPos)) {
        // Live NPC ground position
      } else {
        _anchorPos.set(item.position[0], item.position[1], item.position[2]);
      }

      const yOffset = item.labelHeight ?? (item.npcId ? 2.08 : item.pickable ? 1.05 : 1.72);
      _anchorPos.y += yOffset;

      _toAnchor.subVectors(_anchorPos, camera.position);
      if (_toAnchor.dot(_camForward) <= 0.15) continue;

      _projVec.copy(_anchorPos).project(camera);
      if (_projVec.z < -1 || _projVec.z > 1) continue;

      const rawX = (_projVec.x * 0.5 + 0.5) * viewportWidth;
      const rawY = (-_projVec.y * 0.5 + 0.5) * viewportHeight;

      if (
        rawX < -40 ||
        rawX > viewportWidth + 40 ||
        rawY < -20 ||
        rawY > viewportHeight + 40
      ) {
        continue;
      }

      const screenX = THREE.MathUtils.clamp(rawX, 76, viewportWidth - 76);
      const screenY = THREE.MathUtils.clamp(rawY, 54, viewportHeight - 28);

      const isPrimary = this.activeTarget?.id === item.id;
      const normDist = THREE.MathUtils.clamp(entry.distance / item.radius, 0, 1);
      const edgeFade = normDist > 0.8 ? 1 - (normDist - 0.8) / 0.2 : 1;
      const opacity = THREE.MathUtils.clamp(
        (isPrimary ? 1.0 : 0.78) * (0.45 + 0.55 * edgeFade),
        0,
        1
      );

      labels.push({
        id: item.id,
        title: item.title,
        promptAction: item.promptAction,
        category: item.category,
        pickable: Boolean(item.pickable),
        isPrimary,
        screenX,
        screenY,
        opacity,
        distance: entry.distance,
      });
    }

    return labels;
  }

  public triggerInteract(): void {
    if (this.activeInspectionTarget) {
      if (!this.activeTarget || this.activeTarget.id === this.activeInspectionTarget.id) {
        this.closeInspection();
        return;
      }
    }

    if (this.activeTarget) {
      const target = this.activeTarget;

      if (target.pickable) {
        const collectedNow = this.onCollectProp ? this.onCollectProp(target.id) : true;
        if (collectedNow) {
          target.collected = true;
          this.collectedPickablesCount += 1;
          this.recentPickupTitle = target.title;
          this.recentPickupTimer = 3.0;
          this.nearbyTargets = this.nearbyTargets.filter((e) => e.item.id !== target.id);
          this.activeTarget = this.nearbyTargets[0]?.item ?? null;
          this.promptChanged = true;
        }
        return;
      }

      if (target.opensRailStationId && this.onOpenRailStation) {
        this.closeInspection();
        this.onOpenRailStation(target.opensRailStationId);
        return;
      }

      if (target.opensCraftingStation && this.onOpenCraftingStation) {
        this.closeInspection();
        this.onOpenCraftingStation(target.opensCraftingStation);
        return;
      }

      if (target.questInspectTrigger) {
        this.onQuestInspect?.(target.questInspectTrigger);
      }

      this.activeInspectionTarget = target;

      if (target.dialogueTree && target.dialogueTree.length > 0) {
        const startId = target.initialDialogueNodeId ?? target.dialogueTree[0].id;
        const startNode =
          target.dialogueTree.find((n) => n.id === startId) ?? target.dialogueTree[0];
        this.activeNode = startNode;
        this.activeLinesSnapshot = startNode.lines;
        this.activeNpcReaction = startNode.npcReaction;
        if (target.npcId && startNode.npcReaction && this.lastNpcManager) {
          this.lastNpcManager.triggerNpcReaction(target.npcId, startNode.npcReaction, 2.5);
        }
      } else {
        this.activeNode = null;
        this.activeNpcReaction = undefined;
        if (target.dialoguePool && target.dialoguePool.length > 1) {
          let nextIdx = Math.floor(Math.random() * target.dialoguePool.length);
          if (nextIdx === target.lastPoolIndex) {
            nextIdx = (nextIdx + 1) % target.dialoguePool.length;
          }
          target.lastPoolIndex = nextIdx;
          this.activeLinesSnapshot = target.dialoguePool[nextIdx];
        } else {
          this.activeLinesSnapshot = target.lines;
        }
      }

      if (target.npcId && this.lastNpcManager) {
        this.activeNpcActionSubtitle =
          this.lastNpcManager.getNpcActionLabel(target.npcId) ?? target.subtitle;
      } else {
        this.activeNpcActionSubtitle = target.subtitle;
      }

      this.promptChanged = true;
    }
  }

  public selectChoice(
    index: number,
    onUnlockGate?: (gateId: string) => boolean,
    onPlayerEmote?: (emote: PlayerEmoteKind) => void,
    onQuestBranch?: (branch: {
      questId: string;
      stageIndex: number;
      label: string;
      faction: FactionId;
      repDelta: number;
    }) => void
  ): void {
    if (!this.activeInspectionTarget || !this.activeNode) return;
    const choice: NpcDialogueChoice | undefined = this.activeNode.choices[index];
    if (!choice) return;

    if (choice.playerEmote && choice.playerEmote !== 'none') {
      onPlayerEmote?.(choice.playerEmote);
    }

    if (choice.unlockGateId) {
      onUnlockGate?.(choice.unlockGateId);
    }

    if (choice.questBranch) {
      onQuestBranch?.(choice.questBranch);
    }

    const npcId = this.activeInspectionTarget.npcId;
    if (npcId && choice.npcReaction && this.lastNpcManager) {
      this.lastNpcManager.triggerNpcReaction(npcId, choice.npcReaction, 2.6);
      this.activeNpcReaction = choice.npcReaction;
    }

    if (choice.closeDialogue) {
      this.closeInspection();
      return;
    }

    if (choice.nextNodeId && this.activeInspectionTarget.dialogueTree) {
      const nextNode = this.activeInspectionTarget.dialogueTree.find(
        (n) => n.id === choice.nextNodeId
      );
      if (nextNode) {
        this.activeNode = nextNode;
        this.activeLinesSnapshot = nextNode.lines;
        if (nextNode.npcReaction) {
          this.activeNpcReaction = nextNode.npcReaction;
          if (npcId && this.lastNpcManager) {
            this.lastNpcManager.triggerNpcReaction(npcId, nextNode.npcReaction, 2.6);
          }
        }
        this.promptChanged = true;
        return;
      }
    }

    this.closeInspection();
  }

  public closeInspection(): void {
    if (this.activeInspectionTarget) {
      this.activeInspectionTarget = null;
      this.activeNpcActionSubtitle = undefined;
      this.activeLinesSnapshot = [];
      this.activeNode = null;
      this.activeNpcReaction = undefined;
      this.promptChanged = true;
    }
  }
}
