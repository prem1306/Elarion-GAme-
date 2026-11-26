import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AincendraEngine,
  createInitialRpgState,
  SAVE_STORAGE_KEY,
} from './aincendra/AincendraEngine';
import {
  DEFAULT_MOVEMENT_CONFIG,
  type CameraMode,
  type MapId,
  type MovementConfig,
  type PlayerEmoteKind,
  type PlayerTelemetry,
  type WeatherState,
} from './aincendra/core/types';
import type { CraftingStationKind, SpellId } from './aincendra/rpg/rpgTypes';
import {
  ALL_LINE_PASS_PRICE,
  findNearestRailStation,
  type RailStationId,
} from './aincendra/world/ManaRailNetwork';
import { CraftingModal } from './components/CraftingModal';
import {
  FloatingCombatOverlay,
  type FloatingCombatOverlayHandle,
} from './components/FloatingCombatOverlay';
import {
  FloatingInteractLabels,
  type FloatingInteractLabelsHandle,
} from './components/FloatingInteractLabels';
import { GameHUD } from './components/GameHUD';
import { GameStatusModal } from './components/GameStatusModal';
import { InventoryModal } from './components/InventoryModal';
import { ManaRailModal } from './components/ManaRailModal';
import { QuestJournalModal } from './components/QuestJournalModal';
import { TitleOverlay } from './components/TitleOverlay';

const initialRpg = createInitialRpgState();

const INITIAL_TELEMETRY: PlayerTelemetry = {
  speed: 0,
  verticalSpeed: 0,
  grounded: true,
  crouched: false,
  sprinting: false,
  stamina: 100,
  maxStamina: 100,
  activeEmote: 'none',
  locomotionState: 'Idle',
  combatState: 'Ready',
  comboCount: 0,
  totalHits: 0,
  lastDamageDealt: 0,
  cameraMode: 'third-person',
  mapId: 'elarion-district',
  areaName: 'Harbourgate Lane',
  weatherState: 'clear',
  weatherAutoCycle: true,
  npcCount: 104,
  wildlifeCount: 27,
  southGateOpen: false,
  crowns: 48,
  collectedCount: 0,
  totalPickables: 18,
  recentPickupTitle: null,
  pointerLocked: false,
  fps: 60,
  position: { x: 0, y: 0, z: 29 },
  yaw: 0,
  cameraYaw: 0,
  activePrompt: null,
  activeInspection: null,
  lifecycleState: 'title',
  outcome: 'none',
  rpg: {
    hp: initialRpg.hp,
    maxHp: initialRpg.maxHp,
    mana: initialRpg.mana,
    maxMana: initialRpg.maxMana,
    thermalHeat: 0,
    burnoutActive: false,
    overclocked: false,
    capacitorCharge: 0,
    level: 1,
    xp: 0,
    xpToNext: 100,
    crowns: initialRpg.crowns,
    attackPower: 22,
    spellPower: 0,
    armorRating: 0,
    equippedWeaponName: 'Vaelcrest Training Sabre',
    equippedArmorName: 'Mariner Greatcoat',
    equippedRelicName: null,
    spellCooldowns: { arc_bolt: 0, pyre_nova: 0, chrono_ward: 0, ley_lance: 0 },
    ventCooldown: 0,
    activeWardTimer: 0,
    overdriveTimer: 0,
    inventory: initialRpg.inventory,
    quests: initialRpg.quests,
    trackedQuestId: initialRpg.trackedQuestId,
    factionRep: initialRpg.factionRep,
    enemiesDefeated: 0,
    bossesDefeated: 0,
    itemsCrafted: 0,
    elixirCount: 2,
    draughtCount: 1,
    nearestStation: 'field',
    nearbyEnemyCount: 0,
    activeBoss: null,
  },
  notification: null,
};

const INITIAL_TICKETS: Record<RailStationId, number> = {
  harbour: 0,
  temple: 0,
  manaworks: 0,
  merchant: 0,
  councils: 0,
  bastion: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AincendraEngine | null>(null);
  const floatingLabelsRef = useRef<FloatingInteractLabelsHandle | null>(null);
  const combatOverlayRef = useRef<FloatingCombatOverlayHandle | null>(null);

  const [telemetry, setTelemetry] = useState<PlayerTelemetry>(INITIAL_TELEMETRY);
  const telemetryRef = useRef<PlayerTelemetry>(INITIAL_TELEMETRY);
  const [config, setConfig] = useState<MovementConfig>(DEFAULT_MOVEMENT_CONFIG);
  const [dockOpen, setDockOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const [railModalOpen, setRailModalOpen] = useState(false);
  const [railOriginId, setRailOriginId] = useState<RailStationId>('harbour');
  const [railTickets, setRailTickets] = useState<Record<RailStationId, number>>(INITIAL_TICKETS);
  const [railDayPass, setRailDayPass] = useState(false);

  const [craftingOpen, setCraftingOpen] = useState(false);
  const [craftStationOverride, setCraftStationOverride] = useState<CraftingStationKind | null>(null);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(() => {
    try {
      return Boolean(localStorage.getItem(SAVE_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  const modalFlagsRef = useRef({
    railModalOpen: false,
    craftingOpen: false,
    questsOpen: false,
    inventoryOpen: false,
  });

  useEffect(() => {
    modalFlagsRef.current = {
      railModalOpen,
      craftingOpen,
      questsOpen,
      inventoryOpen,
    };
    const anyModalOpen = railModalOpen || craftingOpen || questsOpen || inventoryOpen;
    engineRef.current?.setModalOpen(anyModalOpen);
  }, [railModalOpen, craftingOpen, questsOpen, inventoryOpen]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const autostart = new URLSearchParams(window.location.search).get('autostart') === '1';

    const engine = new AincendraEngine(
      mount,
      (nextTelemetry) => {
        telemetryRef.current = nextTelemetry;
        setTelemetry(nextTelemetry);
      },
      (lost) => setContextLost(lost),
      (labels) => floatingLabelsRef.current?.updateLabels(labels),
      (overlay) => combatOverlayRef.current?.updateCombatOverlay(overlay),
      (stationId) => {
        setRailOriginId(stationId as RailStationId);
        setRailModalOpen(true);
      },
      (station) => {
        setCraftStationOverride(station);
        setCraftingOpen(true);
      },
      autostart
    );
    engineRef.current = engine;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.repeat) return;

      const state = telemetryRef.current.lifecycleState;

      if (e.code === 'KeyM') {
        const nextMuted = !engine.sound.isMuted();
        engine.sound.setMuted(nextMuted);
        setMuted(nextMuted);
        return;
      }

      if (state === 'title') return;

      if (e.code === 'KeyP') {
        setCraftingOpen(false);
        setQuestsOpen(false);
        setInventoryOpen(false);
        setRailModalOpen(false);
        engine.togglePause();
        return;
      }

      if (e.code === 'Escape') {
        const flags = modalFlagsRef.current;
        if (flags.railModalOpen || flags.craftingOpen || flags.questsOpen || flags.inventoryOpen) {
          setRailModalOpen(false);
          setCraftingOpen(false);
          setQuestsOpen(false);
          setInventoryOpen(false);
          setCraftStationOverride(null);
          return;
        }
        if (telemetryRef.current.activeInspection) {
          engine.closeInspection();
          return;
        }
        engine.togglePause();
        return;
      }

      if (state !== 'playing') return;

      if (e.code === 'KeyH') {
        setDockOpen((prev) => !prev);
      } else if (e.code === 'KeyB') {
        setQuestsOpen(false);
        setInventoryOpen(false);
        setRailModalOpen(false);
        setCraftStationOverride(null);
        setCraftingOpen((prev) => !prev);
      } else if (e.code === 'KeyJ') {
        setCraftingOpen(false);
        setInventoryOpen(false);
        setRailModalOpen(false);
        setQuestsOpen((prev) => !prev);
      } else if (e.code === 'KeyI') {
        setCraftingOpen(false);
        setQuestsOpen(false);
        setRailModalOpen(false);
        setInventoryOpen((prev) => !prev);
      } else if (e.code === 'KeyT') {
        if (telemetryRef.current.mapId === 'elarion-district') {
          setCraftingOpen(false);
          setQuestsOpen(false);
          setInventoryOpen(false);
          setRailModalOpen((prev) => {
            if (!prev) {
              const nearest = findNearestRailStation(
                telemetryRef.current.position.x,
                telemetryRef.current.position.z
              );
              setRailOriginId(nearest.id);
              engine.releasePointerLock();
            }
            return !prev;
          });
        }
      } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        if (telemetryRef.current.activeInspection?.choices?.length) {
          const idx = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : 2;
          engine.selectDialogueChoice(idx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleUpdateConfig = useCallback((partial: Partial<MovementConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.updateMovementConfig(partial);
      return next;
    });
  }, []);

  const handleChangeCameraMode = useCallback((mode: CameraMode) => {
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleChangeMap = useCallback((mapId: MapId) => {
    engineRef.current?.setMap(mapId);
  }, []);

  const handleResetPlayer = useCallback(() => {
    engineRef.current?.resetPlayer();
  }, []);

  const handleTeleport = useCallback((x: number, y: number, z: number) => {
    engineRef.current?.teleportTo(x, y, z);
  }, []);

  const handleLockPointer = useCallback(() => {
    engineRef.current?.requestPointerLock();
  }, []);

  const handleCloseInspection = useCallback(() => {
    engineRef.current?.closeInspection();
  }, []);

  const handleChangeWeather = useCallback((mode: WeatherState | 'auto') => {
    engineRef.current?.setWeatherMode(mode);
  }, []);

  const handleSelectDialogueChoice = useCallback((index: number) => {
    engineRef.current?.selectDialogueChoice(index);
  }, []);

  const handleTriggerEmote = useCallback((emote: PlayerEmoteKind) => {
    engineRef.current?.triggerEmote(emote);
  }, []);

  const handleCastSpell = useCallback((spellId: SpellId) => {
    engineRef.current?.castSpell(spellId);
  }, []);

  const handleTriggerVent = useCallback(() => {
    engineRef.current?.triggerVent();
  }, []);

  const handleUseQuickHeal = useCallback(() => {
    engineRef.current?.useInventoryItem('vitality_elixir');
  }, []);

  const handleUseQuickMana = useCallback(() => {
    engineRef.current?.useInventoryItem('aether_draught');
  }, []);

  const handleOpenRailNetwork = useCallback(() => {
    if (telemetryRef.current.mapId !== 'elarion-district') return;
    const nearest = findNearestRailStation(
      telemetryRef.current.position.x,
      telemetryRef.current.position.z
    );
    setRailOriginId(nearest.id);
    engineRef.current?.releasePointerLock();
    setRailModalOpen(true);
  }, []);

  const handleBuyRailTicket = useCallback((stationId: RailStationId, fare: number) => {
    const engine = engineRef.current;
    if (!engine || !engine.spendCrowns(fare)) return false;
    setRailTickets((prev) => ({
      ...prev,
      [stationId]: (prev[stationId] ?? 0) + 1,
    }));
    return true;
  }, []);

  const handleBuyRailDayPass = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.spendCrowns(ALL_LINE_PASS_PRICE)) return false;
    setRailDayPass(true);
    return true;
  }, []);

  const handleDepartRail = useCallback(
    (destinationId: RailStationId, useTicket: boolean, fareIfBuying: number) => {
      if (railDayPass) return true;
      if (useTicket) {
        setRailTickets((prev) => ({
          ...prev,
          [destinationId]: Math.max(0, (prev[destinationId] ?? 0) - 1),
        }));
        return true;
      }
      const engine = engineRef.current;
      return Boolean(engine && engine.spendCrowns(fareIfBuying));
    },
    [railDayPass]
  );

  const activeCraftStation = craftStationOverride ?? telemetry.rpg.nearestStation;

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#0f1318]">
      <div
        ref={canvasMountRef}
        data-testid="game-viewport"
        onClick={handleLockPointer}
        className="h-full w-full cursor-crosshair"
        aria-label="Aincendra Elarion 3D Viewport"
      />

      {telemetry.lifecycleState === 'title' && (
        <TitleOverlay
          hasSavedGame={hasSavedGame}
          onStartNew={() => engineRef.current?.startNewGame()}
          onContinueSaved={() => engineRef.current?.loadFromStorage()}
        />
      )}

      {telemetry.lifecycleState === 'playing' && (
        <>
          <FloatingInteractLabels ref={floatingLabelsRef} />
          <FloatingCombatOverlay ref={combatOverlayRef} />
        </>
      )}

      <GameHUD
        telemetry={telemetry}
        config={config}
        dockOpen={dockOpen}
        muted={muted}
        contextLost={contextLost}
        onToggleDock={() => setDockOpen((prev) => !prev)}
        onToggleMute={() => {
          const eng = engineRef.current;
          if (!eng) return;
          const next = !eng.sound.isMuted();
          eng.sound.setMuted(next);
          setMuted(next);
        }}
        onTogglePause={() => engineRef.current?.togglePause()}
        onOpenCrafting={() => {
          setCraftStationOverride(null);
          setCraftingOpen(true);
        }}
        onOpenQuests={() => setQuestsOpen(true)}
        onOpenInventory={() => setInventoryOpen(true)}
        onCastSpell={handleCastSpell}
        onTriggerVent={handleTriggerVent}
        onUseQuickHeal={handleUseQuickHeal}
        onUseQuickMana={handleUseQuickMana}
        onUpdateConfig={handleUpdateConfig}
        onChangeCameraMode={handleChangeCameraMode}
        onChangeMap={handleChangeMap}
        onChangeWeather={handleChangeWeather}
        onResetPlayer={handleResetPlayer}
        onTeleport={handleTeleport}
        onLockPointer={handleLockPointer}
        onCloseInspection={handleCloseInspection}
        onSelectDialogueChoice={handleSelectDialogueChoice}
        onTriggerEmote={handleTriggerEmote}
        onOpenRailNetwork={handleOpenRailNetwork}
      />

      <CraftingModal
        open={craftingOpen && telemetry.lifecycleState === 'playing'}
        rpg={telemetry.rpg}
        activeStation={activeCraftStation}
        onCraft={(recipeId) =>
          engineRef.current?.craftItem(recipeId) ?? { crafted: false, reason: 'Engine unavailable' }
        }
        onClose={() => {
          setCraftingOpen(false);
          setCraftStationOverride(null);
        }}
      />

      <QuestJournalModal
        open={questsOpen && telemetry.lifecycleState === 'playing'}
        rpg={telemetry.rpg}
        onTrackQuest={(qid) => engineRef.current?.trackQuest(qid)}
        onClose={() => setQuestsOpen(false)}
      />

      <InventoryModal
        open={inventoryOpen && telemetry.lifecycleState === 'playing'}
        rpg={telemetry.rpg}
        onEquip={(itemId) => engineRef.current?.equipInventoryItem(itemId)}
        onUseItem={(itemId) => engineRef.current?.useInventoryItem(itemId)}
        onClose={() => setInventoryOpen(false)}
      />

      <ManaRailModal
        open={railModalOpen && telemetry.mapId === 'elarion-district' && telemetry.lifecycleState === 'playing'}
        originStationId={railOriginId}
        crowns={telemetry.crowns}
        tickets={railTickets}
        dayPassActive={railDayPass}
        onClose={() => setRailModalOpen(false)}
        onBuyTicket={handleBuyRailTicket}
        onBuyDayPass={handleBuyRailDayPass}
        onDepart={handleDepartRail}
        onArrivalTeleport={handleTeleport}
      />

      <GameStatusModal
        lifecycleState={telemetry.lifecycleState}
        outcome={telemetry.outcome}
        rpg={telemetry.rpg}
        onResume={() => engineRef.current?.togglePause()}
        onSave={() => {
          const ok = engineRef.current?.saveToStorage() ?? false;
          if (ok) setHasSavedGame(true);
        }}
        onRestart={() => engineRef.current?.startNewGame()}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
        onContinueAfterVictory={() => engineRef.current?.continueExploringAfterVictory()}
      />
    </main>
  );
}
