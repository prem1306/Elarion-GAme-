import { Hammer, X } from 'lucide-react';
import { useState } from 'react';
import {
  canCraftRecipe,
  CRAFTING_RECIPES,
  getItemCount,
  ITEMS,
} from '../aincendra/rpg/craftingData';
import type { CraftingStationKind, RpgHudSnapshot } from '../aincendra/rpg/rpgTypes';

interface CraftingModalProps {
  open: boolean;
  rpg: RpgHudSnapshot;
  activeStation: CraftingStationKind;
  onCraft: (recipeId: string) => { crafted: boolean; reason?: string };
  onClose: () => void;
}

const STATION_NAMES: Record<CraftingStationKind, string> = {
  field: 'Field Synthesis (Anywhere)',
  forge: 'Runesmith Forge',
  alchemy: 'Alchemy Bench',
  shrine: 'Ancestral Ley-Shrine',
};

export function CraftingModal({
  open,
  rpg,
  activeStation,
  onCraft,
  onClose,
}: CraftingModalProps) {
  const [filter, setFilter] = useState<'all' | CraftingStationKind>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!open) return null;

  const recipes = CRAFTING_RECIPES.filter((r) => filter === 'all' || r.station === filter);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Runesmith & Alchemy Crafting"
    >
      <div className="flex max-h-[86vh] w-full max-w-[780px] flex-col rounded-xl border border-[#b67a4e]/55 bg-[#10151c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Hammer className="h-5 w-5 text-[#d49b63]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[#f4efe4]">
                Artificer &amp; Runesmith Workshop
              </h2>
              <p className="text-xs text-[#9cb0c2]">
                Active Station: <span className="font-semibold text-[#7de2f0]">{STATION_NAMES[activeStation]}</span>
                {' · '}
                <span className="font-mono-tabular text-[#f2c484]">{rpg.crowns} Crowns</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Crafting"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-[#171d26] text-[#c7c4bc] hover:border-[#b67a4e] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Station Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-[#141a23] px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', 'All Recipes'],
                ['field', 'Field'],
                ['alchemy', 'Alchemy Bench'],
                ['forge', 'Runesmith Forge'],
                ['shrine', 'Ley-Shrine'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? 'bg-[#b67a4e] text-[#0f1318]'
                    : 'bg-[#1b222d] text-[#b9c2cc] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {feedback && <span className="text-xs font-medium text-[#7de2f0]">{feedback}</span>}
        </div>

        {/* Recipes List */}
        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {recipes.map((recipe) => {
            const output = ITEMS[recipe.outputItemId];
            const check = canCraftRecipe(
              { inventory: rpg.inventory, crowns: rpg.crowns },
              recipe,
              activeStation
            );

            return (
              <div
                key={recipe.id}
                className="flex flex-col justify-between rounded-lg border border-white/10 bg-[#161c25] p-3.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#f1ede4]">
                        {output?.name ?? recipe.outputItemId}
                        {recipe.outputQty > 1 ? ` ×${recipe.outputQty}` : ''}
                      </h3>
                      <p className="text-[11px] text-[#d49b63]">{recipe.craftTimeLabel}</p>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-[#f2c484]">
                      {recipe.crownCost} Cr
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#aab4c0]">
                    {output?.description}
                  </p>
                  <div className="mt-2.5 space-y-1 text-xs">
                    {recipe.ingredients.map((ing) => {
                      const have = getItemCount(rpg.inventory, ing.itemId);
                      const enough = have >= ing.qty;
                      return (
                        <div key={ing.itemId} className="flex items-center justify-between">
                          <span className="text-[#c5ccd4]">
                            {ITEMS[ing.itemId]?.name ?? ing.itemId}
                          </span>
                          <span
                            className={`font-mono-tabular ${
                              enough ? 'text-[#8cd17d]' : 'text-[#f87171]'
                            }`}
                          >
                            {have}/{ing.qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-2.5">
                  <span className="text-[11px] text-[#8d99a6]">
                    {check.ok ? 'Ready to craft' : check.reason}
                  </span>
                  <button
                    type="button"
                    disabled={!check.ok}
                    onClick={() => {
                      const res = onCraft(recipe.id);
                      setFeedback(
                        res.crafted
                          ? `Crafted ${output?.name ?? 'item'}`
                          : res.reason ?? 'Cannot craft'
                      );
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      check.ok
                        ? 'bg-[#b67a4e] text-[#0f1318] hover:bg-[#ce8e5f]'
                        : 'cursor-not-allowed bg-white/8 text-white/35'
                    }`}
                  >
                    Craft
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 bg-[#131821] px-5 py-2.5 text-[11px] text-[#95a2b0]">
          Visit Copperwell Alchemy Bench (20, 8), Smelting Hall Forge (-72, 4), or Temple Ley-Shrine (-192, -12) for advanced recipes. Press [B] or [Esc] to close.
        </div>
      </div>
    </div>
  );
}
