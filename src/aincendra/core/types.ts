import * as THREE from 'three';
import type {
  ActiveWorldNotification,
  CraftingStationKind,
  FactionId,
  GameLifecycleState,
  GameOutcome,
  RpgHudSnapshot,
  SpellId,
} from '../rpg/rpgTypes';
import type { LootPropSpec } from '../world/WorldStationsAndLoot';

export type CameraMode = 'third-person' | 'first-person';
export type MapId = 'elarion-district' | 'greybox';
export type WeatherState = 'clear' | 'overcast' | 'rainy';

export interface MovementConfig {
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  acceleration: number;
  deceleration: number;
  pivotTraction: number;
  airControl: number;
  rotationRate: number;
  jumpVelocity: number;
  gravity: number;
  coyoteTime: number;
  jumpBufferTime: number;
  stepUpHeight: number;
  stepDownSnap: number;
  standHeight: number;
  crouchHeight: number;
  capsuleRadius: number;
  cameraDistance: number;
  cameraSensitivity: number;
  cameraLagSpeed: number;
  baseFov: number;
  sprintFov: number;
  crouchFov: number;
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  walkSpeed: 4.8,
  sprintSpeed: 8.4,
  crouchSpeed: 2.5,
  acceleration: 20.0,
  deceleration: 26.0,
  pivotTraction: 1.75,
  airControl: 0.4,
  rotationRate: 14.0,
  jumpVelocity: 7.0,
  gravity: 21.0,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  stepUpHeight: 0.36,
  stepDownSnap: 0.34,
  standHeight: 1.82,
  crouchHeight: 1.16,
  capsuleRadius: 0.36,
  cameraDistance: 4.4,
  cameraSensitivity: 0.0024,
  cameraLagSpeed: 16.0,
  baseFov: 62,
  sprintFov: 68,
  crouchFov: 59,
};

export interface BoxCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface RampCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Direction of ascent: '+z' | '-z' | '+x' | '-x' */
  axis: '+z' | '-z' | '+x' | '-x';
  yStart: number;
  yEnd: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface InputSnapshot {
  moveForward: number; // -1..1
  moveRight: number;   // -1..1
  sprintHeld: boolean;
  crouchActive: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  interactPressed: boolean;
  attackPressed: boolean;
  heavyAttackPressed: boolean;
  firearmPressed: boolean;
  dodgePressed: boolean;
  spellPressed: SpellId | null;
  ventPressed: boolean;
  healPressed: boolean;
  manaPotionPressed: boolean;
  emotePressed: PlayerEmoteKind | null;
  guardHeld: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
}

export type PlayerEmoteKind = 'none' | 'wave' | 'salute' | 'sit';
export type NpcReactionKind = 'none' | 'salute' | 'wave' | 'nod' | 'laugh' | 'point' | 'bow';

export type LocomotionState =
  | 'Idle'
  | 'Walking'
  | 'Sprinting'
  | 'Crouching'
  | 'Airborne'
  | 'Dodge Rolling'
  | 'Vaulting'
  | 'Sitting'
  | 'Waving'
  | 'Saluting';

export type CombatState =
  | 'Ready'
  | 'Windup'
  | 'Slash 1'
  | 'Slash 2'
  | 'Finisher'
  | 'Heavy Windup'
  | 'Heavy Cleave'
  | 'Sidearm Shot'
  | 'Guarding';

export type NpcRole =
  | 'Harbour Worker'
  | 'Dock Porter'
  | 'Customs Clerk'
  | 'Harbourmaster'
  | 'Tavern Barkeep'
  | 'Merchant'
  | 'Engineer'
  | 'Scholar'
  | 'Resident'
  | 'City Guard'
  | 'Heavy Infantry';

export type NpcBehaviorType = 'idle' | 'patrol' | 'work' | 'interact';

export type NpcActionKind =
  | 'forge'
  | 'sweep'
  | 'haul'
  | 'clipboard'
  | 'browse'
  | 'converse'
  | 'announce'
  | 'watch'
  | 'patrol'
  | 'idle';

export interface NpcDialogueChoice {
  label: string;
  nextNodeId?: string;
  closeDialogue?: boolean;
  npcReaction?: NpcReactionKind;
  playerEmote?: PlayerEmoteKind;
  unlockGateId?: string;
  questBranch?: {
    questId: string;
    stageIndex: number;
    label: string;
    faction: FactionId;
    repDelta: number;
  };
}

export interface NpcDialogueNode {
  id: string;
  lines: string[];
  npcReaction?: NpcReactionKind;
  choices: NpcDialogueChoice[];
}

export interface NpcSpawnSpec {
  id: string;
  role: NpcRole;
  behavior: NpcBehaviorType;
  actionKind?: NpcActionKind;
  position: [number, number, number];
  facingYaw: number;
  tunicColor: number;
  accentColor: number;
  heavyArmor?: boolean;
  waypoints?: Array<[number, number, number]>;
  moveSpeed?: number;
  dialogueLines?: string[];
  randomDialogues?: string[][];
  dialogueTree?: NpcDialogueNode[];
  initialDialogueNodeId?: string;
}

export type InteractableCategory =
  | 'Notice'
  | 'Citizen'
  | 'Commerce'
  | 'Infrastructure'
  | 'Landmark'
  | 'Item';

export type PickablePropKind =
  | 'mana-crystal'
  | 'brass-astrolabe'
  | 'cargo-seal'
  | 'dispatch-scroll'
  | 'copper-ingot'
  | 'herb-satchel';

export interface InteractableSpec {
  id: string;
  title: string;
  subtitle?: string;
  category: InteractableCategory;
  promptAction: string;
  lines: string[];
  position: [number, number, number];
  radius: number;
  npcId?: string;
  labelHeight?: number;
  pickable?: boolean;
  opensRailStationId?: string;
  opensCraftingStation?: CraftingStationKind;
  questInspectTrigger?: {
    questId: string;
    stageIndex: number;
    increment?: number;
  };
  dialogueTree?: NpcDialogueNode[];
  initialDialogueNodeId?: string;
}

export interface ActiveInteractPrompt {
  id: string;
  title: string;
  promptAction: string;
  category: InteractableCategory;
}

export interface FloatingInteractLabel {
  id: string;
  title: string;
  promptAction: string;
  category: InteractableCategory;
  pickable: boolean;
  isPrimary: boolean;
  screenX: number;
  screenY: number;
  opacity: number;
  distance: number;
}

export interface ActiveInspection {
  id: string;
  title: string;
  subtitle?: string;
  category: InteractableCategory;
  lines: string[];
  npcId?: string;
  choices?: NpcDialogueChoice[];
  npcReaction?: NpcReactionKind;
}

export interface CombatDummySpec {
  id: string;
  name: string;
  position: [number, number, number];
  facingYaw: number;
  maxHp?: number;
  armored?: boolean;
}

export interface FloatingCombatPopup {
  id: string;
  text: string;
  isCritical: boolean;
  screenX: number;
  screenY: number;
  opacity: number;
  scale: number;
}

export interface DummyStatusReadout {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  poise?: number;
  maxPoise?: number;
  staggered?: boolean;
  screenX: number;
  screenY: number;
  opacity: number;
}

export interface PlayerTelemetry {
  speed: number;
  verticalSpeed: number;
  grounded: boolean;
  crouched: boolean;
  sprinting: boolean;
  stamina: number;
  maxStamina: number;
  activeEmote: PlayerEmoteKind;
  locomotionState: LocomotionState;
  combatState: CombatState;
  comboCount: number;
  totalHits: number;
  lastDamageDealt: number;
  cameraMode: CameraMode;
  mapId: MapId;
  areaName: string;
  weatherState: WeatherState;
  weatherAutoCycle: boolean;
  npcCount: number;
  wildlifeCount: number;
  southGateOpen: boolean;
  crowns: number;
  collectedCount: number;
  totalPickables: number;
  recentPickupTitle: string | null;
  pointerLocked: boolean;
  fps: number;
  position: { x: number; y: number; z: number };
  yaw: number;
  cameraYaw: number;
  activePrompt: ActiveInteractPrompt | null;
  activeInspection: ActiveInspection | null;
  lifecycleState: GameLifecycleState;
  outcome: GameOutcome;
  rpg: RpgHudSnapshot;
  notification: ActiveWorldNotification | null;
}

export interface GreyboxWorldData {
  group: THREE.Group;
  boxColliders: BoxCollider[];
  rampColliders: RampCollider[];
  raycastTargets: THREE.Object3D[];
  spawnPoint: THREE.Vector3;
  worldBoundsRadius: number;
  worldBounds?: WorldBounds;
  defaultGroundY?: number;
  groundHeightAt?: (x: number, z: number) => number;
  npcSpawns?: NpcSpawnSpec[];
  interactables?: InteractableSpec[];
  combatDummies?: CombatDummySpec[];
  wildlifeCount?: number;
  unlockGate?: (gateId: string) => boolean;
  isGateOpen?: (gateId: string) => boolean;
  collectProp?: (id: string) => boolean;
  collectLoot?: (id: string) => LootPropSpec | null;
  getNearestStation?: (pos: THREE.Vector3) => CraftingStationKind;
  isCraftingTrigger?: (id: string) => CraftingStationKind | null;
  update?: (dt: number, playerPosition?: THREE.Vector3) => void;
  dispose: () => void;
}
