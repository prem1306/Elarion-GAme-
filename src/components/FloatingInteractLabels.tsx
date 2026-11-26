import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { FloatingInteractLabel } from '../aincendra/core/types';

export interface FloatingInteractLabelsHandle {
  updateLabels: (labels: FloatingInteractLabel[]) => void;
}

export const FloatingInteractLabels = forwardRef<FloatingInteractLabelsHandle>(
  function FloatingInteractLabels(_props, ref) {
    const [activeSpecs, setActiveSpecs] = useState<FloatingInteractLabel[]>([]);
    const signatureRef = useRef('');
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const latestLabelsRef = useRef<Map<string, FloatingInteractLabel>>(new Map());

    const applyPosition = (el: HTMLDivElement, label: FloatingInteractLabel) => {
      el.style.transform = `translate3d(${label.screenX.toFixed(1)}px, ${label.screenY.toFixed(1)}px, 0) translate(-50%, -100%)`;
      el.style.opacity = label.opacity.toFixed(3);
    };

    useImperativeHandle(ref, () => ({
      updateLabels(labels: FloatingInteractLabel[]) {
        latestLabelsRef.current.clear();
        let sig = '';
        for (let i = 0; i < labels.length; i++) {
          const l = labels[i];
          latestLabelsRef.current.set(l.id, l);
          sig += `${l.id}:${l.isPrimary ? '1' : '0'}|`;
          const el = nodeRefs.current.get(l.id);
          if (el) {
            applyPosition(el, l);
          }
        }

        if (sig !== signatureRef.current) {
          signatureRef.current = sig;
          setActiveSpecs(labels);
        }
      },
    }));

    if (activeSpecs.length === 0) {
      return null;
    }

    return (
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-0 z-10 overflow-hidden select-none"
      >
        {activeSpecs.map((spec) => {
          const accentTextClass = spec.pickable
            ? 'text-[#7de2f0]'
            : spec.category === 'Citizen'
              ? 'text-[#e6b385]'
              : 'text-[#b8c7d4]';

          return (
            <div
              key={spec.id}
              ref={(el) => {
                if (el) {
                  nodeRefs.current.set(spec.id, el);
                  const latest = latestLabelsRef.current.get(spec.id) ?? spec;
                  applyPosition(el, latest);
                } else {
                  nodeRefs.current.delete(spec.id);
                }
              }}
              className="pointer-events-none fixed left-0 top-0 flex flex-col items-center will-change-transform"
            >
              {spec.isPrimary ? (
                <>
                  <div className="rounded-lg border border-[#e6b385]/85 bg-[#0f1318]/94 px-2.5 py-1.5 shadow-xl">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#f5d3ac]/70 bg-[#b67a4e] font-mono-tabular text-[11px] font-bold text-[#0f1318]">
                        E
                      </span>
                      <span className="text-xs font-semibold tracking-wide text-[#f7f2e8]">
                        Press E to Interact
                      </span>
                    </div>
                    <div className={`mt-0.5 text-[11px] font-medium whitespace-nowrap ${accentTextClass}`}>
                      {spec.promptAction} · {spec.title}
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="-mt-1 h-2 w-2 rotate-45 border-b border-r border-[#e6b385]/85 bg-[#0f1318]"
                  />
                </>
              ) : (
                <>
                  <div className="rounded-md border border-white/22 bg-[#0f1318]/86 px-2 py-1 shadow-lg">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-white/25 bg-[#1b222b] font-mono-tabular text-[10px] font-semibold text-[#e6b385]">
                        E
                      </span>
                      <span className="text-[11px] font-medium text-[#e7e5df]">
                        Press E to Interact
                      </span>
                    </div>
                    <div className={`mt-0.5 text-[10px] whitespace-nowrap opacity-90 ${accentTextClass}`}>
                      {spec.title}
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="-mt-1 h-1.5 w-1.5 rotate-45 border-b border-r border-white/22 bg-[#0f1318]"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);
