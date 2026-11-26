import type { GameLifecycleState, GameOutcome, RpgHudSnapshot } from '../aincendra/rpg/rpgTypes';

interface GameStatusModalProps {
  lifecycleState: GameLifecycleState;
  outcome: GameOutcome;
  rpg: RpgHudSnapshot;
  onResume: () => void;
  onSave: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onContinueAfterVictory: () => void;
}

export function GameStatusModal({
  lifecycleState,
  outcome,
  rpg,
  onResume,
  onSave,
  onRestart,
  onReturnTitle,
  onContinueAfterVictory,
}: GameStatusModalProps) {
  if (lifecycleState !== 'paused' && lifecycleState !== 'gameover') {
    return null;
  }

  const isVictory = lifecycleState === 'gameover' && outcome === 'victory';
  const isDefeat = lifecycleState === 'gameover' && outcome === 'defeat';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'Victory' : isDefeat ? 'Defeat' : 'Game Paused'}
    >
      <div className="w-full max-w-[460px] rounded-xl border border-[#b67a4e]/60 bg-[#10151c] p-6 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d49b63]">
          {isVictory
            ? 'Emerald Wilds Restored'
            : isDefeat
              ? 'Ward Shattered'
              : 'Journey Paused'}
        </div>

        <h2 className="mt-1.5 font-display text-2xl font-bold text-[#f4efe4]">
          {isVictory
            ? 'Crystal Wyrm Vanquished'
            : isDefeat
              ? 'Fallen in Elarion'
              : 'Aincendra: Elarion'}
        </h2>

        <p className="mt-2 text-sm text-[#b9c2cc]">
          {isVictory
            ? 'The Ancient Ley-Portal resonates in harmony once more across House Vaelcrest.'
            : isDefeat
              ? 'Your Thermal-Aether core collapsed under hostile fire.'
              : 'Simulation paused. Save your chronicle or return to Elarion.'}
        </p>

        {/* Tabular-nums Mastery / Progress Readouts */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-lg border border-white/10 bg-[#161c25] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-[#95a2b0]">Level</div>
            <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#f4efe4]">
              {rpg.level}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#161c25] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-[#95a2b0]">Foes Slain</div>
            <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#7de2f0]">
              {rpg.enemiesDefeated}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#161c25] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-[#95a2b0]">Crowns</div>
            <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#f2c484]">
              {rpg.crowns}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {lifecycleState === 'paused' && (
            <>
              <button
                type="button"
                onClick={onResume}
                className="w-full rounded-lg bg-[#b67a4e] px-4 py-2.5 text-sm font-semibold text-[#0f1318] transition-colors hover:bg-[#cb8b5b]"
              >
                Resume Journey
              </button>
              <button
                type="button"
                onClick={onSave}
                className="w-full rounded-lg border border-[#7de2f0]/45 bg-[#15202b] px-4 py-2.5 text-sm font-medium text-[#9ff3ff] transition-colors hover:border-[#7de2f0]"
              >
                Save Chronicle
              </button>
            </>
          )}

          {isVictory && (
            <button
              type="button"
              onClick={onContinueAfterVictory}
              className="w-full rounded-lg bg-[#b67a4e] px-4 py-2.5 text-sm font-semibold text-[#0f1318] transition-colors hover:bg-[#cb8b5b]"
            >
              Continue Exploring Elarion
            </button>
          )}

          <button
            type="button"
            data-start={isDefeat || isVictory ? 'true' : undefined}
            onClick={onRestart}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              isDefeat
                ? 'bg-[#b67a4e] text-[#0f1318] hover:bg-[#cb8b5b]'
                : 'border border-white/15 bg-[#171d26] text-[#e5e0d5] hover:border-[#b67a4e]'
            }`}
          >
            {isDefeat ? 'Try Again' : 'Restart Expedition'}
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full rounded-lg border border-white/12 bg-transparent px-4 py-2 text-xs font-medium text-[#aab4c0] transition-colors hover:text-white"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
