import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, LocateFixed, Maximize2 } from 'lucide-react';
import type { CameraMode } from '../aincendra/core/types';

interface ElarionMinimapProps {
  position: { x: number; y: number; z: number };
  yaw: number;
  cameraYaw: number;
  cameraMode: CameraMode;
  areaName: string;
  southGateOpen?: boolean;
  onTeleport?: (x: number, y: number, z: number) => void;
}

type MapViewMode = 'city' | 'zoom' | 'domain';

interface DistrictWaypoint {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
}

const DISTRICT_WAYPOINTS: DistrictWaypoint[] = [
  { id: 'wp_harbour', label: 'Harbour', x: 0, y: 0.16, z: 29 },
  { id: 'wp_temple', label: 'Temple', x: -180, y: 0.16, z: -2 },
  { id: 'wp_merchant', label: 'Trade', x: 0, y: 0.16, z: 192 },
  { id: 'wp_councils', label: 'Councils', x: 204, y: 5.2, z: 18.5 },
  { id: 'wp_gate', label: 'Gate', x: 0, y: 0.16, z: 320 },
];

// Full Metropolis + Outer Emerald Wilds Bounds (~920m x 780m playable world)
const MAP_MIN_X = -460;
const MAP_MAX_X = 460;
const MAP_MIN_Z = -102;
const MAP_MAX_Z = 678;
const MAP_SPAN_X = MAP_MAX_X - MAP_MIN_X; // 920m
const MAP_SPAN_Z = MAP_MAX_Z - MAP_MIN_Z; // 780m

const CANVAS_SIZE = 204;
const STATIC_SCALE = 2;

function buildStaticElarionMapCanvas(): HTMLCanvasElement {
  const w = CANVAS_SIZE * STATIC_SCALE;
  const h = CANVAS_SIZE * STATIC_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const worldSpan = Math.max(MAP_SPAN_X, MAP_SPAN_Z);
  const pxPerMeter = w / worldSpan;
  const offsetX = (w - MAP_SPAN_X * pxPerMeter) * 0.5;
  const offsetY = (h - MAP_SPAN_Z * pxPerMeter) * 0.5;

  const toX = (wx: number) => offsetX + (wx - MAP_MIN_X) * pxPerMeter;
  const toY = (wz: number) => offsetY + (wz - MAP_MIN_Z) * pxPerMeter;
  const rect = (minX: number, minZ: number, maxX: number, maxZ: number, fill: string, stroke?: string) => {
    const x = toX(minX);
    const y = toY(minZ);
    const rw = (maxX - minX) * pxPerMeter;
    const rh = (maxZ - minZ) * pxPerMeter;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, rw, rh);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, rw, rh);
    }
  };

  // 1. Deep Northern Sea + Outer Green Vaelcrest Wilds + City Landmass Backdrop
  ctx.fillStyle = '#0d1822';
  ctx.fillRect(0, 0, w, h);

  // Outer lush green meadows & woodland terrain (West/East wings + Southern Wilds)
  rect(-460, -44, 460, 678, '#29482f');

  // Southern Woodland Dirt Highway winding south from the Bastion Gate
  ctx.save();
  ctx.strokeStyle = '#8b7352';
  ctx.lineWidth = Math.max(3, 12 * pxPerMeter);
  ctx.beginPath();
  for (let wz = 333; wz <= 670; wz += 14) {
    const curveX = Math.sin((wz - 336) * 0.011) * 16;
    if (wz === 333) ctx.moveTo(toX(curveX), toY(wz));
    else ctx.lineTo(toX(curveX), toY(wz));
  }
  ctx.stroke();
  ctx.restore();

  // Countryside Emerald Glade Ponds
  for (const [px, pz, pr] of [
    [-88, 468, 22],
    [94, 522, 24],
  ]) {
    ctx.beginPath();
    ctx.arc(toX(px), toY(pz), pr * pxPerMeter, 0, Math.PI * 2);
    ctx.fillStyle = '#21596e';
    ctx.fill();
    ctx.strokeStyle = '#477a63';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Metropolis mainland landmass south of Harbour Quay / Temple / Citadel
  rect(-294, -44, 310, 336, '#181e26');

  // 2. Grand Harbour Quay & 3 Walkable Cargo Piers
  rect(-92, -62.5, 92, -26.0, '#363f48', '#52606e');
  rect(-35, -95.4, -21, -62.5, '#3b454f', '#586776');
  rect(-8, -87.4, 8, -62.5, '#3b454f', '#586776');
  rect(15, -95.4, 29, -62.5, '#3b454f', '#586776');

  // 3. Inner 5-District Port Pavements
  rect(-132, -22, -42, 50, '#2b3139');
  rect(-46, 52, 46, 84, '#41464d', '#5c636c');
  rect(-66, 84, 66, 120, '#3d424a', '#5c636c');
  rect(50.5, -12, 92, 84, '#534f47', '#7b7467');
  rect(82, -12, 135.5, 58, '#6c665a', '#9c9281');

  // 4. Outer Expansion Wards
  // Temple Quarter Sanctuary (NW)
  rect(-252, -42, -136, 14.5, '#47433c', '#7a7264');
  rect(-242, -36, -166, -4, '#6d6658', '#b67a4e');
  rect(-202, -26, -186, -14, '#24687a'); // Sacred Lotus Basin

  // Outer West Foundry Basin & Rail Yard
  rect(-288, 14, -132, 120, '#262b32', '#444e5a');
  // Grand Canal Basin (Z = 120..154)
  rect(-290, 120, 305, 154, '#1b4e63', '#397b94');
  // South Canal Promenade, Merchant Quarter & Residential Wards
  rect(-288, 154, 305, 166, '#3b414a');
  rect(-190, 166, 190, 336, '#363b43', '#525b66');

  // East Administrative & Noble Heights (y = 5.20 -> lower landing -> East Residential Estates)
  rect(135.5, -40, 305, 88, '#6f695d', '#a69c88');
  rect(112, 88, 305, 120, '#444b54');
  rect(175, 166, 302, 328, '#304338', '#4f6d5c'); // Residential Estates & Gardens
  rect(174, -19, 206, -3, '#24687a'); // Palace Reflecting Pool

  // 5. Cobble Road Arteries & 3 Walkable Stone Canal Bridges
  rect(-4.5, -22, 4.5, 120, '#4d545e'); // Harbourgate -> Merchant Plaza -> Canal
  rect(-286, 15, 38.5, 22, '#4d545e');  // Mana Works Blvd -> Foundry Row
  rect(-151, 22, -141, 120, '#4d545e'); // West Industrial Spur
  rect(100, 58, 112, 120, '#4d545e');   // East Canal Bridge Connector
  rect(136, 14.5, 228, 22.5, '#7e7668'); // Citadel Promenade
  rect(-8, 166, 8, 336, '#505761');     // Grand Overland Boulevard
  rect(-180, 204, 180, 220, '#505761'); // Exchange Cross Boulevard

  // 3 Walkable Canal Arch Bridges (highlighted warm stone)
  rect(-6.6, 120, 6.6, 154, '#8d785e', '#d29c6b');
  rect(-151.6, 120, -140.4, 154, '#8d785e', '#d29c6b');
  rect(100.4, 120, 111.6, 154, '#8d785e', '#d29c6b');

  // Elevated Railway Viaduct
  ctx.save();
  ctx.strokeStyle = '#b67a4e';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(toX(-134), toY(-34.5));
  ctx.lineTo(toX(134), toY(-34.5));
  ctx.stroke();
  ctx.restore();

  // 6. Key Monument & Landmark Building Footprints
  const landmarks: Array<[number, number, number, number, string?]> = [
    [-86, -57, -66, -43],
    [-61, -57, -39, -43],
    [33, -57, 55, -43],
    [62, -57, 84, -43],
    [-86, -3, -64, 11, '#4a3226'],
    [-62, 25, -44, 36, '#4a3226'],
    [56, -10, 78, 1, '#31545c'],
    [55, 37, 69, 51],
    [106, 10, 132, 34, '#857c6a'],
    // Outer Metropolis Landmarks
    [-238, -32, -213, -8, '#c27f4e'], // Temple Cathedral & Bell-Tower
    [-225, 37, -177, 71, '#3d332d'],  // Mechanical Rolling Mill
    [-221, 87, -167, 107, '#4a3931'], // Mana-Rail Freight Depot
    [-75, 241, -37, 267, '#4c5763'],  // Civic Polytechnic School
    [37, 241, 75, 267, '#4c5763'],    // Vaelcrest Reserve Bank & Clocktower
    [229, -11, 287, 49, '#9c8c72'],   // Three-Council Assembly Palace
  ];
  for (const [x0, z0, x1, z1, customFill] of landmarks) {
    rect(x0, z0, x1, z1, customFill ?? '#212932', '#4c5763');
  }

  // Twin Mana Condenser Towers
  for (const tz of [54, 88]) {
    ctx.beginPath();
    ctx.arc(toX(-255), toY(tz), 9 * pxPerMeter, 0, Math.PI * 2);
    ctx.fillStyle = '#333b45';
    ctx.fill();
    ctx.strokeStyle = '#6ecad9';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Open Grand Exchange Square & Maritime Compass Fountain Marker (0, 212)
  ctx.beginPath();
  ctx.arc(toX(0), toY(212), 5.2 * pxPerMeter, 0, Math.PI * 2);
  ctx.fillStyle = '#24687a';
  ctx.fill();
  ctx.strokeStyle = '#d29c6b';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return canvas;
}

function drawVaelcrestDomainAtlas(ctx: CanvasRenderingContext2D, size: number): void {
  // Deep coastal sea backdrop (~230,000 km2 domain territory: Karnataka + Kerala scale)
  ctx.fillStyle = '#0c1a27';
  ctx.fillRect(0, 0, size, size);

  // Vaelcrest Domain Coastal & Inland Territory Polygon
  ctx.beginPath();
  ctx.moveTo(size * 0.16, size * 0.14);
  ctx.lineTo(size * 0.58, size * 0.12); // Forested & Mountainous North
  ctx.lineTo(size * 0.78, size * 0.26); // Elarion Harbour headland
  ctx.lineTo(size * 0.71, size * 0.44);
  ctx.lineTo(size * 0.80, size * 0.64); // Southern Coastal Ports
  ctx.lineTo(size * 0.68, size * 0.88);
  ctx.lineTo(size * 0.30, size * 0.90);
  ctx.lineTo(size * 0.14, size * 0.62);
  ctx.closePath();
  ctx.fillStyle = '#1f2b33';
  ctx.fill();
  ctx.strokeStyle = '#4c6578';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Canonical Domain Regions (Coastal, Agricultural, Industrial, Mining, Forested/Mountainous)
  // Agricultural Heartland
  ctx.fillStyle = 'rgba(72, 114, 78, 0.42)';
  ctx.beginPath();
  ctx.ellipse(size * 0.44, size * 0.56, size * 0.19, size * 0.17, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Forested & Mountainous Uplands
  ctx.fillStyle = 'rgba(130, 120, 102, 0.38)';
  ctx.beginPath();
  ctx.ellipse(size * 0.36, size * 0.22, size * 0.18, size * 0.08, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Mana-Powered Railway & Road Network radiating from Elarion
  ctx.save();
  ctx.strokeStyle = '#b67a4e';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  const eX = size * 0.71;
  const eY = size * 0.32;
  for (const [tx, ty] of [
    [size * 0.46, size * 0.54], // Agricultural Heartland
    [size * 0.26, size * 0.40], // Mining & Mana Belt
    [size * 0.36, size * 0.22], // Forested Uplands
    [size * 0.60, size * 0.72], // Industrial Settlements
  ]) {
    ctx.beginPath();
    ctx.moveTo(eX, eY);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  ctx.restore();

  // Domain Regional Nodes
  const nodes: Array<{ x: number; y: number; name: string; primary?: boolean }> = [
    { x: 0.71, y: 0.32, name: 'ELARION (Metropolis)', primary: true },
    { x: 0.46, y: 0.54, name: 'Agricultural Plains' },
    { x: 0.26, y: 0.40, name: 'Mining & Mana Belt' },
    { x: 0.36, y: 0.21, name: 'Forested Highlands' },
    { x: 0.60, y: 0.72, name: 'Industrial Settlements' },
  ];

  ctx.textAlign = 'center';
  for (const n of nodes) {
    const nx = n.x * size;
    const ny = n.y * size;
    ctx.beginPath();
    ctx.arc(nx, ny, n.primary ? 4.2 : 2.6, 0, Math.PI * 2);
    ctx.fillStyle = n.primary ? '#f2b872' : '#7de2f0';
    ctx.fill();

    ctx.font = n.primary ? 'bold 8.5px sans-serif' : '600 7.5px sans-serif';
    ctx.fillStyle = n.primary ? '#fff3da' : '#b7cadb';
    ctx.fillText(n.name, nx, ny - 7);
  }

  // Scale Legend inside Domain Atlas (Karnataka + Kerala combined scale)
  ctx.fillStyle = 'rgba(15, 19, 24, 0.82)';
  ctx.fillRect(6, size - 24, size - 12, 18);
  ctx.font = '600 8px monospace';
  ctx.fillStyle = '#9fb2c2';
  ctx.textAlign = 'left';
  ctx.fillText('VAELCREST DOMAIN · ~230,000 km²', 10, size - 12);
}

export function ElarionMinimap({
  position,
  yaw,
  cameraYaw,
  cameraMode,
  areaName,
  southGateOpen = false,
  onTeleport,
}: ElarionMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>('city');

  const staticMapCanvas = useMemo(() => buildStaticElarionMapCanvas(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetPx = Math.round(CANVAS_SIZE * dpr);
    if (canvas.width !== targetPx || canvas.height !== targetPx) {
      canvas.width = targetPx;
      canvas.height = targetPx;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    if (viewMode === 'domain') {
      drawVaelcrestDomainAtlas(ctx, CANVAS_SIZE);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, CANVAS_SIZE - 1, CANVAS_SIZE - 1);
      ctx.restore();
      return;
    }

    ctx.fillStyle = '#0d1822';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const worldSpan = Math.max(MAP_SPAN_X, MAP_SPAN_Z);
    const basePxPerM = CANVAS_SIZE / worldSpan;
    const baseOffX = (CANVAS_SIZE - MAP_SPAN_X * basePxPerM) * 0.5;
    const baseOffY = (CANVAS_SIZE - MAP_SPAN_Z * basePxPerM) * 0.5;

    const playerBaseX = baseOffX + (position.x - MAP_MIN_X) * basePxPerM;
    const playerBaseY = baseOffY + (position.z - MAP_MIN_Z) * basePxPerM;

    const zoomed = viewMode === 'zoom';
    const zoom = zoomed ? 2.6 : 1.0;

    ctx.save();
    if (zoomed) {
      const half = CANVAS_SIZE * 0.5;
      const minCenter = half / zoom;
      const maxCenter = CANVAS_SIZE - half / zoom;
      const cx = Math.max(minCenter, Math.min(maxCenter, playerBaseX));
      const cy = Math.max(minCenter, Math.min(maxCenter, playerBaseY));
      ctx.translate(half, half);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
    }

    ctx.drawImage(staticMapCanvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Live Bastion Gate bar indicator at (0, 333)
    const gateX = baseOffX + (0 - MAP_MIN_X) * basePxPerM;
    const gateY = baseOffY + (333 - MAP_MIN_Z) * basePxPerM;
    ctx.fillStyle = southGateOpen ? '#78cf70' : '#d4844a';
    ctx.fillRect(gateX - 12 * basePxPerM, gateY - 1.5, 24 * basePxPerM, 3);

    if (zoomed) {
      ctx.strokeStyle = 'rgba(182, 122, 78, 0.18)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(playerBaseX, playerBaseY, 30 * basePxPerM, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Camera FOV Cone
    const coneLen = zoomed ? 13 : 19;
    const coneHalfAngle = 0.52;
    ctx.save();
    ctx.translate(playerBaseX, playerBaseY);
    ctx.rotate(-cameraYaw);
    const coneGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, coneLen);
    coneGrad.addColorStop(0, 'rgba(110, 202, 217, 0.40)');
    coneGrad.addColorStop(1, 'rgba(110, 202, 217, 0.0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneLen, -Math.PI * 0.5 - coneHalfAngle, -Math.PI * 0.5 + coneHalfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Player Orientation Chevron
    const markerAngle = cameraMode === 'first-person' ? -cameraYaw : Math.PI - yaw;
    const markerScale = zoomed ? 0.56 : 0.88;

    ctx.save();
    ctx.translate(playerBaseX, playerBaseY);
    ctx.rotate(markerAngle);
    ctx.scale(markerScale, markerScale);

    ctx.fillStyle = '#0a0e13';
    ctx.beginPath();
    ctx.moveTo(0, -8.5);
    ctx.lineTo(6.2, 6.2);
    ctx.lineTo(0, 3.2);
    ctx.lineTo(-6.2, 6.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f2b872';
    ctx.strokeStyle = '#fff4de';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.6, 4.6);
    ctx.lineTo(0, 2.2);
    ctx.lineTo(-4.6, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, CANVAS_SIZE - 1, CANVAS_SIZE - 1);

    ctx.restore();
  }, [position.x, position.z, yaw, cameraYaw, cameraMode, viewMode, southGateOpen, staticMapCanvas]);

  const cycleViewMode = () => {
    setViewMode((prev) => (prev === 'city' ? 'zoom' : prev === 'zoom' ? 'domain' : 'city'));
  };

  return (
    <aside
      aria-label="Elarion Metropolis & Vaelcrest Domain Map"
      className="pointer-events-auto relative flex flex-col rounded-lg border border-white/14 bg-[#0f1318]/92 p-2 shadow-xl"
    >
      {/* Header strip */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-[#e7e5df] truncate max-w-[134px]">
          {viewMode === 'domain' ? 'Vaelcrest Domain' : areaName}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cycleViewMode();
          }}
          title="Cycle: Metropolis 1× · Local 2× · Vaelcrest Domain Atlas"
          aria-label="Cycle Map Scale"
          className="flex items-center gap-1 rounded border border-white/12 bg-[#171d24] px-1.5 py-0.5 text-[10px] font-medium text-[#c7c4bc] transition-colors hover:border-[#b67a4e]/70 hover:text-white"
        >
          {viewMode === 'city' && <LocateFixed className="h-2.5 w-2.5" />}
          {viewMode === 'zoom' && <Maximize2 className="h-2.5 w-2.5" />}
          {viewMode === 'domain' && <Globe className="h-2.5 w-2.5 text-[#7de2f0]" />}
          <span>{viewMode === 'city' ? '1×' : viewMode === 'zoom' ? '2×' : 'Domain'}</span>
        </button>
      </div>

      {/* Minimap / Domain Canvas */}
      <div className="relative h-[204px] w-[204px] overflow-hidden rounded border border-white/10">
        <canvas ref={canvasRef} className="block h-[204px] w-[204px]" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 rounded bg-[#0f1318]/85 px-1 text-[9px] font-bold tracking-wider text-[#b67a4e]"
        >
          N
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-semibold text-white/45"
        >
          S
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-semibold text-white/45"
        >
          W
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-semibold text-white/45"
        >
          E
        </span>
      </div>

      {/* Quick District Transit Bar */}
      {onTeleport && (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          {DISTRICT_WAYPOINTS.map((wp) => (
            <button
              key={wp.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (viewMode === 'domain') setViewMode('city');
                onTeleport(wp.x, wp.y, wp.z);
              }}
              title={`Fast-Travel to ${wp.label}`}
              className="flex-1 rounded border border-white/10 bg-[#171d24] px-1 py-0.5 text-[9px] font-medium text-[#c7c4bc] transition-colors hover:border-[#b67a4e]/70 hover:text-white"
            >
              {wp.label}
            </button>
          ))}
        </div>
      )}

      {/* Coordinate & Elevation Footer */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#9fb2c2] font-mono-tabular">
        <span>
          X {position.x.toFixed(0)} · Z {position.z.toFixed(0)}
        </span>
        <span>Y {position.y.toFixed(1)}m</span>
      </div>
    </aside>
  );
}
