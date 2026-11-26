import { Shield, X } from 'lucide-react';
import { ITEMS } from '../aincendra/rpg/craftingData';
import type { RpgHudSnapshot } from '../aincendra/rpg/rpgTypes';

interface InventoryModalProps {
  open: boolean;
  rpg: RpgHudSnapshot;
  onEquip: (itemId: string) => void;
  onUseItem: (itemId: string) => void;
  onClose: () => void;
}

export function InventoryModal({
  open,
  rpg,
  onEquip,
  onUseItem,
  onClose,
}: InventoryModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Equipment & Backpack"
    >
      <div className="flex max-h-[86vh] w-full max-w-[720px] flex-col rounded-xl border border-[#b67a4e]/55 bg-[#10151c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#d49b63]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[#f4efe4]">
                Armory &amp; Satchel
              </h2>
              <p className="font-mono-tabular text-xs text-[#9cb0c2]">
                Level {rpg.level} · ATK {rpg.attackPower} · SPELL +{rpg.spellPower} · ARM {rpg.armorRating}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Inventory"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-[#171d26] text-[#c7c4bc] hover:border-[#b67a4e] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Equipped Loadout */}
        <div className="grid grid-cols-1 gap-2.5 border-b border-white/10 bg-[#141a23] px-5 py-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-[#181f29] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#9cb0c2]">Weapon</div>
            <div className="mt-0.5 text-xs font-semibold text-[#f1ede4]">
              {rpg.equippedWeaponName}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#181f29] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#9cb0c2]">Armor</div>
            <div className="mt-0.5 text-xs font-semibold text-[#f1ede4]">
              {rpg.equippedArmorName}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#181f29] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#9cb0c2]">Aether Relic</div>
            <div className="mt-0.5 text-xs font-semibold text-[#7de2f0]">
              {rpg.equippedRelicName ?? 'None Equipped'}
            </div>
          </div>
        </div>

        {/* Inventory Items */}
        <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-5 sm:grid-cols-2">
          {rpg.inventory.map((entry) => {
            const def = ITEMS[entry.itemId];
            if (!def) return null;
            const isEquip =
              def.category === 'weapon' || def.category === 'armor' || def.category === 'relic';
            const isEquipped =
              rpg.equippedWeaponName === def.name ||
              rpg.equippedArmorName === def.name ||
              rpg.equippedRelicName === def.name;
            const isConsumable = def.category === 'consumable';

            return (
              <div
                key={entry.itemId}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#161c25] px-3.5 py-2.5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#f1ede4]">{def.name}</span>
                    <span className="font-mono-tabular text-xs text-[#7de2f0]">×{entry.qty}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#9aa5b1]">{def.description}</p>
                </div>

                {isEquip && (
                  <button
                    type="button"
                    disabled={isEquipped}
                    onClick={() => onEquip(def.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      isEquipped
                        ? 'bg-white/10 text-[#8cd17d]'
                        : 'bg-[#b67a4e] text-[#0f1318] hover:bg-[#ce8e5f]'
                    }`}
                  >
                    {isEquipped ? 'Equipped' : 'Equip'}
                  </button>
                )}

                {isConsumable && (
                  <button
                    type="button"
                    onClick={() => onUseItem(def.id)}
                    className="rounded-md bg-[#226e84] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2a86a1] whitespace-nowrap shrink-0"
                  >
                    Use
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
