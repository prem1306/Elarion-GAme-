import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundManager } from './audio/SoundManager';
import { SpringArmCamera } from './camera/SpringArmCamera';
import { PlayerCharacter } from './characters/player/PlayerCharacter';
import { CombatSystem } from './combat/CombatSystem';
import { EnemyManager, type EnemyDropEvent, type EnemyPlayerHitEvent } from './combat/EnemyManager';
import {
  DEFAULT_MOVEMENT_CONFIG,
  type CameraMode,
  type CombatState,
  type DummyStatusReadout,
  type FloatingCombatPopup,
  type FloatingInteractLabel,
  type GreyboxWorldData,
  type MapId,
  type MovementConfig,
  type PlayerEmoteKind,
  type PlayerTelemetry,
  type WeatherState,
} from './core/types';
import { InputManager } from './input/InputManager';
import { InteractionManager } from './interaction/InteractionManager';
import { RecastNavSystem } from './navigation/RecastNavSystem';
import { NpcManager } from './npc/NpcManager';
import { JoltPhysicsWorld } from './physics/JoltPhysicsWorld';
import { ForgeRenderGraph } from './render/ForgeRenderGraph';
import {
  addItemToInventory,
  craftRecipe,
  equipItem,
  getItemCount,
  ITEMS,
  useConsumable,
} from './rpg/craftingData';
import { evaluateGasAttributes } from './rpg/gasAttributes';
import {
  applyMeleeCapacitorGain,
  awardXpAndLevelUp,
  isOverclocked,
  resolveExothermicVent,
  resolvePlayerDamageTaken,
  resolveSpellCast,
  SPELLS,
  stepRpgVitals,
} from './rpg/magicCombatRules';
import { advanceQuestProgress, createInitialQuests, QUEST_CATALOG } from './rpg/questData';
import type {
  ActiveWorldNotification,
  CraftingStationKind,
  GameLifecycleState,
  GameOutcome,
  RpgHudSnapshot,
  RpgPlayerState,
  SpellId,
} from './rpg/rpgTypes';
import { buildElarionDistrictBlock } from './world/ElarionDistrictBlock';
import { buildGreyboxTestMap } from './world/GreyboxTestMap';
import { ModelAssetCache } from './world/ModelAssetCache';
import { WeatherSystem } from './world/WeatherSystem';
import { WorldPartitionStreamer } from './world/WorldPartitionStreamer';

export const SAVE_STORAGE_KEY = 'aincendra_elarion_save_v1';

export function createInitialRpgState(): RpgPlayerState {
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
    crowns: 48,
    equippedWeaponId: 'vaelcrest_sabre',
    equippedArmorId: 'harbour_coat',
    equippedRelicId: null,
    inventory: [
      { itemId: 'vaelcrest_sabre', qty: 1 },
      { itemId: 'harbour_coat', qty: 1 },
      { itemId: 'mana_shard', qty: 2 },
      { itemId: 'copper_ingot', qty: 2 },
      { itemId: 'iron_ore', qty: 1 },
      { itemId: 'aether_herb', qty: 2 },
      { itemId: 'vitality_elixir', qty: 2 },
      { itemId: 'aether_draught', qty: 1 },
    ],
    quests: createInitialQuests(),
    trackedQuestId: 'q_gate_conduit',
    factionRep: { vaelcrest: 15, manaworks: 10, purists: 10 },
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

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class AincendraEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly springArm: SpringArmCamera;
  private readonly player: PlayerCharacter;
  private readonly input: InputManager;
  private readonly npcManager: NpcManager;
  private readonly interactionManager: InteractionManager;
  private readonly modelCache: ModelAssetCache;
  private readonly enemyManager: EnemyManager;
  public readonly sound = new SoundManager();

  private world: GreyboxWorldData;
  private currentMapId: MapId = 'elarion-district';
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly weatherSystem: WeatherSystem;
  private readonly worldStreamer: WorldPartitionStreamer;
  private readonly combatSystem: CombatSystem;
  private readonly joltWorld: JoltPhysicsWorld;
  private readonly navSystem: RecastNavSystem;
  private readonly renderGraph: ForgeRenderGraph;
  private readonly envTexture: THREE.Texture;
  private readonly isSoftwareGl: boolean;
  private readonly clock = new THREE.Clock();

  private readonly onTelemetry: (t: PlayerTelemetry) => void;
  private readonly onContextLostCallback?: (lost: boolean) => void;
  private readonly onFloatingLabels?: (labels: FloatingInteractLabel[]) => void;
  private readonly onCombatOverlay?: (payload: {
    popups: FloatingCombatPopup[];
    dummies: DummyStatusReadout[];
  }) => void;
  private readonly onOpenRailNetwork?: (stationId: string) => void;
  private readonly onOpenCraftingStation?: (station: CraftingStationKind) => void;

  private frameId = 0;
  private disposed = false;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private telemetryTimer = 0;
  private lastCombatState: CombatState = 'Ready';
  private lastCollectedAwarded = 0;

  private lifecycleState: GameLifecycleState = 'title';
  private outcome: GameOutcome = 'none';
  private defeatBeatTimer = 0;
  private hitstopTimer = 0;
  private tourAngle = 0;
  private modalOpen = false;
  private rpg: RpgPlayerState = createInitialRpgState();

  private activeNotification: ActiveWorldNotification | null = null;
  private notificationTimer = 0;
  private notifSeq = 0;

  constructor(
    container: HTMLElement,
    onTelemetry: (t: PlayerTelemetry) => void,
    onContextLost?: (lost: boolean) => void,
    onFloatingLabels?: (labels: FloatingInteractLabel[]) => void,
    onCombatOverlay?: (payload: {
      popups: FloatingCombatPopup[];
      dummies: DummyStatusReadout[];
    }) => void,
    onOpenRailNetwork?: (stationId: string) => void,
    onOpenCraftingStation?: (station: CraftingStationKind) => void,
    autostart = false
  ) {
    this.container = container;
    this.onTelemetry = onTelemetry;
    this.onContextLostCallback = onContextLost;
    this.onFloatingLabels = onFloatingLabels;
    this.onCombatOverlay = onCombatOverlay;
    this.onOpenRailNetwork = onOpenRailNetwork;
    this.onOpenCraftingStation = onOpenCraftingStation;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.modelCache = new ModelAssetCache();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x9ec4dc);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xaac7dc, 0.00068);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0xe4eff8, 0x454c54, 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d8, 2.05);
    this.sunLight.position.set(28, 42, 22);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 128;
    const d = 46;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x88b4d8, 0.45);
    this.rimLight.position.set(-24, 16, -28);
    this.scene.add(this.rimLight);

    this.weatherSystem = new WeatherSystem();
    this.scene.add(this.weatherSystem.group);

    this.npcManager = new NpcManager();
    this.scene.add(this.npcManager.group);
    this.interactionManager = new InteractionManager();
    this.combatSystem = new CombatSystem();
    this.scene.add(this.combatSystem.group);
    this.enemyManager = new EnemyManager(this.modelCache);
    this.scene.add(this.enemyManager.group);
    this.joltWorld = new JoltPhysicsWorld();
    this.scene.add(this.joltWorld.group);
    this.navSystem = new RecastNavSystem();
    this.worldStreamer = new WorldPartitionStreamer(this.scene);

    this.world = this.buildWorld(this.currentMapId);
    this.scene.add(this.world.group);
    this.setupWorldEntities();

    this.player = new PlayerCharacter(DEFAULT_MOVEMENT_CONFIG, this.world.spawnPoint);
    this.scene.add(this.player.root);

    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.springArm = new SpringArmCamera(aspect, DEFAULT_MOVEMENT_CONFIG);
    this.springArm.camera.add(this.combatSystem.fpWeaponRoot);
    this.scene.add(this.springArm.camera);
    this.renderGraph = new ForgeRenderGraph(
      this.renderer,
      this.scene,
      this.springArm.camera,
      this.isSoftwareGl
    );

    this.input = new InputManager(
      canvas,
      () => {
        this.emitTelemetry();
      },
      () => this.interactionManager.hasOpenDialogueChoices()
    );

    if (autostart) {
      this.setLifecycleState('playing');
    } else {
      this.setLifecycleState('title');
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.springArm.camera);
    }

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleResize);

    this.emitTelemetry();
    this.clock.start();
    this.tick();
  }

  private setupWorldEntities(): void {
    if (this.world.npcSpawns) {
      this.npcManager.spawnFromSpecs(this.world.npcSpawns);
    }
    this.interactionManager.setTargets(
      this.world.interactables,
      this.world.npcSpawns,
      (id: string) => this.handleWorldPropCollect(id)
    );
    this.interactionManager.setRailOpenHandler((stationId) => {
      this.releasePointerLock();
      this.onOpenRailNetwork?.(stationId);
    });
    this.interactionManager.setCraftingOpenHandler((station) => {
      this.releasePointerLock();
      this.onOpenCraftingStation?.(station);
    });
    this.interactionManager.setQuestInspectHandler((trig) => {
      this.handleQuestStageAdvance(trig.questId, trig.stageIndex, trig.increment ?? 1);
    });
    this.combatSystem.setDummies(this.world.combatDummies, this.world.boxColliders);
    if (this.currentMapId === 'elarion-district') {
      this.enemyManager.spawnElarionEnemies(this.world.groundHeightAt);
    } else {
      this.enemyManager.clear();
    }
    this.worldStreamer.indexWorldGroup(this.world.group);
    this.worldStreamer.update(0.016, this.world.spawnPoint);

    if (this.joltWorld.isReady()) {
      this.joltWorld.rebuildBodies(this.world.boxColliders, this.world.groundHeightAt);
    } else {
      void this.joltWorld.initializeForWorld(this.world.boxColliders, this.world.groundHeightAt);
    }
    void this.navSystem.buildFromColliders(this.world.boxColliders);
  }

  private handleWorldPropCollect(id: string): boolean {
    const loot = this.world.collectLoot?.(id);
    if (loot) {
      let next = { ...this.rpg, crowns: this.rpg.crowns + loot.crowns, gatheringNodesLooted: this.rpg.gatheringNodesLooted + 1 };
      for (const item of loot.lootItems) {
        next = { ...next, inventory: addItemToInventory(next.inventory, item.itemId, item.qty) };
      }
      this.rpg = next;
      const itemLabels = loot.lootItems
        .map((it) => `${it.qty}× ${ITEMS[it.itemId]?.name ?? it.itemId}`)
        .join(', ');
      this.pushNotification(loot.title, `+${loot.crowns} Cr · ${itemLabels}`, 'loot');
      this.sound.playPickup();

      // Advance mana shard stage in quest if applicable
      const manaGain = loot.lootItems.find((x) => x.itemId === 'mana_shard')?.qty ?? 0;
      if (manaGain > 0) {
        this.handleQuestStageAdvance('q_gate_conduit', 0, manaGain);
      }
      this.emitTelemetry();
      return true;
    }

    const collected = this.world.collectProp ? this.world.collectProp(id) : true;
    if (collected) {
      this.sound.playPickup();
      this.handleQuestStageAdvance('q_council_conspiracy', 0, 1);
    }
    return collected;
  }

  private pushNotification(
    title: string,
    detail: string,
    tone: ActiveWorldNotification['tone']
  ): void {
    this.notifSeq += 1;
    this.activeNotification = { id: `notif_${this.notifSeq}`, title, detail, tone };
    this.notificationTimer = 4.2;
    this.emitTelemetry();
  }

  private handleQuestStageAdvance(
    questId: string,
    stageIdx: number,
    increment = 1,
    branch?: { label: string; faction: 'vaelcrest' | 'manaworks' | 'purists'; repDelta: number }
  ): void {
    const prevLevel = this.rpg.level;
    const res = advanceQuestProgress(this.rpg, questId, stageIdx, increment, branch);
    this.rpg = res.state;
    const def = QUEST_CATALOG[questId];
    if (res.completedNow && def) {
      this.sound.playQuestAdvance(true);
      this.pushNotification(`Quest Completed: ${def.title}`, `+${def.rewardCrowns} Cr · +${def.rewardXp} XP`, 'quest');
    } else if (res.stageAdvanced && def) {
      this.sound.playQuestAdvance(false);
      const stageDesc = def.stages[this.rpg.quests[questId].stageIndex]?.description ?? 'Objective updated';
      this.pushNotification(`Quest Updated: ${def.title}`, stageDesc, 'quest');
    }
    if (this.rpg.level > prevLevel) {
      this.pushNotification(`Level ${this.rpg.level} Reached!`, 'HP & Mana restored · +3 Power', 'level');
    }
  }

  private setLifecycleState(next: GameLifecycleState): void {
    this.lifecycleState = next;
    document.body.dataset.state = next;
    const gameplayInputActive = next === 'playing' && !this.modalOpen;
    this.input.setEnabled(gameplayInputActive);
    if (next !== 'playing') {
      this.releasePointerLock();
    }
  }

  public setModalOpen(open: boolean): void {
    this.modalOpen = open;
    this.input.setEnabled(this.lifecycleState === 'playing' && !open);
    if (open) {
      this.releasePointerLock();
    }
  }

  public startGame(): void {
    this.outcome = 'none';
    this.defeatBeatTimer = 0;
    this.springArm.resetOrientation(this.player.position);
    this.setLifecycleState('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.emitTelemetry();
  }

  public startNewGame(): void {
    this.rpg = createInitialRpgState();
    this.outcome = 'none';
    this.defeatBeatTimer = 0;
    this.lastCollectedAwarded = 0;
    this.interactionManager.closeInspection();
    this.player.reset(this.world.spawnPoint);
    this.springArm.resetOrientation(this.world.spawnPoint);
    this.enemyManager.resetAll();
    this.setLifecycleState('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.emitTelemetry();
  }

  public continueExploringAfterVictory(): void {
    if (this.lifecycleState === 'gameover' && this.outcome === 'victory') {
      this.outcome = 'none';
      this.setLifecycleState('playing');
      this.emitTelemetry();
    }
  }

  public togglePause(): void {
    if (this.lifecycleState === 'playing') {
      this.setLifecycleState('paused');
      this.emitTelemetry();
    } else if (this.lifecycleState === 'paused') {
      this.setLifecycleState('playing');
      this.emitTelemetry();
    }
  }

  public returnToTitle(): void {
    this.releasePointerLock();
    this.setLifecycleState('title');
    this.emitTelemetry();
  }

  public saveToStorage(): boolean {
    try {
      const payload = {
        rpg: this.rpg,
        position: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
        },
        southGateOpen: this.world.isGateOpen?.('south_bastion_gate') ?? false,
        mapId: this.currentMapId,
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
      this.pushNotification('Journey Saved', 'Progress written to local Chronicle.', 'quest');
      return true;
    } catch {
      return false;
    }
  }

  public loadFromStorage(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        rpg?: RpgPlayerState;
        position?: { x: number; y: number; z: number };
        southGateOpen?: boolean;
      };
      if (!parsed.rpg) return false;
      this.rpg = parsed.rpg;
      if (parsed.southGateOpen) {
        this.world.unlockGate?.('south_bastion_gate');
      }
      if (parsed.position) {
        const dest = new THREE.Vector3(parsed.position.x, parsed.position.y, parsed.position.z);
        this.player.reset(dest);
        this.springArm.resetOrientation(dest);
      }
      this.outcome = 'none';
      this.setLifecycleState('playing');
      this.pushNotification('Chronicle Restored', `Level ${this.rpg.level} · ${this.rpg.crowns} Crowns`, 'quest');
      this.emitTelemetry();
      return true;
    } catch {
      return false;
    }
  }

  public castSpell(spellId: SpellId): void {
    if (this.lifecycleState !== 'playing') return;
    const preGas = evaluateGasAttributes(this.rpg, this.weatherSystem.state);
    const res = resolveSpellCast(this.rpg, spellId);
    if (!res.ok) {
      if (res.reason) this.pushNotification(SPELLS[spellId].name, res.reason, 'combat');
      return;
    }
    this.rpg = res.state;
    this.sound.playSpellCast(SPELLS[spellId].school);

    const stormMult = preGas.activeTags.includes('Env.StormConductive') ? 1.2 : 1.0;
    const overdriveMult = preGas.activeTags.includes('Buff.Overdrive') ? 1.3 : 1.0;
    const spellDmg = Math.round(res.damage * stormMult * overdriveMult);

    const bounceColor =
      spellId === 'pyre_nova'
        ? 0xf97316
        : spellId === 'chrono_ward'
          ? 0xa78bfa
          : spellId === 'ley_lance'
            ? 0x34d399
            : 0x6ee3f5;
    this.worldStreamer.triggerSpellBounce(this.player.position, bounceColor, spellId === 'pyre_nova' ? 5.0 : 4.2);

    const nearest = this.enemyManager.findNearestTargetPosition(
      this.player.position,
      SPELLS[spellId].range ?? 24
    );
    const castYaw = nearest
      ? Math.atan2(nearest.x - this.player.position.x, nearest.z - this.player.position.z)
      : Math.atan2(-Math.sin(this.springArm.yaw), -Math.cos(this.springArm.yaw));

    this.player.triggerSpellCastPose(castYaw);
    this.combatSystem.spawnSpellVisual(spellId, this.player.position, nearest, castYaw);

    const drops: EnemyDropEvent[] = [];
    let stanceBroken = false;
    if (spellId === 'pyre_nova') {
      this.joltWorld.applyRadialImpulse(this.player.position, 7.2, 145);
      const burst = this.enemyManager.applyAreaBurst(
        this.player.position,
        5.8,
        spellDmg,
        Math.round(44 * preGas.poiseDamageMult),
        res.overclocked ? 'OVERCLOCK!' : 'PYRE',
        0,
        drops
      );
      stanceBroken = burst.stanceBroken;
      if (burst.hits > 0) {
        this.hitstopTimer = 0.045;
        this.springArm.triggerCombatImpulse(0.16);
      }
    } else if (spellId === 'chrono_ward') {
      this.enemyManager.applyAreaBurst(this.player.position, 4.6, 0, 0, 'CHILL', 4.5, drops);
    } else if (spellId === 'arc_bolt' || spellId === 'ley_lance') {
      const target =
        nearest ??
        this.player.position.clone().add(new THREE.Vector3(Math.sin(castYaw) * 10, 1, Math.cos(castYaw) * 10));
      this.joltWorld.applyRadialImpulse(target, 4.5, spellId === 'ley_lance' ? 115 : 85);
      const dx = target.x - this.player.position.x;
      const dz = target.z - this.player.position.z;
      const d = Math.max(0.01, Math.hypot(dx, dz));
      const basePoiseDmg = spellId === 'ley_lance' ? 38 : res.usedCapacitor ? 34 : 22;
      const hitRes = this.enemyManager.applyPointHit(
        new THREE.Vector3(target.x, target.y + 1.0, target.z),
        2.2,
        spellDmg,
        Math.round(basePoiseDmg * preGas.poiseDamageMult),
        dx / d,
        dz / d,
        res.usedCapacitor ? `-${spellDmg} SURGE!` : `-${spellDmg}`,
        true,
        drops
      );
      stanceBroken = hitRes.stanceBroken;
      if (hitRes.hit) {
        this.hitstopTimer = 0.04;
        this.springArm.triggerCombatImpulse(0.11);
        if (spellId === 'ley_lance') {
          this.rpg = { ...this.rpg, hp: Math.min(this.rpg.maxHp, this.rpg.hp + 18) };
        }
      }
    }

    if (stanceBroken) {
      this.sound.playStanceBreak();
      this.pushNotification('Stance Broken!', 'Strike now for a Critical Riposte!', 'combat');
    } else if (res.triggeredBurnout) {
      this.pushNotification('Core Burnout!', 'Press [G] Exothermic Vent to dump heat!', 'combat');
    }
    this.processEnemyDrops(drops);
    this.emitTelemetry();
  }

  public triggerVent(): void {
    if (this.lifecycleState !== 'playing') return;
    const preGas = evaluateGasAttributes(this.rpg, this.weatherSystem.state);
    const res = resolveExothermicVent(this.rpg);
    if (!res.ok) {
      if (res.reason) this.pushNotification('Exothermic Vent', res.reason, 'combat');
      return;
    }
    this.rpg = res.state;
    this.sound.playVentBlast();
    this.worldStreamer.triggerSpellBounce(this.player.position, 0x38bdf8, 5.2);
    this.player.triggerSpellCastPose();
    this.combatSystem.spawnSpellVisual('vent', this.player.position);
    this.joltWorld.applyRadialImpulse(this.player.position, 8.5, 165);
    const drops: EnemyDropEvent[] = [];
    const ventRes = this.enemyManager.applyAreaBurst(
      this.player.position,
      6.5,
      res.damage,
      Math.round(48 * preGas.poiseDamageMult),
      'VENT!',
      2.0,
      drops
    );
    if (ventRes.hits > 0) {
      this.hitstopTimer = 0.055;
      this.springArm.triggerCombatImpulse(0.18);
    }
    if (ventRes.stanceBroken) {
      this.sound.playStanceBreak();
      this.pushNotification('Stance Broken!', 'Strike now for a Critical Riposte!', 'combat');
    }
    this.processEnemyDrops(drops);
    this.emitTelemetry();
  }

  public useInventoryItem(itemId: string): boolean {
    const res = useConsumable(this.rpg, itemId);
    if (!res.used) return false;
    this.rpg = res.state;
    this.sound.playPickup();
    const def = ITEMS[itemId];
    this.pushNotification(`Used ${def?.name ?? itemId}`, def?.description ?? '', 'craft');
    this.emitTelemetry();
    return true;
  }

  public equipInventoryItem(itemId: string): void {
    this.rpg = equipItem(this.rpg, itemId);
    this.sound.playPickup();
    this.emitTelemetry();
  }

  public craftItem(recipeId: string): { crafted: boolean; reason?: string } {
    const station = this.getActiveCraftingStation();
    const res = craftRecipe(this.rpg, recipeId, station);
    if (!res.crafted) {
      return { crafted: false, reason: res.reason };
    }
    this.rpg = res.state;
    this.sound.playCraftSuccess();
    this.pushNotification('Crafted Item', `Success at ${station.toUpperCase()} station.`, 'craft');

    if (recipeId === 'rcp_crystal_core') {
      this.handleQuestStageAdvance('q_gate_conduit', 1, 1);
    }
    if (recipeId === 'rcp_volt_edge_sabre' || recipeId === 'rcp_copper_brigandine' || recipeId === 'rcp_aether_reaver') {
      this.handleQuestStageAdvance('q_smelting_ashes', 1, 1);
    }
    this.emitTelemetry();
    return { crafted: true };
  }

  public trackQuest(questId: string): void {
    if (this.rpg.quests[questId]) {
      this.rpg = { ...this.rpg, trackedQuestId: questId };
      this.emitTelemetry();
    }
  }

  public getActiveCraftingStation(): CraftingStationKind {
    return this.world.getNearestStation?.(this.player.position) ?? 'field';
  }

  private processEnemyDrops(drops: EnemyDropEvent[]): void {
    if (drops.length === 0) return;
    let victoryTriggered = false;
    for (const drop of drops) {
      const prevLvl = this.rpg.level;
      let next = {
        ...this.rpg,
        inventory: addItemToInventory(this.rpg.inventory, drop.lootItemId, drop.lootQty),
        enemiesDefeated: this.rpg.enemiesDefeated + 1,
        bossesDefeated: this.rpg.bossesDefeated + (drop.isBoss ? 1 : 0),
      };
      const xpRes = awardXpAndLevelUp(next, drop.xp, drop.crowns);
      this.rpg = xpRes.state;
      this.sound.playHitImpact(true);

      const lootName = ITEMS[drop.lootItemId]?.name ?? drop.lootItemId;
      this.pushNotification(
        `${drop.name} Defeated`,
        `+${drop.xp} XP · +${drop.crowns} Cr · ${drop.lootQty}× ${lootName}`,
        'combat'
      );

      if (this.rpg.level > prevLvl) {
        this.sound.playQuestAdvance(true);
        this.pushNotification(`Level ${this.rpg.level} Reached!`, 'Vitals restored · +3 Attack & Spell Power', 'level');
      }

      if (drop.archetype === 'sentinel' || drop.archetype === 'furnace-golem') {
        this.handleQuestStageAdvance('q_smelting_ashes', 0, 1);
      }
      if (drop.isWilds && !drop.isBoss) {
        this.handleQuestStageAdvance('q_emerald_shadows', 0, 1);
      }
      if (drop.isBoss) {
        this.handleQuestStageAdvance('q_emerald_shadows', 0, 3);
        this.handleQuestStageAdvance('q_emerald_shadows', 1, 1);
        victoryTriggered = true;
      }
    }
    if (victoryTriggered) {
      this.outcome = 'victory';
      this.setLifecycleState('gameover');
    }
  }

  private buildWorld(mapId: MapId): GreyboxWorldData {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    return mapId === 'elarion-district'
      ? buildElarionDistrictBlock(maxAniso, this.modelCache)
      : buildGreyboxTestMap(maxAniso);
  }

  public setMap(mapId: MapId): void {
    if (mapId === this.currentMapId) return;
    this.scene.remove(this.world.group);
    this.world.dispose();
    this.npcManager.clear();
    this.interactionManager.clear();

    this.currentMapId = mapId;
    this.world = this.buildWorld(mapId);
    this.scene.add(this.world.group);
    this.setupWorldEntities();

    this.player.reset(this.world.spawnPoint);
    this.springArm.resetOrientation(this.world.spawnPoint);
    this.emitTelemetry();
  }

  public closeInspection(): void {
    this.interactionManager.closeInspection();
    this.emitTelemetry();
  }

  public triggerInteract(): void {
    this.interactionManager.triggerInteract();
    this.emitTelemetry();
  }

  public selectDialogueChoice(index: number): void {
    this.interactionManager.selectChoice(
      index,
      (gateId) => {
        const unlocked = this.world.unlockGate?.(gateId) ?? false;
        if (unlocked) {
          this.sound.playQuestAdvance();
          this.emitTelemetry();
        }
        return unlocked;
      },
      (emote) => {
        this.player.triggerEmote(emote);
        this.npcManager.notifyPlayerEmote(this.player.position, emote);
      },
      (branch) => {
        this.handleQuestStageAdvance(branch.questId, branch.stageIndex, 1, {
          label: branch.label,
          faction: branch.faction,
          repDelta: branch.repDelta,
        });
      }
    );
    this.emitTelemetry();
  }

  public triggerEmote(emote: PlayerEmoteKind): void {
    this.player.triggerEmote(emote);
    this.npcManager.notifyPlayerEmote(this.player.position, emote);
    this.emitTelemetry();
  }

  public spendCrowns(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.rpg.crowns < amount) return false;
    this.rpg = { ...this.rpg, crowns: this.rpg.crowns - amount };
    this.emitTelemetry();
    return true;
  }

  public releasePointerLock(): void {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      this.input.clearAll();
    } catch {
      // Safe fallback
    }
  }

  public requestPointerLock(): void {
    if (this.lifecycleState === 'playing' && !this.modalOpen) {
      this.input.requestPointerLock();
    }
  }

  public updateMovementConfig(partial: Partial<MovementConfig>): void {
    this.player.updateConfig(partial);
    this.springArm.updateConfig(partial);
  }

  public setCameraMode(mode: CameraMode): void {
    this.springArm.setMode(mode);
    this.player.setMeshVisible(mode === 'third-person');
    this.emitTelemetry();
  }

  public setWeatherMode(mode: WeatherState | 'auto'): void {
    this.weatherSystem.setWeatherMode(mode);
    this.emitTelemetry();
  }

  public cycleWeather(): void {
    this.weatherSystem.cycleNext();
    this.emitTelemetry();
  }

  public resetPlayer(): void {
    this.interactionManager.closeInspection();
    this.player.reset(this.world.spawnPoint);
    this.springArm.resetOrientation(this.world.spawnPoint);
    this.emitTelemetry();
  }

  public teleportTo(x: number, y: number, z: number): void {
    this.interactionManager.closeInspection();
    const dest = new THREE.Vector3(x, y, z);
    this.player.reset(dest);
    this.springArm.resetOrientation(dest);
    this.emitTelemetry();
  }

  private readonly handleResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.springArm.setAspect(w / h);
    this.renderer.setSize(w, h);
  };

  private readonly handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextLostCallback?.(true);
  };

  private readonly handleContextRestored = (): void => {
    this.onContextLostCallback?.(false);
  };

  private resolveAreaName(): string {
    if (this.currentMapId === 'greybox') return 'Proving Yard';
    const { x, z } = this.player.position;
    if (z > 335.0) {
      if (Math.hypot(x + 88, z - 468) < 42 || Math.hypot(x - 94, z - 522) < 44) {
        return 'Vaelcrest Wilds · Emerald Glade Pond';
      }
      if (Math.abs(x - Math.sin((z - 336) * 0.011) * 16) < 16) {
        return 'Vaelcrest Domain · Woodland Highway';
      }
      return 'Vaelcrest Domain · Emerald Wilds';
    }
    if (x < -290.0) return 'Vaelcrest Wilds · West Meadow Woods';
    if (x > 308.0) return 'Vaelcrest Wilds · East Highland Woods';
    if (z >= 120.0 && z <= 154.0) {
      if (Math.abs(x) < 12.0) return 'Grand Canal · Central Bridge';
      if (x < -120.0) return 'Grand Canal · West Bridge';
      if (x > 90.0) return 'Grand Canal · East Bridge';
      return 'Grand Canal Shipping Locks';
    }
    if (z > 154.0 && z <= 166.5) return 'South Canal Promenade';
    if (z > 318.0) return 'Domain Overland Bastion Gate';
    if (z > 166.5) {
      if (x > 175.0) return 'East Residential Estates';
      if (Math.abs(x) < 28.0 && Math.abs(z - 212.0) < 28.0) return 'Grand Exchange Square';
      if (x < -28.0 && z > 228.0) return 'Residential Quarter · Civic School';
      if (x > 28.0 && z > 228.0) return 'Merchant Quarter · Reserve Bank';
      return 'Merchant Quarter';
    }
    if (x < -132.0) {
      if (z < 14.5) return 'Temple Quarter Sanctuary';
      if (z < 76.0) return 'Industrial Quarter · Mana Works';
      return 'Mana-Rail Freight Yard';
    }
    if (x > 135.5) {
      if (z > 88.0) return 'Citadel Landing';
      if (x > 215.0) return 'Three-Council Assembly Hall';
      if (z < 12.0) return 'Noble Palace Gardens';
      return 'Coastal Railgun Citadel';
    }
    if (z < -62.5) {
      if (x < -14.0) return 'West Cargo Pier';
      if (x <= 11.5) return 'Central Shipyard Pier';
      return 'East Cargo Pier';
    }
    if (z < -26.2) return 'Grand Harbour Quay';
    if (z < -21.8 && Math.abs(x) <= 9.8) return 'Harbour Overlook';
    if (x >= -86.0 && x <= -64.0 && z >= -3.0 && z <= 11.0) return 'Smelting Hall';
    if (x >= -62.0 && x <= -44.0 && z >= 25.0 && z <= 36.0) return 'West Forge & Assay';
    if (x < -94.0 && z < 15.0) return 'Boiler Works Yard';
    if (x < -42.0 && z < 15.0) return 'West Refinery Yard';
    if (x < -38.0 && z >= 12.5 && z <= 25.0) return 'Refinery Avenue';
    if (x < -42.0) return 'Industrial Quarter';
    if (x >= 81.5 && z <= 58.0) return 'Noble Heights Plaza';
    if (x > 50.0 && z < 3.5) return 'Aetheric Conservatory';
    if (x > 50.0 && z > 63.0) return 'Cartography Wing';
    if (x > 50.0) return 'Academic Courtyard';
    if (x > 38.0 && z >= 12.0 && z <= 25.0) return 'Academic Concourse';
    if (z > 83.5) return 'South Merchant Promenade';
    if (z > 51.5) return 'Merchant Guild Plaza';
    if (z > 38.5) return 'Overland Gate Approach';
    if (x < -17.0 && z < 13.0) return 'Worker Courtyard';
    if (x > 16.5 && z < 13.0) return 'Copperwell Square';
    if (x >= -17.0 && x <= -9.5 && z >= 4.0 && z <= 12.5) return 'Vaelcrest Chandlery';
    if (x >= 9.5 && x <= 17.0 && z >= -6.5 && z <= 2.5) return 'Salt & Brass Tavern';
    if (z >= 12.5 && z <= 24.5 && Math.abs(x) > 6.0) return 'Foundry Row';
    return 'Harbourgate Lane';
  }

  private buildRpgHudSnapshot(): RpgHudSnapshot {
    const gas = evaluateGasAttributes(this.rpg, this.weatherSystem.state);
    return {
      hp: Math.round(this.rpg.hp),
      maxHp: this.rpg.maxHp,
      mana: Math.round(this.rpg.mana),
      maxMana: this.rpg.maxMana,
      thermalHeat: Math.round(this.rpg.thermalHeat),
      burnoutActive: this.rpg.burnoutTimer > 0,
      overclocked: isOverclocked(this.rpg),
      stormConductive: gas.activeTags.includes('Env.StormConductive'),
      capacitorCharge: Math.round(this.rpg.capacitorCharge),
      level: this.rpg.level,
      xp: this.rpg.xp,
      xpToNext: this.rpg.xpToNext,
      crowns: this.rpg.crowns,
      attackPower: gas.attackPower,
      spellPower: gas.spellPower,
      armorRating: gas.armor,
      equippedWeaponName: ITEMS[this.rpg.equippedWeaponId]?.name ?? 'Training Sabre',
      equippedArmorName: ITEMS[this.rpg.equippedArmorId]?.name ?? 'Mariner Greatcoat',
      equippedRelicName: this.rpg.equippedRelicId ? ITEMS[this.rpg.equippedRelicId]?.name ?? null : null,
      spellCooldowns: { ...this.rpg.spellCooldowns },
      ventCooldown: this.rpg.ventCooldown,
      activeWardTimer: this.rpg.activeWardTimer,
      overdriveTimer: this.rpg.overdriveTimer,
      inventory: this.rpg.inventory,
      quests: this.rpg.quests,
      trackedQuestId: this.rpg.trackedQuestId,
      factionRep: this.rpg.factionRep,
      enemiesDefeated: this.rpg.enemiesDefeated,
      bossesDefeated: this.rpg.bossesDefeated,
      itemsCrafted: this.rpg.itemsCrafted,
      elixirCount: getItemCount(this.rpg.inventory, 'vitality_elixir'),
      draughtCount: getItemCount(this.rpg.inventory, 'aether_draught'),
      nearestStation: this.getActiveCraftingStation(),
      nearbyEnemyCount: this.enemyManager.getNearbyEnemyCount(this.player.position),
      activeBoss: this.enemyManager.getBossHudInfo(this.player.position),
    };
  }

  private emitTelemetry(): void {
    const horizSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    this.onTelemetry({
      speed: horizSpeed,
      verticalSpeed: this.player.velocity.y,
      grounded: this.player.grounded,
      crouched: this.player.crouched,
      sprinting: this.player.sprinting,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      activeEmote: this.player.activeEmote,
      locomotionState: this.player.getLocomotionState(),
      combatState: this.player.getCombatState(),
      comboCount: this.combatSystem.getComboCount(),
      totalHits: this.combatSystem.getTotalHits(),
      lastDamageDealt: this.combatSystem.getLastDamageDealt(),
      cameraMode: this.springArm.mode,
      mapId: this.currentMapId,
      areaName: this.resolveAreaName(),
      weatherState: this.weatherSystem.state,
      weatherAutoCycle: this.weatherSystem.isAutoCycling,
      npcCount: this.npcManager.count,
      wildlifeCount: this.world.wildlifeCount ?? 0,
      southGateOpen: this.world.isGateOpen?.('south_bastion_gate') ?? false,
      crowns: this.rpg.crowns,
      collectedCount: this.interactionManager.getCollectedCount(),
      totalPickables: this.interactionManager.getTotalPickables(),
      recentPickupTitle: this.interactionManager.getRecentPickupTitle(),
      pointerLocked: this.input.pointerLocked,
      fps: this.currentFps,
      position: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      },
      yaw: this.player.yaw,
      cameraYaw: this.springArm.yaw,
      activePrompt: this.interactionManager.getActivePrompt(),
      activeInspection: this.interactionManager.getActiveInspection(),
      lifecycleState: this.lifecycleState,
      outcome: this.outcome,
      rpg: this.buildRpgHudSnapshot(),
      notification: this.activeNotification,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.ALREADY_SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private readonly tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.fpsAccum += rawDt;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.4) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) {
        this.activeNotification = null;
        this.emitTelemetry();
      }
    }

    if (this.lifecycleState === 'title') {
      // Live World Camera Tour Spline over Elarion Harbour & Harbourgate
      this.tourAngle += dt * 0.14;
      const radius = 34;
      const camX = Math.sin(this.tourAngle) * radius;
      const camZ = 4 + Math.cos(this.tourAngle) * 26;
      this.springArm.camera.position.set(camX, 13.5 + Math.sin(this.tourAngle * 2) * 1.8, camZ);
      this.springArm.camera.lookAt(0, 3.2, 6);
      this.npcManager.update(dt, this.player.position);
      this.world.update?.(dt, this.player.position);
      this.worldStreamer.update(dt, this.player.position);
      this.renderGraph.executeFrame();
      this.scheduleNextFrame();
      return;
    }

    if (this.lifecycleState === 'paused' || this.lifecycleState === 'gameover') {
      this.renderGraph.executeFrame();
      this.scheduleNextFrame();
      return;
    }

    // Playing State: Hitstop check (simulation pauses briefly while camera/visuals stay responsive)
    let simDt = dt;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      simDt = 0;
    }

    if (this.defeatBeatTimer > 0) {
      this.defeatBeatTimer -= dt;
      if (this.defeatBeatTimer <= 0) {
        this.outcome = 'defeat';
        this.setLifecycleState('gameover');
        this.emitTelemetry();
        this.renderGraph.executeFrame();
        this.scheduleNextFrame();
        return;
      }
    }

    const inputSnap = this.input.sample();

    if (simDt > 0 && this.defeatBeatTimer <= 0) {
      this.rpg = stepRpgVitals(this.rpg, simDt);

      if (inputSnap.spellPressed) {
        this.castSpell(inputSnap.spellPressed);
      }
      if (inputSnap.ventPressed) {
        this.triggerVent();
      }
      if (inputSnap.healPressed) {
        this.useInventoryItem('vitality_elixir');
      }
      if (inputSnap.manaPotionPressed) {
        this.useInventoryItem('aether_draught');
      }

      if (inputSnap.attackPressed || inputSnap.heavyAttackPressed) {
        this.sound.playSwordSwing(inputSnap.heavyAttackPressed);
        this.joltWorld.applyRadialImpulse(
          this.player.position,
          inputSnap.heavyAttackPressed ? 4.8 : 3.6,
          inputSnap.heavyAttackPressed ? 115 : 65
        );
      }

      this.player.update(
        simDt,
        inputSnap,
        this.springArm.yaw,
        this.world.boxColliders,
        this.world.rampColliders,
        this.world.worldBoundsRadius,
        this.world.worldBounds,
        this.world.defaultGroundY ?? 0,
        this.world.groundHeightAt,
        {
          onFireSidearm: (origin, dir) => {
            this.combatSystem.spawnSidearmBolt(origin, dir);
            this.sound.playSidearmShot();
          },
          onPlayerEmote: (emote) => {
            this.npcManager.notifyPlayerEmote(this.player.position, emote);
          },
          onFootstep: (sprinting) => {
            this.sound.playFootstep(sprinting);
          },
        }
      );

      const gas = evaluateGasAttributes(this.rpg, this.weatherSystem.state);
      const drops: EnemyDropEvent[] = [];
      const horizSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
      const meleeOutcome = this.combatSystem.update(
        simDt,
        this.player.position,
        horizSpeed,
        this.springArm.mode,
        this.player.getSwingSnapshot(),
        (critical, hitEnemy) => {
          this.springArm.triggerCombatImpulse(critical ? 0.14 : 0.08);
          this.sound.playHitImpact(critical);
          if (hitEnemy) {
            this.hitstopTimer = critical ? 0.05 : 0.032;
          }
        },
        this.enemyManager,
        gas.attackPower - 22,
        this.rpg.activeWardTimer > 0,
        drops,
        gas.spellPower,
        gas.poiseDamageMult
      );

      if (meleeOutcome.hits > 0) {
        this.rpg = applyMeleeCapacitorGain(this.rpg, meleeOutcome.hits * 18);
      }
      if (meleeOutcome.stanceBroken) {
        this.sound.playStanceBreak();
        this.pushNotification('Stance Broken!', 'Strike now for a Critical Riposte!', 'combat');
      }
      if (meleeOutcome.riposteTriggered) {
        this.sound.playRiposteBoom();
        this.player.triggerRiposteLunge();
        this.combatSystem.spawnVfxBurst(this.player.position, 0xfbbf24, 6.0, 16);
        this.joltWorld.applyRadialImpulse(this.player.position, 7.0, 180);
        this.worldStreamer.triggerSpellBounce(this.player.position, 0xfbbf24, 5.2);
        this.hitstopTimer = 0.08;
        this.springArm.triggerCombatImpulse(0.24);
        const nextHeat = Math.max(0, this.rpg.thermalHeat - meleeOutcome.riposteHeatRelief);
        this.rpg = {
          ...this.rpg,
          thermalHeat: nextHeat,
          burnoutTimer: nextHeat <= 0 ? 0 : this.rpg.burnoutTimer,
          capacitorCharge: Math.min(100, this.rpg.capacitorCharge + meleeOutcome.riposteCapacitorGain),
        };
        this.pushNotification(
          'Critical Riposte!',
          `+${meleeOutcome.riposteCapacitorGain} Capacitor · -${meleeOutcome.riposteHeatRelief}% Heat`,
          'combat'
        );
      }
      this.processEnemyDrops(drops);

      const playerHits: EnemyPlayerHitEvent[] = [];
      this.enemyManager.update(
        simDt,
        this.player.position,
        this.world.groundHeightAt,
        this.world.boxColliders,
        playerHits,
        this.rpg.hp <= 0,
        this.navSystem
      );

      for (const hit of playerHits) {
        const res = resolvePlayerDamageTaken(this.rpg, hit.rawDamage, {
          guarding: this.player.guarding,
          parried: this.player.isParryWindowActive(),
        });
        this.rpg = res.state;
        if (res.parried) {
          this.sound.playParryClang();
          this.hitstopTimer = 0.055;
          this.springArm.triggerCombatImpulse(0.14);
          const parryStaggered = this.enemyManager.applyParryStanceCounter(hit.attackerId, 55);
          if (parryStaggered) {
            this.sound.playStanceBreak();
            this.hitstopTimer = 0.075;
            this.pushNotification('Parry Stagger!', `${hit.attackerName} staggered — Riposte Ready!`, 'combat');
          } else {
            this.pushNotification('Timed Parry!', `Deflected ${hit.attackerName} · +28 Capacitor`, 'combat');
          }
        } else {
          this.sound.playPlayerHurt();
          this.springArm.triggerCombatImpulse(hit.heavy ? 0.18 : 0.11);
          this.player.applyKnockback(hit.knockDirX, hit.knockDirZ, hit.heavy ? 8.5 : 5.2);
          this.player.triggerHitRecoil(hit.heavy ? -0.32 : -0.2, 0.1);
          if (res.defeated && this.defeatBeatTimer <= 0) {
            this.defeatBeatTimer = 0.55;
            this.pushNotification('Fallen in Combat', `${hit.attackerName} overwhelmed your ward.`, 'combat');
          }
        }
      }

      this.npcManager.update(simDt, this.player.position);
      this.interactionManager.update(simDt, this.player.position, this.springArm.yaw, this.npcManager);
      if (inputSnap.interactPressed) {
        this.interactionManager.triggerInteract();
      }

      const collectedNow = this.interactionManager.getCollectedCount();
      if (collectedNow > this.lastCollectedAwarded) {
        this.rpg = {
          ...this.rpg,
          crowns: this.rpg.crowns + (collectedNow - this.lastCollectedAwarded) * 15,
        };
        this.lastCollectedAwarded = collectedNow;
      } else if (collectedNow < this.lastCollectedAwarded) {
        this.lastCollectedAwarded = collectedNow;
      }

      const defeatsNow = this.combatSystem.consumeDefeats();
      if (defeatsNow > 0) {
        this.rpg = { ...this.rpg, crowns: this.rpg.crowns + defeatsNow * 8 };
      }

      this.world.update?.(simDt, this.player.position);
      this.joltWorld.update(simDt, this.player.position);
    }

    this.worldStreamer.update(dt, this.player.position);

    const weatherChanged = this.weatherSystem.update(dt, this.player.position, {
      scene: this.scene,
      renderer: this.renderer,
      sunLight: this.sunLight,
      hemiLight: this.hemiLight,
      rimLight: this.rimLight,
    });

    const landingImpulse = this.player.consumeLandingImpulse();
    if (landingImpulse > 0) {
      this.springArm.triggerLandingDip(landingImpulse);
    }

    this.springArm.update(
      dt,
      inputSnap,
      this.player.position,
      this.player.getCameraAnchorY(),
      this.player.getFirstPersonEyeY(),
      this.player.sprinting,
      this.player.crouched,
      this.world.raycastTargets
    );

    this.sunLight.target.position.set(this.player.position.x, this.player.position.y, this.player.position.z);
    this.sunLight.position.set(
      this.player.position.x + 28,
      this.player.position.y + 44,
      this.player.position.z + 22
    );

    this.renderGraph.executeFrame();

    if (this.onFloatingLabels) {
      const floatingLabels = this.interactionManager.computeFloatingLabels(
        this.springArm.camera,
        this.container.clientWidth,
        this.container.clientHeight,
        this.npcManager
      );
      this.onFloatingLabels(floatingLabels);
    }

    if (this.onCombatOverlay) {
      const dummyOverlay = this.combatSystem.computeCombatOverlay(
        this.springArm.camera,
        this.container.clientWidth,
        this.container.clientHeight,
        this.player.position
      );
      const enemyOverlay = this.enemyManager.projectEnemyOverlays(
        this.springArm.camera,
        this.container.clientWidth,
        this.container.clientHeight,
        this.player.position
      );
      this.onCombatOverlay({
        popups: [...dummyOverlay.popups, ...enemyOverlay.popups],
        dummies: [...dummyOverlay.dummies, ...enemyOverlay.bars],
      });
    }

    const combatStateNow = this.player.getCombatState();
    const combatChanged = combatStateNow !== this.lastCombatState || this.combatSystem.consumeDirty();
    this.lastCombatState = combatStateNow;

    this.telemetryTimer += dt;
    if (
      weatherChanged ||
      combatChanged ||
      this.interactionManager.consumeDirty() ||
      this.telemetryTimer >= 0.08
    ) {
      this.telemetryTimer = 0;
      this.emitTelemetry();
    }

    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('resize', this.handleResize);

    this.input.dispose();
    this.npcManager.dispose();
    this.player.dispose();
    this.combatSystem.dispose();
    this.enemyManager.dispose();
    this.joltWorld.dispose();
    this.navSystem.dispose();
    this.weatherSystem.dispose();
    this.worldStreamer.dispose();
    this.world.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
