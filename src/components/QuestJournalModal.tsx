import { ScrollText, X } from 'lucide-react';
import { QUEST_CATALOG, QUEST_ORDER } from '../aincendra/rpg/questData';
import type { FactionId, RpgHudSnapshot } from '../aincendra/rpg/rpgTypes';

interface QuestJournalModalProps {
  open: boolean;
  rpg: RpgHudSnapshot;
  onTrackQuest: (questId: string) => void;
  onClose: () => void;
}

const FACTION_META: Array<{ id: FactionId; name: string; color: string }> = [
  { id: 'vaelcrest', name: 'House Vaelcrest', color: '#d49b63' },
  { id: 'manaworks', name: 'Mana-Works Guild', color: '#6ee3f5' },
  { id: 'purists', name: 'Aetheric Purists', color: '#8cd17d' },
];

export function QuestJournalModal({
  open,
  rpg,
  onTrackQuest,
  onClose,
}: QuestJournalModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quest Journal & Factions"
    >
      <div className="flex max-h-[86vh] w-full max-w-[740px] flex-col rounded-xl border border-[#b67a4e]/55 bg-[#10151c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-[#7de2f0]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[#f4efe4]">
                Chronicle &amp; Faction Ledger
              </h2>
              <p className="text-xs text-[#9cb0c2]">
                Active quests, narrative alignments, and standing across Elarion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quest Journal"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-[#171d26] text-[#c7c4bc] hover:border-[#b67a4e] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Faction Reputation Row */}
        <div className="grid grid-cols-1 gap-3 border-b border-white/10 bg-[#141a23] px-5 py-3 sm:grid-cols-3">
          {FACTION_META.map((fac) => {
            const rep = rpg.factionRep[fac.id] ?? 0;
            const pct = Math.min(100, Math.max(4, rep * 2));
            return (
              <div key={fac.id} className="rounded-lg border border-white/8 bg-[#181f29] px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#e5e0d5]">{fac.name}</span>
                  <span className="font-mono-tabular text-[#cfd6df]">{rep} Rep</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: fac.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quests List */}
        <div className="space-y-3 overflow-y-auto p-5">
          {QUEST_ORDER.map((qid) => {
            const def = QUEST_CATALOG[qid];
            const prog = rpg.quests[qid];
            if (!def || !prog) return null;
            const isTracked = rpg.trackedQuestId === qid;
            const isCompleted = prog.status === 'completed';
            const stage = def.stages[prog.stageIndex] ?? def.stages[def.stages.length - 1];

            return (
              <div
                key={qid}
                className={`rounded-lg border p-4 ${
                  isTracked && !isCompleted
                    ? 'border-[#7de2f0]/60 bg-[#15202b]'
                    : 'border-white/10 bg-[#161c25]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#f1ede4]">{def.title}</h3>
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider ${
                          isCompleted ? 'text-[#8cd17d]' : 'text-[#d49b63]'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'Active'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9cb0c2]">
                      {def.giver} · {def.district}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-xs text-[#f2c484]">
                      {def.rewardCrowns} Cr · {def.rewardXp} XP
                    </span>
                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => onTrackQuest(qid)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                          isTracked
                            ? 'bg-[#7de2f0] text-[#0f1318]'
                            : 'border border-white/15 bg-[#1b222c] text-[#d5dce3] hover:text-white'
                        }`}
                      >
                        {isTracked ? 'Tracked' : 'Track'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-[#bcc5cf]">{def.summary}</p>

                {!isCompleted && stage && (
                  <div className="mt-2.5 flex items-center justify-between rounded-md bg-[#0f141a] px-3 py-2 text-xs">
                    <span className="text-[#e7e5df]">{stage.description}</span>
                    <span className="ml-3 font-mono-tabular text-[#7de2f0] whitespace-nowrap shrink-0">
                      {prog.stageCount}/{stage.targetCount}
                    </span>
                  </div>
                )}

                {prog.branchChosen && (
                  <p className="mt-2 text-xs font-medium text-[#8cd17d]">
                    Outcome: {prog.branchChosen}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
