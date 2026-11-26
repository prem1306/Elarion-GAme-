import { useEffect } from 'react';

interface TitleOverlayProps {
  hasSavedGame: boolean;
  onStartNew: () => void;
  onContinueSaved: () => void;
}

export function TitleOverlay({
  hasSavedGame,
  onStartNew,
  onContinueSaved,
}: TitleOverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (hasSavedGame) {
          onContinueSaved();
        } else {
          onStartNew();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSavedGame, onStartNew, onContinueSaved]);

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-8 sm:p-14"
      style={{
        background:
          'linear-gradient(95deg, rgba(11,15,21,0.92) 0%, rgba(11,15,21,0.72) 38%, rgba(11,15,21,0.18) 72%, rgba(11,15,21,0.08) 100%)',
      }}
    >
      <div className="h-4" />

      {/* Left-third negative-space anchor with bespoke inline SVG crest & title lockup */}
      <div className="max-w-[520px]">
        <svg
          viewBox="0 0 420 112"
          className="w-full max-w-[420px]"
          aria-label="Aincendra: Chronicles of Elarion"
        >
          {/* Runic Gear & Ley-Crystal Crest */}
          <g transform="translate(52, 56)">
            <circle cx="0" cy="0" r="42" fill="#141a23" stroke="#b67a4e" strokeWidth="2.5" />
            <circle cx="0" cy="0" r="34" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
            <path
              d="M0 -48 L5 -40 L-5 -40 Z M0 48 L5 40 L-5 40 Z M48 0 L40 5 L40 -5 Z M-48 0 L-40 5 L-40 -5 Z"
              fill="#d49b63"
            />
            <polygon
              points="0,-24 16,0 0,24 -16,0"
              fill="#0ea5e9"
              fillOpacity="0.22"
              stroke="#6ee3f5"
              strokeWidth="2.2"
            />
            <polygon points="0,-14 8,0 0,14 -8,0" fill="#7de2f0" />
          </g>

          <text
            x="114"
            y="50"
            fill="#f5efe3"
            fontFamily="Georgia, serif"
            fontSize="36"
            fontWeight="700"
            letterSpacing="3"
          >
            AINCENDRA
          </text>
          <line x1="114" y1="62" x2="395" y2="62" stroke="#b67a4e" strokeWidth="1.5" />
          <text
            x="115"
            y="84"
            fill="#8cd8e6"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="13"
            fontWeight="600"
            letterSpacing="4.2"
          >
            CHRONICLES OF ELARION
          </text>
        </svg>

        <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-[#cfd5dd]">
          Master Thermal-Aether spells, runesmith arms at Elarion’s forges, shape Three-Council
          alliances, and unbar the South Bastion Gate to confront the Crystal Wyrm.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {hasSavedGame ? (
            <>
              <button
                type="button"
                data-start="true"
                onClick={onContinueSaved}
                className="rounded-lg border border-[#d49b63] bg-[#b67a4e] px-6 py-3 text-sm font-semibold tracking-wide text-[#0f1318] shadow-lg transition-colors hover:bg-[#cb8b5b] focus-visible:outline-2 focus-visible:outline-[#f5efe3] whitespace-nowrap shrink-0"
              >
                Continue Journey
              </button>
              <button
                type="button"
                onClick={onStartNew}
                className="rounded-lg border border-white/20 bg-[#151b23]/90 px-5 py-3 text-sm font-medium text-[#e8e3d9] transition-colors hover:border-[#b67a4e] hover:text-white whitespace-nowrap shrink-0"
              >
                New Expedition
              </button>
            </>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onStartNew}
              className="rounded-lg border border-[#d49b63] bg-[#b67a4e] px-7 py-3 text-sm font-semibold tracking-wide text-[#0f1318] shadow-lg transition-colors hover:bg-[#cb8b5b] focus-visible:outline-2 focus-visible:outline-[#f5efe3] whitespace-nowrap shrink-0"
            >
              Enter Elarion
            </button>
          )}
        </div>
      </div>

      {/* Single flat, borderless inline control hint */}
      <div className="text-xs tracking-wide text-[#aeb7c2]">
        WASD Move · Space Jump/Vault · LMB/F Sabre · R Cleave · 1-4 Spells · G Vent · RMB Guard/Parry · B Craft · J Quests · P Pause
      </div>
    </div>
  );
}
