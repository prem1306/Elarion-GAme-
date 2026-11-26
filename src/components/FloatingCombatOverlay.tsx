import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { DummyStatusReadout, FloatingCombatPopup } from '../aincendra/core/types';

export interface CombatOverlayPayload {
  popups: FloatingCombatPopup[];
  dummies: DummyStatusReadout[];
}

export interface FloatingCombatOverlayHandle {
  updateCombatOverlay: (payload: CombatOverlayPayload) => void;
}

export const FloatingCombatOverlay = forwardRef<FloatingCombatOverlayHandle>(
  function FloatingCombatOverlay(_props, ref) {
    const [popupSpecs, setPopupSpecs] = useState<FloatingCombatPopup[]>([]);
    const [dummySpecs, setDummySpecs] = useState<DummyStatusReadout[]>([]);

    const popupSigRef = useRef('');
    const dummySigRef = useRef('');

    const popupNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dummyNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dummyFillRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dummyPoiseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dummyHpTextRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

    const latestPopupsRef = useRef<Map<string, FloatingCombatPopup>>(new Map());
    const latestDummiesRef = useRef<Map<string, DummyStatusReadout>>(new Map());

    const applyPopup = (el: HTMLDivElement, p: FloatingCombatPopup) => {
      el.style.transform = `translate3d(${p.screenX.toFixed(1)}px, ${p.screenY.toFixed(1)}px, 0) translate(-50%, -50%) scale(${p.scale.toFixed(2)})`;
      el.style.opacity = p.opacity.toFixed(3);
    };

    const applyDummy = (id: string, d: DummyStatusReadout) => {
      const el = dummyNodeRefs.current.get(id);
      if (el) {
        el.style.transform = `translate3d(${d.screenX.toFixed(1)}px, ${d.screenY.toFixed(1)}px, 0) translate(-50%, -100%)`;
        el.style.opacity = d.opacity.toFixed(3);
      }
      const fillEl = dummyFillRefs.current.get(id);
      if (fillEl) {
        const pct = Math.max(0, Math.min(100, (d.hp / Math.max(1, d.maxHp)) * 100));
        fillEl.style.width = `${pct.toFixed(1)}%`;
      }
      const poiseEl = dummyPoiseRefs.current.get(id);
      if (poiseEl && d.maxPoise && d.maxPoise > 0) {
        const poisePct = d.staggered
          ? 100
          : Math.max(0, Math.min(100, ((d.poise ?? d.maxPoise) / d.maxPoise) * 100));
        poiseEl.style.width = `${poisePct.toFixed(1)}%`;
        poiseEl.style.backgroundColor = d.staggered ? '#fbbf24' : '#d49b63';
      }
      const hpEl = dummyHpTextRefs.current.get(id);
      if (hpEl) {
        hpEl.textContent = d.staggered ? 'STAGGER!' : d.hp > 0 ? `${d.hp}/${d.maxHp}` : 'Resetting';
      }
    };

    useImperativeHandle(ref, () => ({
      updateCombatOverlay({ popups, dummies }: CombatOverlayPayload) {
        latestPopupsRef.current.clear();
        let pSig = '';
        for (let i = 0; i < popups.length; i++) {
          const p = popups[i];
          latestPopupsRef.current.set(p.id, p);
          pSig += `${p.id}|`;
          const el = popupNodeRefs.current.get(p.id);
          if (el) applyPopup(el, p);
        }
        if (pSig !== popupSigRef.current) {
          popupSigRef.current = pSig;
          setPopupSpecs(popups);
        }

        latestDummiesRef.current.clear();
        let dSig = '';
        for (let i = 0; i < dummies.length; i++) {
          const d = dummies[i];
          latestDummiesRef.current.set(d.id, d);
          dSig += `${d.id}|`;
          applyDummy(d.id, d);
        }
        if (dSig !== dummySigRef.current) {
          dummySigRef.current = dSig;
          setDummySpecs(dummies);
        }
      },
    }));

    if (popupSpecs.length === 0 && dummySpecs.length === 0) {
      return null;
    }

    return (
      <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden select-none">
        {dummySpecs.map((spec) => (
          <div
            key={spec.id}
            ref={(el) => {
              if (el) {
                dummyNodeRefs.current.set(spec.id, el);
                const latest = latestDummiesRef.current.get(spec.id) ?? spec;
                applyDummy(spec.id, latest);
              } else {
                dummyNodeRefs.current.delete(spec.id);
              }
            }}
            className="pointer-events-none fixed left-0 top-0 flex flex-col items-center rounded-md border border-white/15 bg-[#0f1318]/90 px-2 py-1 shadow-lg will-change-transform"
          >
            <div className="flex items-center justify-between gap-2.5 text-[10px] whitespace-nowrap">
              <span className="font-semibold text-[#ede6d8]">{spec.name}</span>
              <span
                ref={(el) => {
                  if (el) dummyHpTextRefs.current.set(spec.id, el);
                  else dummyHpTextRefs.current.delete(spec.id);
                }}
                className="font-mono-tabular text-[#c88a4b]"
              >
                {spec.hp}/{spec.maxHp}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-sm bg-[#1f262e]">
              <div
                ref={(el) => {
                  if (el) {
                    dummyFillRefs.current.set(spec.id, el);
                    const latest = latestDummiesRef.current.get(spec.id) ?? spec;
                    applyDummy(spec.id, latest);
                  } else {
                    dummyFillRefs.current.delete(spec.id);
                  }
                }}
                className="h-full bg-[#c95343] transition-all duration-100"
              />
            </div>
            {spec.maxPoise && spec.maxPoise > 0 && (
              <div className="mt-0.5 h-1 w-28 overflow-hidden rounded-sm bg-[#1f262e]">
                <div
                  ref={(el) => {
                    if (el) {
                      dummyPoiseRefs.current.set(spec.id, el);
                      const latest = latestDummiesRef.current.get(spec.id) ?? spec;
                      applyDummy(spec.id, latest);
                    } else {
                      dummyPoiseRefs.current.delete(spec.id);
                    }
                  }}
                  className="h-full bg-[#d49b63] transition-all duration-100"
                />
              </div>
            )}
          </div>
        ))}

        {popupSpecs.map((spec) => (
          <div
            key={spec.id}
            ref={(el) => {
              if (el) {
                popupNodeRefs.current.set(spec.id, el);
                const latest = latestPopupsRef.current.get(spec.id) ?? spec;
                applyPopup(el, latest);
              } else {
                popupNodeRefs.current.delete(spec.id);
              }
            }}
            className={`pointer-events-none fixed left-0 top-0 font-mono-tabular font-bold tracking-wide whitespace-nowrap drop-shadow-md will-change-transform ${
              spec.isCritical
                ? 'text-base text-[#7de2f0]'
                : 'text-sm text-[#f4c382]'
            }`}
          >
            {spec.text}
          </div>
        ))}
      </div>
    );
  }
);
