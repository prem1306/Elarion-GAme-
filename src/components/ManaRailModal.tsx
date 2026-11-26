import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Coins, Ticket, TrainFront, X } from 'lucide-react';
import {
  ALL_LINE_PASS_PRICE,
  RAIL_LINES,
  RAIL_SEGMENTS,
  RAIL_STATION_MAP,
  RAIL_STATIONS,
  computeRailRoute,
  pointsToSvgPath,
  type RailStationId,
} from '../aincendra/world/ManaRailNetwork';

interface ManaRailModalProps {
  open: boolean;
  originStationId: RailStationId;
  crowns: number;
  tickets: Record<RailStationId, number>;
  dayPassActive: boolean;
  onClose: () => void;
  onBuyTicket: (stationId: RailStationId, fare: number) => boolean;
  onBuyDayPass: () => boolean;
  onDepart: (
    destinationId: RailStationId,
    useTicket: boolean,
    fareIfBuying: number
  ) => boolean;
  onArrivalTeleport: (x: number, y: number, z: number) => void;
}

interface TrainPose {
  x: number;
  y: number;
  angleDeg: number;
  progress: number;
  drawnLength: number;
  totalLength: number;
  speedKmh: number;
  legIndex: number;
}

const TRANSIT_DURATION_MS = 2350;

export function ManaRailModal({
  open,
  originStationId,
  crowns,
  tickets,
  dayPassActive,
  onClose,
  onBuyTicket,
  onBuyDayPass,
  onDepart,
  onArrivalTeleport,
}: ManaRailModalProps) {
  const [selectedDestId, setSelectedDestId] = useState<RailStationId>(() =>
    originStationId === 'merchant' ? 'harbour' : 'merchant'
  );
  const [transitRouteKey, setTransitRouteKey] = useState<string | null>(null);
  const [trainPose, setTrainPose] = useState<TrainPose | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRoutePathRef = useRef<SVGPathElement | null>(null);
  const rafRef = useRef<number>(0);

  // Keep selected destination distinct from origin when modal opens
  useEffect(() => {
    if (!open) {
      cancelAnimationFrame(rafRef.current);
      setTransitRouteKey(null);
      setTrainPose(null);
      setNotice(null);
      return;
    }
    if (selectedDestId === originStationId) {
      const fallback = RAIL_STATIONS.find((s) => s.id !== originStationId)?.id ?? 'merchant';
      setSelectedDestId(fallback);
    }
  }, [open, originStationId, selectedDestId]);

  const originStation = RAIL_STATION_MAP[originStationId];
  const destStation = RAIL_STATION_MAP[selectedDestId];
  const route = useMemo(
    () => computeRailRoute(originStationId, selectedDestId),
    [originStationId, selectedDestId]
  );

  const isTraveling = transitRouteKey !== null;
  const heldTickets = tickets[selectedDestId] ?? 0;
  const routeFare = route?.totalFare ?? 2;
  const canBoardWithHeld = dayPassActive || heldTickets > 0;
  const canAffordFare = crowns >= routeFare;

  // Drive smooth animated locomotive + glowing mana conduit pulse during transit
  useEffect(() => {
    if (!transitRouteKey || !route) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finishTravel = () => {
      onArrivalTeleport(
        route.to.dropOff[0],
        route.to.dropOff[1],
        route.to.dropOff[2]
      );
      setTransitRouteKey(null);
      setTrainPose(null);
      onClose();
    };

    if (prefersReducedMotion) {
      const timer = window.setTimeout(finishTravel, 280);
      return () => window.clearTimeout(timer);
    }

    const pathEl = activeRoutePathRef.current;
    const totalLength = pathEl ? Math.max(1, pathEl.getTotalLength()) : 200;
    const startTime = performance.now();

    const step = (now: number) => {
      const rawT = Math.min(1, (now - startTime) / TRANSIT_DURATION_MS);
      // Smooth ease-in-out acceleration & braking curve
      const easedT =
        rawT < 0.5
          ? 4 * rawT * rawT * rawT
          : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      const dist = easedT * totalLength;
      let px = route.from.mapX;
      let py = route.from.mapY;
      let angleDeg = 0;

      if (pathEl) {
        const pt = pathEl.getPointAtLength(dist);
        const ptAhead = pathEl.getPointAtLength(Math.min(totalLength, dist + 3.5));
        const ptBehind = pathEl.getPointAtLength(Math.max(0, dist - 3.5));
        px = pt.x;
        py = pt.y;
        angleDeg = (Math.atan2(ptAhead.y - ptBehind.y, ptAhead.x - ptBehind.x) * 180) / Math.PI;
      }

      const speedKmh = Math.round(Math.sin(rawT * Math.PI) * 96);
      const legIndex = Math.min(
        route.segments.length - 1,
        Math.floor(easedT * route.segments.length)
      );

      setTrainPose({
        x: px,
        y: py,
        angleDeg,
        progress: easedT,
        drawnLength: dist,
        totalLength,
        speedKmh,
        legIndex,
      });

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        window.setTimeout(finishTravel, 180);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [transitRouteKey, route, onArrivalTeleport, onClose]);

  if (!open) return null;

  const handleBuySingle = () => {
    if (isTraveling || !route) return;
    if (onBuyTicket(selectedDestId, route.totalFare)) {
      setNotice(`Purchased ticket to ${destStation.shortName} (${route.totalFare} Cr).`);
    } else {
      setNotice('Insufficient Vaelcrest Crowns for this ticket.');
    }
  };

  const handleBoard = () => {
    if (isTraveling || !route) return;
    const ok = onDepart(selectedDestId, canBoardWithHeld, route.totalFare);
    if (!ok) {
      setNotice('Insufficient Vaelcrest Crowns to board this line.');
      return;
    }
    setNotice(null);
    setTransitRouteKey(`${route.from.id}-${route.to.id}-${Date.now()}`);
  };

  const handleBuyPass = () => {
    if (isTraveling || dayPassActive) return;
    if (onBuyDayPass()) {
      setNotice('All-District Rail Pass activated across all six terminals.');
    } else {
      setNotice(`Need ${ALL_LINE_PASS_PRICE} Cr for an All-District Rail Pass.`);
    }
  };

  const currentLegLabel =
    trainPose && route
      ? route.segments[trainPose.legIndex]?.legLabel ?? `Arriving at ${route.to.shortName}`
      : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mana-rail-heading"
      onClick={(e) => {
        e.stopPropagation();
        if (!isTraveling && e.target === e.currentTarget) onClose();
      }}
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#090d12]/80 p-4"
    >
      <div className="w-full max-w-[980px] rounded-xl border border-[#b67a4e]/45 bg-[#0f1318] p-5 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
          <div>
            <h2
              id="mana-rail-heading"
              className="font-display text-lg font-bold tracking-wide text-[#f1ede4]"
            >
              Elarion Mana-Rail Network
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#9fb2c2]">
              <span>Origin: {originStation.shortName}</span>
              <span className="text-white/25" aria-hidden="true">·</span>
              <span className="font-mono-tabular text-[#f2c484]">
                Purse: {crowns} Crowns
              </span>
              <span className="text-white/25" aria-hidden="true">·</span>
              <span className={dayPassActive ? 'text-[#8cd17d]' : 'text-[#c7c4bc]'}>
                {dayPassActive ? 'All-District Day Pass Active' : 'Standard Tariff'}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isTraveling}
            onClick={onClose}
            aria-label="Close Mana-Rail map"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-[#171d24] text-[#c7c4bc] transition-colors hover:border-[#b67a4e]/75 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#b67a4e]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main 2-Column Network Map + Ticket Console */}
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Column: Schematic Elarion Rail Map & Animated Transit Viewport */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#121820]">
              <svg
                viewBox="0 0 760 440"
                className="block h-auto w-full select-none"
                role="img"
                aria-label="Schematic map of Elarion Mana-Rail lines and district stations"
              >
                <defs>
                  <filter id="manaGlow" x="-25%" y="-25%" width="150%" height="150%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Cartographic Backdrop: Bay, Canal & Southern Emerald Wilds */}
                <rect x="0" y="0" width="760" height="440" fill="#131922" />
                <rect x="0" y="0" width="760" height="62" fill="#0d2130" />
                <line x1="0" y1="62" x2="760" y2="62" stroke="#2d5066" strokeWidth="1.5" />

                {/* Harbour Pier Silhouettes */}
                <rect x="330" y="34" width="12" height="28" fill="#25303b" />
                <rect x="374" y="38" width="14" height="24" fill="#25303b" />
                <rect x="418" y="34" width="12" height="28" fill="#25303b" />

                {/* Grand Canal Shipping Basin */}
                <rect x="0" y="238" width="760" height="24" fill="#133a4c" />
                <line x1="0" y1="238" x2="760" y2="238" stroke="#2a627a" strokeWidth="1" />
                <line x1="0" y1="262" x2="760" y2="262" stroke="#2a627a" strokeWidth="1" />

                {/* Canal Bridge Crossings */}
                <rect x="190" y="236" width="14" height="28" fill="#3a332b" />
                <rect x="373" y="236" width="14" height="28" fill="#3a332b" />
                <rect x="520" y="236" width="14" height="28" fill="#3a332b" />

                {/* Southern Emerald Wilds Horizon */}
                <rect x="0" y="402" width="760" height="38" fill="#192d20" />
                <line x1="0" y1="402" x2="760" y2="402" stroke="#3c6244" strokeWidth="1.2" />

                {/* Subtle Survey Grid */}
                {[190, 380, 570].map((gx) => (
                  <line
                    key={`gx-${gx}`}
                    x1={gx}
                    y1={0}
                    x2={gx}
                    y2={440}
                    stroke="#ffffff"
                    strokeOpacity="0.05"
                    strokeDasharray="3 5"
                  />
                ))}
                {[145, 325].map((gy) => (
                  <line
                    key={`gy-${gy}`}
                    x1={0}
                    y1={gy}
                    x2={760}
                    y2={gy}
                    stroke="#ffffff"
                    strokeOpacity="0.05"
                    strokeDasharray="3 5"
                  />
                ))}

                {/* Water & Territory Labels */}
                <text x="16" y="24" fill="#5e87a1" fontSize="10" fontFamily="monospace">
                  VAELCREST HARBOUR BAY
                </text>
                <text x="16" y="254" fill="#5aa1bc" fontSize="9.5" fontFamily="monospace">
                  GRAND CANAL LOCKS
                </text>
                <text x="16" y="424" fill="#70a173" fontSize="9.5" fontFamily="monospace">
                  SOUTHERN EMERALD WILDS
                </text>

                {/* Base Rail Network Tracks */}
                {RAIL_SEGMENTS.map((seg) => {
                  const d = pointsToSvgPath(seg.points);
                  const lineMeta = RAIL_LINES[seg.line];
                  return (
                    <g key={seg.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke="#202833"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={lineMeta.color}
                        strokeOpacity="0.38"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}

                {/* Selected Route Preview & Animated Mana-Line Pulse */}
                {route && (
                  <g>
                    <path
                      ref={activeRoutePathRef}
                      d={route.svgPathD}
                      fill="none"
                      stroke="#7de2f0"
                      strokeOpacity={isTraveling ? 0.32 : 0.72}
                      strokeWidth="4"
                      strokeDasharray={isTraveling ? undefined : '8 6'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {isTraveling && trainPose && (
                      <>
                        {/* Illuminated surge trail behind locomotive */}
                        <path
                          d={route.svgPathD}
                          fill="none"
                          stroke="#9ff3ff"
                          strokeWidth="5.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#manaGlow)"
                          strokeDasharray={trainPose.totalLength}
                          strokeDashoffset={
                            trainPose.totalLength - trainPose.drawnLength
                          }
                        />

                        {/* Expanding mana conduit ring around locomotive */}
                        <circle
                          cx={trainPose.x}
                          cy={trainPose.y}
                          r={14}
                          fill="none"
                          stroke="#7de2f0"
                          strokeOpacity="0.5"
                          strokeWidth="1.5"
                        />

                        {/* Articulated Mana-Locomotive Marker */}
                        <g
                          transform={`translate(${trainPose.x}, ${trainPose.y}) rotate(${trainPose.angleDeg})`}
                        >
                          <rect
                            x="-13"
                            y="-6.5"
                            width="26"
                            height="13"
                            rx="4"
                            fill="#b67a4e"
                            stroke="#fff4de"
                            strokeWidth="1.5"
                          />
                          <rect
                            x="-6"
                            y="-3.5"
                            width="11"
                            height="7"
                            rx="2"
                            fill="#7de2f0"
                          />
                          <polygon points="10,-5 17,0 10,5" fill="#fff4de" />
                        </g>
                      </>
                    )}
                  </g>
                )}

                {/* Interactive District Stations */}
                {RAIL_STATIONS.map((st) => {
                  const isOrigin = st.id === originStationId;
                  const isSelected = st.id === selectedDestId;
                  const onRoute = route?.stops.some((stop) => stop.id === st.id) ?? false;
                  const heldCount = tickets[st.id] ?? 0;

                  const labelRight = st.mapX < 520;
                  const labelOffsetY = st.id === 'harbour' ? -18 : st.id === 'bastion' ? -18 : 4;
                  const labelX =
                    st.id === 'harbour' || st.id === 'bastion'
                      ? st.mapX
                      : labelRight
                        ? st.mapX + 16
                        : st.mapX - 16;
                  const textAnchor =
                    st.id === 'harbour' || st.id === 'bastion'
                      ? 'middle'
                      : labelRight
                        ? 'start'
                        : 'end';

                  return (
                    <g
                      key={st.id}
                      role="button"
                      tabIndex={isOrigin || isTraveling ? -1 : 0}
                      aria-label={`Select ${st.name}`}
                      onClick={() => {
                        if (!isOrigin && !isTraveling) {
                          setSelectedDestId(st.id);
                          setNotice(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isOrigin && !isTraveling) {
                          e.preventDefault();
                          setSelectedDestId(st.id);
                          setNotice(null);
                        }
                      }}
                      style={{ cursor: isOrigin || isTraveling ? 'default' : 'pointer' }}
                    >
                      {/* Outer Selection Halo */}
                      {(isSelected || isOrigin) && (
                        <circle
                          cx={st.mapX}
                          cy={st.mapY}
                          r={isSelected ? 14 : 12}
                          fill="none"
                          stroke={isOrigin ? '#8cd17d' : '#f2c484'}
                          strokeWidth="1.6"
                        />
                      )}

                      {/* Station Diamond / Disc */}
                      <circle
                        cx={st.mapX}
                        cy={st.mapY}
                        r={9}
                        fill={
                          isOrigin
                            ? '#8cd17d'
                            : isSelected
                              ? '#f2c484'
                              : onRoute
                                ? '#7de2f0'
                                : '#1e2733'
                        }
                        stroke={
                          isOrigin || isSelected || onRoute
                            ? '#0f1318'
                            : RAIL_LINES[st.line].color
                        }
                        strokeWidth="2.4"
                      />

                      {/* Held Ticket Counter Dot on Station */}
                      {heldCount > 0 && !isOrigin && (
                        <g transform={`translate(${st.mapX + 9}, ${st.mapY - 10})`}>
                          <rect
                            x="-7"
                            y="-7"
                            width="14"
                            height="14"
                            rx="3"
                            fill="#6ecad9"
                            stroke="#0f1318"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="3.5"
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="700"
                            fill="#0f1318"
                          >
                            {heldCount}
                          </text>
                        </g>
                      )}

                      <text
                        x={labelX}
                        y={st.mapY + labelOffsetY}
                        textAnchor={textAnchor}
                        fontSize="11.5"
                        fontWeight={isSelected || isOrigin ? '700' : '600'}
                        fill={
                          isOrigin
                            ? '#a9e39b'
                            : isSelected
                              ? '#fff0d4'
                              : '#d9d5cc'
                        }
                      >
                        {st.shortName}
                      </text>
                      {isOrigin && (
                        <text
                          x={labelX}
                          y={st.mapY + labelOffsetY + 12}
                          textAnchor={textAnchor}
                          fontSize="9.5"
                          fill="#8cd17d"
                        >
                          Current Station
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Animated Transit Status Strip */}
              {isTraveling && trainPose && route && (
                <div className="border-t border-[#7de2f0]/30 bg-[#101822] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-medium text-[#9ff3ff]">
                      <TrainFront className="h-4 w-4 shrink-0" />
                      <span>{currentLegLabel}</span>
                    </div>
                    <div className="font-mono-tabular text-[#d9d5cc] whitespace-nowrap">
                      {trainPose.speedKmh} km/h · 840 V · {Math.round(trainPose.progress * 100)}%
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#7de2f0]"
                      style={{ width: `${Math.round(trainPose.progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Line Legend */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9fb2c2]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1 w-5 rounded bg-[#6ecad9]" />
                  <span>Coastal Viaduct Line</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1 w-5 rounded bg-[#d29c6b]" />
                  <span>Inland Exchange Spur</span>
                </span>
              </div>
              <span>Click any station node to plot route</span>
            </div>
          </div>

          {/* Right Column: Ticket Desk & Boarding Controls */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              {/* Destination Overview */}
              <div className="border-b border-white/10 pb-3.5">
                <div className="text-xs text-[#b67a4e]">
                  {destStation.lineLabel} · {destStation.district}
                </div>
                <h3 className="mt-0.5 font-display text-base font-semibold text-[#f1ede4]">
                  {destStation.name}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#c7c4bc]">
                  {destStation.summary}
                </p>
              </div>

              {/* Route Breakdown */}
              {route && (
                <div className="space-y-2.5 border-b border-white/10 pb-3.5 text-xs">
                  <div className="flex items-center justify-between text-[#9fb2c2]">
                    <span>Route Itinerary</span>
                    <span className="font-mono-tabular text-[#e7e5df]">
                      {route.totalDistanceMeters} m · ~{route.estimatedMinutes} min
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[#e7e5df]">
                    {route.stops.map((stop, idx) => (
                      <span key={stop.id} className="inline-flex items-center gap-1.5">
                        <span
                          className={
                            idx === 0
                              ? 'text-[#8cd17d]'
                              : idx === route.stops.length - 1
                                ? 'font-semibold text-[#f2c484]'
                                : 'text-[#7de2f0]'
                          }
                        >
                          {stop.shortName}
                        </span>
                        {idx < route.stops.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-white/35" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fare & Ticket Wallet */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#9fb2c2]">Single Ride Tariff</span>
                  <span className="font-mono-tabular text-sm font-semibold text-[#f2c484]">
                    {routeFare} Crowns
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9fb2c2]">Tickets Held for Station</span>
                  <span className="font-mono-tabular text-[#7de2f0]">
                    {dayPassActive ? 'Unlimited (Day Pass)' : `${heldTickets} Ticket${heldTickets === 1 ? '' : 's'}`}
                  </span>
                </div>
              </div>

              {notice && (
                <div className="rounded-lg border border-[#b67a4e]/40 bg-[#171d24] px-3 py-2 text-xs text-[#f2d7b4]">
                  {notice}
                </div>
              )}
            </div>

            {/* Ticket Purchase & Boarding Actions */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isTraveling || !canAffordFare || dayPassActive}
                  onClick={handleBuySingle}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#171d24] px-3 py-2.5 text-xs font-medium text-[#e7e5df] transition-colors hover:border-[#b67a4e]/75 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Ticket className="h-3.5 w-3.5 text-[#7de2f0]" />
                  <span>Buy Ticket ({routeFare} Cr)</span>
                </button>

                <button
                  type="button"
                  disabled={isTraveling || (!canBoardWithHeld && !canAffordFare)}
                  onClick={handleBoard}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#b67a4e] px-3 py-2.5 text-xs font-semibold text-[#0f1318] transition-colors hover:bg-[#cb8a5a] disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <TrainFront className="h-3.5 w-3.5" />
                  <span>
                    {isTraveling
                      ? 'In Transit...'
                      : dayPassActive
                        ? 'Board (Day Pass)'
                        : heldTickets > 0
                          ? 'Board (Use Ticket)'
                          : `Buy & Board (${routeFare} Cr)`}
                  </span>
                </button>
              </div>

              {/* All-District Pass Upsell */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#141a22] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#f1ede4]">
                    All-District Rail Pass
                  </div>
                  <div className="text-[11px] text-[#9fb2c2]">
                    Unlimited rides across all 6 Elarion stations
                  </div>
                </div>
                {dayPassActive ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#8cd17d] whitespace-nowrap shrink-0">
                    <Check className="h-3.5 w-3.5" />
                    <span>Active</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isTraveling || crowns < ALL_LINE_PASS_PRICE}
                    onClick={handleBuyPass}
                    className="flex items-center gap-1 rounded-md border border-[#b67a4e]/60 bg-[#1c232d] px-2.5 py-1.5 text-xs font-medium text-[#f2c484] transition-colors hover:bg-[#b67a4e] hover:text-[#0f1318] disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Coins className="h-3 w-3" />
                    <span>{ALL_LINE_PASS_PRICE} Cr</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
