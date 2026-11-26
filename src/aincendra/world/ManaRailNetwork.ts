export type RailStationId =
  | 'harbour'
  | 'temple'
  | 'manaworks'
  | 'merchant'
  | 'councils'
  | 'bastion';

export type RailLineId = 'coastal-viaduct' | 'inland-spur';

export interface RailStationSpec {
  id: RailStationId;
  name: string;
  shortName: string;
  district: string;
  line: RailLineId;
  lineLabel: string;
  dropOff: [number, number, number];
  kioskPos: [number, number, number];
  kioskYaw: number;
  mapX: number;
  mapY: number;
  summary: string;
}

export interface RailSegmentSpec {
  id: string;
  from: RailStationId;
  to: RailStationId;
  line: RailLineId;
  fare: number;
  distanceMeters: number;
  legTitle: string;
  /** Ordered SVG schematic waypoints from `from` -> `to` on a 760x440 viewBox */
  points: Array<[number, number]>;
}

export interface ComputedRailRoute {
  from: RailStationSpec;
  to: RailStationSpec;
  stops: RailStationSpec[];
  segments: Array<{
    segment: RailSegmentSpec;
    forward: boolean;
    points: Array<[number, number]>;
    legLabel: string;
  }>;
  totalFare: number;
  totalDistanceMeters: number;
  estimatedMinutes: number;
  svgPathD: string;
}

export const ALL_LINE_PASS_PRICE = 18;

export const RAIL_LINES: Record<
  RailLineId,
  { name: string; color: string; glowColor: string }
> = {
  'coastal-viaduct': {
    name: 'Coastal Viaduct Line',
    color: '#6ecad9',
    glowColor: '#a6f0fb',
  },
  'inland-spur': {
    name: 'Inland Exchange Spur',
    color: '#d29c6b',
    glowColor: '#f5cfa0',
  },
};

export const RAIL_STATIONS: RailStationSpec[] = [
  {
    id: 'harbour',
    name: 'Grand Harbour Viaduct Terminal',
    shortName: 'Harbour Quay',
    district: 'Grand Harbour Quay',
    line: 'coastal-viaduct',
    lineLabel: 'Coastal Viaduct Line',
    dropOff: [2.0, 0.16, -23.5],
    kioskPos: [6.4, -0.3, -27.2],
    kioskYaw: 0,
    mapX: 380,
    mapY: 78,
    summary: 'Elevated copper-conductor deck overlooking the three cargo piers and shipyards.',
  },
  {
    id: 'temple',
    name: 'Temple Quarter Cloister Stop',
    shortName: 'Temple Cloister',
    district: 'Temple Quarter Sanctuary',
    line: 'coastal-viaduct',
    lineLabel: 'Coastal Viaduct Line',
    dropOff: [-174.0, 0.16, 4.0],
    kioskPos: [-168.0, 0.16, 5.5],
    kioskYaw: -Math.PI / 2,
    mapX: 152,
    mapY: 102,
    summary: 'North-west sanctuary platform linking cathedral stone cloisters to the harbour viaduct.',
  },
  {
    id: 'manaworks',
    name: 'Mana Works & Freight Yard',
    shortName: 'Mana Freight Depot',
    district: 'Industrial Quarter & Mana Works',
    line: 'inland-spur',
    lineLabel: 'Inland Exchange Spur',
    dropOff: [-186.0, 0.16, 114.5],
    kioskPos: [-178.0, 0.16, 114.5],
    kioskYaw: 0,
    mapX: 128,
    mapY: 212,
    summary: 'Heavy traction switching yard beneath the twin condenser towers and rolling mill.',
  },
  {
    id: 'merchant',
    name: 'Grand Exchange Terminus',
    shortName: 'Grand Exchange',
    district: 'Merchant Quarter',
    line: 'inland-spur',
    lineLabel: 'Inland Exchange Spur',
    dropOff: [-14.0, 0.16, 200.0],
    kioskPos: [-18.5, 0.16, 198.0],
    kioskYaw: Math.PI / 2,
    mapX: 380,
    mapY: 288,
    summary: 'Central passenger exchange beside the Reserve Bank Clocktower and Compass Fountain.',
  },
  {
    id: 'councils',
    name: 'Council Heights Express Station',
    shortName: 'Council Heights',
    district: 'Administrative & Noble Heights',
    line: 'coastal-viaduct',
    lineLabel: 'Coastal Viaduct Line',
    dropOff: [192.0, 5.2, 18.5],
    kioskPos: [186.0, 5.2, 13.5],
    kioskYaw: 0,
    mapX: 626,
    mapY: 118,
    summary: 'Upper terrace express terminus serving the Three Councils Assembly Hall and Citadel.',
  },
  {
    id: 'bastion',
    name: 'Bastion Overland Railhead',
    shortName: 'Bastion Gate',
    district: 'Domain Overland Bastion Gate',
    line: 'inland-spur',
    lineLabel: 'Inland Exchange Spur',
    dropOff: [-8.5, 0.16, 314.0],
    kioskPos: [-13.5, 0.16, 315.5],
    kioskYaw: Math.PI / 2,
    mapX: 380,
    mapY: 386,
    summary: 'Southern domain gateway departing toward agricultural plains, mines, and emerald wilds.',
  },
];

export const RAIL_STATION_MAP: Record<RailStationId, RailStationSpec> = RAIL_STATIONS.reduce(
  (acc, st) => {
    acc[st.id] = st;
    return acc;
  },
  {} as Record<RailStationId, RailStationSpec>
);

export const RAIL_SEGMENTS: RailSegmentSpec[] = [
  {
    id: 'seg_temple_harbour',
    from: 'temple',
    to: 'harbour',
    line: 'coastal-viaduct',
    fare: 2,
    distanceMeters: 185,
    legTitle: 'West Quay Viaduct Span',
    points: [
      [152, 102],
      [212, 78],
      [380, 78],
    ],
  },
  {
    id: 'seg_harbour_councils',
    from: 'harbour',
    to: 'councils',
    line: 'coastal-viaduct',
    fare: 3,
    distanceMeters: 210,
    legTitle: 'East Harbour & Citadel Grade',
    points: [
      [380, 78],
      [548, 78],
      [626, 118],
    ],
  },
  {
    id: 'seg_temple_manaworks',
    from: 'temple',
    to: 'manaworks',
    line: 'inland-spur',
    fare: 2,
    distanceMeters: 130,
    legTitle: 'Refinery Substation Grade',
    points: [
      [152, 102],
      [128, 148],
      [128, 212],
    ],
  },
  {
    id: 'seg_manaworks_merchant',
    from: 'manaworks',
    to: 'merchant',
    line: 'inland-spur',
    fare: 3,
    distanceMeters: 225,
    legTitle: 'Grand Canal Aqueduct Span',
    points: [
      [128, 212],
      [196, 250],
      [310, 288],
      [380, 288],
    ],
  },
  {
    id: 'seg_merchant_councils',
    from: 'merchant',
    to: 'councils',
    line: 'inland-spur',
    fare: 3,
    distanceMeters: 280,
    legTitle: 'East Canal Switchback Ascent',
    points: [
      [380, 288],
      [524, 260],
      [598, 192],
      [626, 118],
    ],
  },
  {
    id: 'seg_merchant_bastion',
    from: 'merchant',
    to: 'bastion',
    line: 'inland-spur',
    fare: 2,
    distanceMeters: 125,
    legTitle: 'Overland Boulevard Express',
    points: [
      [380, 288],
      [380, 386],
    ],
  },
];

export function findNearestRailStation(x: number, z: number): RailStationSpec {
  let best = RAIL_STATIONS[0];
  let bestDistSq = Infinity;
  for (const st of RAIL_STATIONS) {
    const dx = st.dropOff[0] - x;
    const dz = st.dropOff[2] - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = st;
    }
  }
  return best;
}

export function pointsToSvgPath(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  const parts = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i][0]} ${points[i][1]}`);
  }
  return parts.join(' ');
}

export function computeRailRoute(
  fromId: RailStationId,
  toId: RailStationId
): ComputedRailRoute | null {
  const from = RAIL_STATION_MAP[fromId];
  const to = RAIL_STATION_MAP[toId];
  if (!from || !to || fromId === toId) return null;

  // Dijkstra by minimum fare (tie-break by distance)
  const distFare: Record<RailStationId, number> = {
    harbour: Infinity,
    temple: Infinity,
    manaworks: Infinity,
    merchant: Infinity,
    councils: Infinity,
    bastion: Infinity,
  };
  const distMeters: Record<RailStationId, number> = {
    harbour: Infinity,
    temple: Infinity,
    manaworks: Infinity,
    merchant: Infinity,
    councils: Infinity,
    bastion: Infinity,
  };
  const prevEdge: Partial<
    Record<RailStationId, { prev: RailStationId; segment: RailSegmentSpec; forward: boolean }>
  > = {};

  const visited = new Set<RailStationId>();
  distFare[fromId] = 0;
  distMeters[fromId] = 0;

  while (visited.size < RAIL_STATIONS.length) {
    let curr: RailStationId | null = null;
    for (const st of RAIL_STATIONS) {
      if (visited.has(st.id)) continue;
      if (
        curr === null ||
        distFare[st.id] < distFare[curr] ||
        (distFare[st.id] === distFare[curr] && distMeters[st.id] < distMeters[curr])
      ) {
        curr = st.id;
      }
    }
    if (!curr || distFare[curr] === Infinity) break;
    if (curr === toId) break;
    visited.add(curr);

    for (const seg of RAIL_SEGMENTS) {
      let neighbor: RailStationId | null = null;
      let forward = true;
      if (seg.from === curr) {
        neighbor = seg.to;
        forward = true;
      } else if (seg.to === curr) {
        neighbor = seg.from;
        forward = false;
      }
      if (!neighbor || visited.has(neighbor)) continue;

      const candFare = distFare[curr] + seg.fare;
      const candMeters = distMeters[curr] + seg.distanceMeters;
      if (
        candFare < distFare[neighbor] ||
        (candFare === distFare[neighbor] && candMeters < distMeters[neighbor])
      ) {
        distFare[neighbor] = candFare;
        distMeters[neighbor] = candMeters;
        prevEdge[neighbor] = { prev: curr, segment: seg, forward };
      }
    }
  }

  const orderedSegments: ComputedRailRoute['segments'] = [];
  let cursor: RailStationId = toId;
  while (cursor !== fromId) {
    const step = prevEdge[cursor];
    if (!step) return null;
    const pts = step.forward ? [...step.segment.points] : [...step.segment.points].reverse();
    orderedSegments.unshift({
      segment: step.segment,
      forward: step.forward,
      points: pts,
      legLabel: `${step.segment.legTitle} → ${RAIL_STATION_MAP[cursor].shortName}`,
    });
    cursor = step.prev;
  }

  const stops: RailStationSpec[] = [from];
  const combinedPoints: Array<[number, number]> = [];
  let totalFare = 0;
  let totalDistanceMeters = 0;

  for (let i = 0; i < orderedSegments.length; i++) {
    const item = orderedSegments[i];
    const endStationId = item.forward ? item.segment.to : item.segment.from;
    stops.push(RAIL_STATION_MAP[endStationId]);
    totalFare += item.segment.fare;
    totalDistanceMeters += item.segment.distanceMeters;

    for (let p = i === 0 ? 0 : 1; p < item.points.length; p++) {
      combinedPoints.push(item.points[p]);
    }
  }

  return {
    from,
    to,
    stops,
    segments: orderedSegments,
    totalFare: Math.max(2, totalFare),
    totalDistanceMeters,
    estimatedMinutes: Math.max(2, Math.round(totalDistanceMeters / 65)),
    svgPathD: pointsToSvgPath(combinedPoints),
  };
}
