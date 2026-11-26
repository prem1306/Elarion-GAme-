import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Coins,
  DoorClosed,
  DoorOpen,
  Hammer,
  Pause,
  RotateCcw,
  ScrollText,
  Shield,
  Sun,
  TrainFront,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  CameraMode,
  MapId,
  MovementConfig,
  NpcReactionKind,
  PlayerEmoteKind,
  PlayerTelemetry,
  WeatherState,
} from '../aincendra/core/types';
import { SPELL_ORDER, SPELLS } from '../aincendra/rpg/magicCombatRules';
import { QUEST_CATALOG } from '../aincendra/rpg/questData';
import type { SpellId } from '../aincendra/rpg/rpgTypes';
import { ElarionMinimap } from './ElarionMinimap';

interface GameHUDProps {
  telemetry: PlayerTelemetry;
  config: MovementConfig;
  dockOpen: boolean;
  muted: boolean;
  contextLost: boolean;
  onToggleDock: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onOpenCrafting: () => void;
  onOpenQuests: () => void;
  onOpenInventory: () => void;
  onCastSpell: (spellId: SpellId) => void;
  onTriggerVent: () => void;
  onUseQuickHeal: () => void;
  onUseQuickMana: () => void;
  onUpdateConfig: (partial: Partial<MovementConfig>) => void;
  onChangeCameraMode: (mode: CameraMode) => void;
  onChangeMap: (mapId: MapId) => void;
  onChangeWeather: (mode: WeatherState | 'auto') => void;
  onResetPlayer: () => void;
  onTeleport: (x: number, y: number, z: number) => void;
  onLockPointer: () => void;
  onCloseInspection: () => void;
  onSelectDialogueChoice: (index: number) => void;
  onTriggerEmote: (emote: PlayerEmoteKind) => void;
  onOpenRailNetwork: () => void;
}

const REACTION_LABELS: Record<NpcReactionKind, string> = {
  none: '',
  salute: 'Salutes',
  wave: 'Waves',
  nod: 'Nods',
  laugh: 'Laughs',
  point: 'Points outward',
  bow: 'Bows respectfully',
};

function SpellIcon({ id }: { id: SpellId }) {
  if (id === 'arc_bolt') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M13 2L4 14h6l-1 8 11-12h-6l-1-8z" fill="#6ee3f5" stroke="#0c1520" strokeWidth="1.4" />
      </svg>
    );
  }
  if (id === 'pyre_nova') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path
          d="M12 2c2.5 4 6 6.2 6 10.5a6 6 0 11-12 0c0-3 1.7-5.5 3.6-7.4.3 1.8 1.2 2.8 2.4 3.4-.3-2.1 0-4.4 0-6.5z"
          fill="#f59e0b"
          stroke="#0c1520"
          strokeWidth="1.3"
        />
      </svg>
    );
  }
  if (id === 'chrono_ward') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M12 3l8 3.5v5.8c0 4.6-3.4 8.2-8 9.7-4.6-1.5-8-5.1-8-9.7V6.5L12 3z" fill="#a78bfa" stroke="#0c1520" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="3" fill="#e9d5ff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path d="M12 2l3.5 7.5L12 22 8.5 9.5 12 2z" fill="#34d399" stroke="#0c1520" strokeWidth="1.4" />
    </svg>
  );
}

export function GameHUD({
  telemetry,
  config,
  dockOpen,
  muted,
  contextLost,
  onToggleDock,
  onToggleMute,
  onTogglePause,
  onOpenCrafting,
  onOpenQuests,
  onOpenInventory,
  onCastSpell,
  onTriggerVent,
  onUseQuickHeal,
  onUseQuickMana,
  onUpdateConfig,
  onChangeCameraMode,
  onChangeMap,
  onChangeWeather,
  onResetPlayer,
  onTeleport,
  onLockPointer,
  onCloseInspection,
  onSelectDialogueChoice,
  onTriggerEmote,
  onOpenRailNetwork,
}: GameHUDProps) {
  if (telemetry.lifecycleState !== 'playing') {
    return null;
  }

  const { rpg } = telemetry;
  const hpPct = Math.max(0, Math.min(100, (rpg.hp / Math.max(1, rpg.maxHp)) * 100));
  const manaPct = Math.max(0, Math.min(100, (rpg.mana / Math.max(1, rpg.maxMana)) * 100));
  const heatPct = Math.max(0, Math.min(100, rpg.thermalHeat));
  const staminaPct = Math.max(0, Math.min(100, (telemetry.stamina / Math.max(1, telemetry.maxStamina)) * 100));
  const lowHp = hpPct > 0 && hpPct < 30;

  const trackedDef = QUEST_CATALOG[rpg.trackedQuestId];
  const trackedProg = rpg.quests[rpg.trackedQuestId];
  const trackedStage = trackedDef && trackedProg ? trackedDef.stages[trackedProg.stageIndex] : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3.5 sm:p-5">
      {/* Critical Low-HP Peripheral Vignette */}
      {lowHp && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            boxShadow: 'inset 0 0 95px rgba(220, 38, 38, 0.48)',
          }}
        />
      )}

      {/* Top Perimeter Cluster */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Vitals & Tracked Quest */}
        <div className="pointer-events-auto w-full max-w-[300px] rounded-xl border border-[#b67a4e]/40 bg-[#0e1319]/92 px-3.5 py-2.5 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-xs font-bold text-[#d49b63]">
                LVL {rpg.level}
              </span>
              <span className="truncate text-xs font-medium text-[#e7e5df]">
                {telemetry.areaName}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono-tabular text-xs font-semibold text-[#f2c484] whitespace-nowrap shrink-0">
              <Coins className="h-3.5 w-3.5" />
              <span>{rpg.crowns}</span>
            </div>
          </div>

          {/* HP Bar with Trailing Damage Ghost Bar */}
          <div className="mt-2 space-y-1.5">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold tracking-wider text-[#f1c4b8]">HP</span>
                <span className="font-mono-tabular text-[#f5efe3]">
                  {rpg.hp}/{rpg.maxHp}
                </span>
              </div>
              <div className="relative mt-0.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#ef4444]/45 transition-all duration-300"
                  style={{ width: `${hpPct}%` }}
                />
                <div
                  className="relative h-full rounded-full bg-[#e05246] transition-all duration-75"
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>

            {/* Mana & Thermal Heat Row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#8ad8ec]">
                    MANA{rpg.stormConductive ? ' · +20%' : ''}
                  </span>
                  <span className="font-mono-tabular text-[#dbeafe]">
                    {rpg.mana}/{rpg.maxMana}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#38bdf8] transition-all duration-75"
                    style={{ width: `${manaPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span
                    className={
                      rpg.burnoutActive
                        ? 'font-bold text-[#f87171]'
                        : rpg.overclocked
                          ? 'font-bold text-[#fbbf24]'
                          : 'text-[#f3b67a]'
                    }
                  >
                    {rpg.burnoutActive ? 'BURNOUT!' : rpg.overclocked ? 'OVERCLOCK' : 'HEAT'}
                  </span>
                  <span className="font-mono-tabular text-[#fde68a]">{heatPct}%</span>
                </div>
                <div className="relative mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-[75%] w-0.5 bg-white/50"
                  />
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${heatPct}%`,
                      backgroundColor: rpg.burnoutActive
                        ? '#ef4444'
                        : rpg.overclocked
                          ? '#f59e0b'
                          : '#d97706',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Stamina & Capacitor Mini Row */}
            <div className="flex items-center gap-2 text-[10px] text-[#9fb2c2]">
              <span>STA</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#8cd17d]"
                  style={{ width: `${staminaPct}%` }}
                />
              </div>
              <span className="text-[#7de2f0]">CAP {rpg.capacitorCharge}%</span>
              {telemetry.mapId === 'elarion-district' && (
                <span className="flex items-center gap-1 whitespace-nowrap">
                  {telemetry.southGateOpen ? (
                    <DoorOpen className="h-3 w-3 text-[#8cd17d]" />
                  ) : (
                    <DoorClosed className="h-3 w-3 text-[#d4965b]" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Compact Tracked Quest Objective */}
          {trackedDef && trackedProg && (
            <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2 font-semibold text-[#7de2f0]">
                <span className="truncate">{trackedDef.title}</span>
                {trackedStage && trackedProg.status !== 'completed' && (
                  <span className="font-mono-tabular shrink-0">
                    {trackedProg.stageCount}/{trackedStage.targetCount}
                  </span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[#c3ccd6]">
                {trackedProg.status === 'completed'
                  ? 'Quest completed — check Chronicle [J].'
                  : trackedStage?.description}
              </p>
            </div>
          )}
        </div>

        {/* Top-Center Boss Bar & Notification */}
        <div className="flex flex-1 flex-col items-center gap-2 px-2">
          {rpg.activeBoss && (
            <div className="w-full max-w-[420px] rounded-xl border border-[#7de2f0]/50 bg-[#0e1319]/92 px-4 py-2 shadow-xl">
              <div className="flex items-center justify-between text-xs font-semibold text-[#f4efe4]">
                <span>
                  {rpg.activeBoss.name}
                  {rpg.activeBoss.staggered ? ' · STAGGERED!' : ''}
                </span>
                <span className="font-mono-tabular text-[#7de2f0]">
                  {Math.round(rpg.activeBoss.hp)} / {rpg.activeBoss.maxHp}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#22d3ee] transition-all duration-100"
                  style={{
                    width: `${Math.max(0, Math.min(100, (rpg.activeBoss.hp / rpg.activeBoss.maxHp) * 100))}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#d49b63]">
                  {rpg.activeBoss.staggered ? 'Riposte Ready [LMB]' : 'Stance'}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      rpg.activeBoss.staggered ? 'bg-[#fbbf24]' : 'bg-[#d49b63]'
                    }`}
                    style={{
                      width: `${
                        rpg.activeBoss.staggered
                          ? 100
                          : Math.max(
                              0,
                              Math.min(
                                100,
                                (rpg.activeBoss.poise / Math.max(1, rpg.activeBoss.maxPoise)) * 100
                              )
                            )
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {telemetry.notification && (
            <div className="rounded-lg border border-[#b67a4e]/55 bg-[#0e1319]/94 px-4 py-2 text-center shadow-lg">
              <div className="text-xs font-semibold text-[#f4efe4]">
                {telemetry.notification.title}
              </div>
              {telemetry.notification.detail && (
                <div className="text-[11px] text-[#9ecbe0]">
                  {telemetry.notification.detail}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Right Utility Controls & Minimap */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            {!telemetry.pointerLocked && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onLockPointer();
                }}
                className="rounded-lg border border-white/15 bg-[#0e1319]/92 px-2.5 py-1.5 text-xs font-medium text-[#e7e5df] hover:border-[#b67a4e] whitespace-nowrap shrink-0"
              >
                Mouse Look
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Quest Journal [J]"
              title="Quest Journal [J]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenQuests();
              }}
              className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0e1319]/92 px-2.5 py-1.5 text-xs font-medium text-[#e7e5df] hover:border-[#7de2f0] whitespace-nowrap shrink-0"
            >
              <ScrollText className="h-3.5 w-3.5 text-[#7de2f0]" />
              <span>Quests [J]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Crafting [B]"
              title="Crafting Workshop [B]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCrafting();
              }}
              className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0e1319]/92 px-2.5 py-1.5 text-xs font-medium text-[#e7e5df] hover:border-[#d49b63] whitespace-nowrap shrink-0"
            >
              <Hammer className="h-3.5 w-3.5 text-[#d49b63]" />
              <span>Craft [B]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Armory & Inventory [I]"
              title="Armory & Inventory [I]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenInventory();
              }}
              className="flex items-center gap-1 rounded-lg border border-white/15 bg-[#0e1319]/92 px-2.5 py-1.5 text-xs font-medium text-[#e7e5df] hover:border-[#b67a4e] whitespace-nowrap shrink-0"
            >
              <Shield className="h-3.5 w-3.5 text-[#8cd17d]" />
              <span>Gear [I]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
              title="Mute / Unmute [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#0e1319]/92 text-[#e7e5df] hover:border-[#b67a4e]"
            >
              {muted ? <VolumeX className="h-4 w-4 text-[#f87171]" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Game [P]"
              title="Pause [P / Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#0e1319]/92 text-[#e7e5df] hover:border-[#b67a4e]"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          {telemetry.mapId === 'elarion-district' && (
            <ElarionMinimap
              position={telemetry.position}
              yaw={telemetry.yaw}
              cameraYaw={telemetry.cameraYaw}
              cameraMode={telemetry.cameraMode}
              areaName={telemetry.areaName}
              southGateOpen={telemetry.southGateOpen}
              onTeleport={onTeleport}
            />
          )}
        </div>
      </div>

      {/* Center Reticle when Pointer-Locked */}
      {telemetry.pointerLocked && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80"
        />
      )}

      {contextLost && (
        <div className="pointer-events-auto mx-auto rounded-lg border border-amber-500/40 bg-[#1a1510]/95 px-4 py-3 text-sm text-amber-200">
          WebGL rendering context interrupted. Recovering graphics state.
        </div>
      )}

      {/* Bottom Perimeter: Dialogue Overlay + Action Hotbar + Collapsible Tuning Dock */}
      <div className="mx-auto flex w-full max-w-[980px] flex-col items-center">
        {telemetry.activeInspection && (
          <div className="pointer-events-auto mb-3 w-full max-w-[660px] rounded-xl border border-[#b67a4e]/55 bg-[#0e1319]/96 px-4 py-3.5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#d49b63]">
                  <span>{telemetry.activeInspection.category}</span>
                  {telemetry.activeInspection.subtitle && (
                    <>
                      <span className="text-white/25" aria-hidden="true">·</span>
                      <span className="text-[#9fb2c2]">{telemetry.activeInspection.subtitle}</span>
                    </>
                  )}
                  {telemetry.activeInspection.npcReaction &&
                    telemetry.activeInspection.npcReaction !== 'none' && (
                      <>
                        <span className="text-white/25" aria-hidden="true">·</span>
                        <span className="text-[#8cd17d]">
                          [{REACTION_LABELS[telemetry.activeInspection.npcReaction]}]
                        </span>
                      </>
                    )}
                </div>
                <h2 className="mt-0.5 font-display text-base font-semibold text-[#f1ede4]">
                  {telemetry.activeInspection.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseInspection}
                aria-label="Close dialogue"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/12 bg-[#171d24] text-[#c7c4bc] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#ddd9d0]">
              {telemetry.activeInspection.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>

            {telemetry.activeInspection.choices && telemetry.activeInspection.choices.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {telemetry.activeInspection.choices.map((choice, idx) => (
                  <button
                    key={`${choice.label}-${idx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDialogueChoice(idx);
                    }}
                    className="flex items-center gap-2.5 rounded-lg border border-white/12 bg-[#171d24] px-3 py-2 text-left text-xs font-medium text-[#e9e5dc] hover:border-[#b67a4e]/80 hover:bg-[#1e2630]"
                  >
                    <span className="font-mono-tabular text-[#d49b63]">[{idx + 1}]</span>
                    <span>{choice.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 text-[11px] text-[#8d99a6]">
              {telemetry.activeInspection.choices?.length
                ? 'Choose 1–3 or click · Press E / Esc to close'
                : 'Press E or Esc to close'}
            </div>
          </div>
        )}

        {/* Spell & Consumable Hotbar */}
        <div className="pointer-events-auto mb-1.5 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-[#0e1319]/92 px-2.5 py-1.5 shadow-xl">
          {SPELL_ORDER.map((id) => {
            const spell = SPELLS[id];
            const cd = rpg.spellCooldowns[id];
            const disabled = rpg.burnoutActive || rpg.mana < spell.manaCost || cd > 0;
            return (
              <button
                key={id}
                type="button"
                tabIndex={-1}
                title={`${spell.name} (${spell.manaCost} Mana) — ${spell.description}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCastSpell(id);
                }}
                className={`relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors whitespace-nowrap shrink-0 ${
                  disabled
                    ? 'border-white/8 bg-[#141922] text-white/45'
                    : 'border-white/18 bg-[#18202c] text-[#f1ede4] hover:border-[#7de2f0]'
                }`}
              >
                <span className="font-mono-tabular text-[10px] text-[#9fb2c2]">[{spell.hotkey}]</span>
                <SpellIcon id={id} />
                <span className="font-medium">{spell.name}</span>
                {cd > 0 && (
                  <span className="font-mono-tabular text-[10px] text-[#fbbf24]">
                    {cd.toFixed(1)}s
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            tabIndex={-1}
            title="Exothermic Vent — Dump Thermal Heat into radial shockwave [G]"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerVent();
            }}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              rpg.thermalHeat >= 25 && rpg.ventCooldown <= 0
                ? 'border-[#f59e0b]/60 bg-[#241a10] text-[#fde68a] hover:border-[#fbbf24]'
                : 'border-white/8 bg-[#141922] text-white/45'
            }`}
          >
            <span className="font-mono-tabular text-[10px]">[G]</span>
            <span>Vent</span>
            {rpg.ventCooldown > 0 && (
              <span className="font-mono-tabular text-[10px]">{rpg.ventCooldown.toFixed(1)}s</span>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            title="Use Vitality Elixir (+45 HP) [Q]"
            onClick={(e) => {
              e.currentTarget.blur();
              onUseQuickHeal();
            }}
            className="flex items-center gap-1 rounded-lg border border-[#e05246]/45 bg-[#1f1316] px-2 py-1.5 text-xs text-[#fecaca] hover:border-[#f87171] whitespace-nowrap shrink-0"
          >
            <span className="font-mono-tabular text-[10px]">[Q]</span>
            <span>Elixir ×{rpg.elixirCount}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            title="Use Aether Draught (+45 Mana) [5]"
            onClick={(e) => {
              e.currentTarget.blur();
              onUseQuickMana();
            }}
            className="flex items-center gap-1 rounded-lg border border-[#38bdf8]/45 bg-[#111d26] px-2 py-1.5 text-xs text-[#bae6fd] hover:border-[#7de2f0] whitespace-nowrap shrink-0"
          >
            <span className="font-mono-tabular text-[10px]">[5]</span>
            <span>Draught ×{rpg.draughtCount}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleDock();
            }}
            className="flex items-center gap-1 rounded-lg border border-white/12 bg-[#161c24] px-2 py-1.5 text-xs text-[#aeb7c2] hover:text-white whitespace-nowrap shrink-0"
          >
            {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            <span>[H]</span>
          </button>
        </div>

        {/* Collapsible Settings & World Tuning Drawer */}
        {dockOpen && (
          <div className="pointer-events-auto w-full rounded-xl border border-white/12 bg-[#0e1319]/94 px-4 py-3 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex flex-col gap-1 text-xs text-[#a8b3be]">
                  <span className="flex items-center justify-between gap-2 whitespace-nowrap">
                    <span>Walk</span>
                    <span className="font-mono-tabular text-[#e7e5df]">{config.walkSpeed.toFixed(1)}</span>
                  </span>
                  <input
                    type="range"
                    min={2.5}
                    max={7.5}
                    step={0.1}
                    value={config.walkSpeed}
                    onChange={(e) => onUpdateConfig({ walkSpeed: Number(e.target.value) })}
                    className="h-1.5 w-20 cursor-pointer accent-[#b67a4e]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[#a8b3be]">
                  <span className="flex items-center justify-between gap-2 whitespace-nowrap">
                    <span>Sprint</span>
                    <span className="font-mono-tabular text-[#e7e5df]">{config.sprintSpeed.toFixed(1)}</span>
                  </span>
                  <input
                    type="range"
                    min={6.0}
                    max={12.0}
                    step={0.2}
                    value={config.sprintSpeed}
                    onChange={(e) => onUpdateConfig({ sprintSpeed: Number(e.target.value) })}
                    className="h-1.5 w-20 cursor-pointer accent-[#b67a4e]"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-white/10 bg-[#171d24] p-0.5">
                  <button
                    type="button"
                    onClick={() => onChangeMap('elarion-district')}
                    className={`rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${
                      telemetry.mapId === 'elarion-district'
                        ? 'bg-[#b67a4e] text-[#0f1318]'
                        : 'text-[#b5bec7]'
                    }`}
                  >
                    Elarion
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMap('greybox')}
                    className={`rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${
                      telemetry.mapId === 'greybox'
                        ? 'bg-[#b67a4e] text-[#0f1318]'
                        : 'text-[#b5bec7]'
                    }`}
                  >
                    Proving Yard
                  </button>
                </div>

                <div className="flex items-center rounded-lg border border-white/10 bg-[#171d24] p-0.5">
                  <button
                    type="button"
                    onClick={() => onChangeCameraMode('third-person')}
                    className={`rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${
                      telemetry.cameraMode === 'third-person'
                        ? 'bg-[#b67a4e] text-[#0f1318]'
                        : 'text-[#b5bec7]'
                    }`}
                  >
                    3rd Person
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeCameraMode('first-person')}
                    className={`rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${
                      telemetry.cameraMode === 'first-person'
                        ? 'bg-[#b67a4e] text-[#0f1318]'
                        : 'text-[#b5bec7]'
                    }`}
                  >
                    1st Person
                  </button>
                </div>

                <div className="flex items-center rounded-lg border border-white/10 bg-[#171d24] p-0.5">
                  {(['auto', 'clear', 'overcast', 'rainy'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onChangeWeather(w)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium capitalize whitespace-nowrap ${
                        (w === 'auto' && telemetry.weatherAutoCycle) ||
                        (!telemetry.weatherAutoCycle && telemetry.weatherState === w)
                          ? 'bg-[#b67a4e] text-[#0f1318]'
                          : 'text-[#b5bec7]'
                      }`}
                    >
                      {w === 'clear' && <Sun className="h-3 w-3" />}
                      {w === 'overcast' && <Cloud className="h-3 w-3" />}
                      {w === 'rainy' && <CloudRain className="h-3 w-3" />}
                      <span>{w}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center rounded-lg border border-white/10 bg-[#171d24] p-0.5">
                  {(['wave', 'salute', 'sit'] as const).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => onTriggerEmote(em)}
                      className={`rounded-md px-2 py-1 text-xs font-medium capitalize whitespace-nowrap ${
                        telemetry.activeEmote === em
                          ? 'bg-[#b67a4e] text-[#0f1318]'
                          : 'text-[#b5bec7]'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                {telemetry.mapId === 'elarion-district' && (
                  <button
                    type="button"
                    onClick={onOpenRailNetwork}
                    className="flex items-center gap-1 rounded-lg border border-[#7de2f0]/45 bg-[#15202b] px-2.5 py-1 text-xs font-medium text-[#9ff3ff] whitespace-nowrap"
                  >
                    <TrainFront className="h-3.5 w-3.5" />
                    <span>Rail [T]</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onResetPlayer}
                  className="flex items-center gap-1 rounded-lg border border-white/12 bg-[#171d24] px-2.5 py-1 text-xs font-medium text-[#e7e5df] whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div className="mt-2 border-t border-white/8 pt-1.5 text-[11px] text-[#9aa5b1]">
              LMB/F Sabre · R Cleave · X Sidearm · RMB Guard/Parry · V Dodge · 1-4 Spells · G Vent · Q Elixir · 5 Draught · E Interact · B Craft · J Quests · I Gear · T Rail
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
