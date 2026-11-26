import FastNoiseLite from 'fastnoise-lite';

export interface MaterialGraphMaps {
  width: number;
  height: number;
  heightField: Float32Array;
  roughnessField: Float32Array;
  aoField: Float32Array;
  normalData: Uint8Array;
}

export interface MaterialGraphOptions {
  size: number;
  seed: number;
  noiseScale: number;
  voronoiWeight: number;
  fbmWeight: number;
  normalStrength: number;
  minRoughness: number;
  maxRoughness: number;
}

/**
 * Material-Maker-inspired composable procedural PBR texture graph:
 * Combines OpenSimplex2 FBM + Cellular Voronoi + Domain Warp nodes to synthesize
 * height, ambient occlusion, calibrated roughness, and tangent-space normal maps.
 */
export function evaluateMaterialMakerGraph(opts: MaterialGraphOptions): MaterialGraphMaps {
  const w = opts.size;
  const h = opts.size;
  const count = w * h;
  const heightField = new Float32Array(count);
  const roughnessField = new Float32Array(count);
  const aoField = new Float32Array(count);
  const normalData = new Uint8Array(count * 4);

  const fbm = new FastNoiseLite(opts.seed);
  fbm.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  fbm.SetFractalType(FastNoiseLite.FractalType.FBm);
  fbm.SetFractalOctaves(4);
  fbm.SetFrequency(opts.noiseScale);

  const cell = new FastNoiseLite(opts.seed + 79);
  cell.SetNoiseType(FastNoiseLite.NoiseType.Cellular);
  cell.SetCellularDistanceFunction(FastNoiseLite.CellularDistanceFunction.Euclidean);
  cell.SetCellularReturnType(FastNoiseLite.CellularReturnType.Distance2Sub);
  cell.SetFrequency(opts.noiseScale * 1.45);

  const warpX = new FastNoiseLite(opts.seed + 157);
  warpX.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  warpX.SetFrequency(opts.noiseScale * 0.7);

  const warpY = new FastNoiseLite(opts.seed + 199);
  warpY.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  warpY.SetFrequency(opts.noiseScale * 0.7);

  // Tileable torus-mapped 2D sampling via periodic 4D-like blend approximation
  const totalWeight = Math.max(0.0001, opts.voronoiWeight + opts.fbmWeight);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Periodic blend across tile borders so maps remain seamless
      const u = x / w;
      const v = y / h;
      const sampleAt = (sx: number, sy: number) => {
        const px = sx + warpX.GetNoise(sx, sy) * 8.0;
        const py = sy + warpY.GetNoise(sx + 17.3, sy - 11.7) * 8.0;
        const f = (fbm.GetNoise(px, py) + 1) * 0.5;
        const c = Math.max(0, Math.min(1, cell.GetNoise(px, py) + 0.5));
        return (f * opts.fbmWeight + c * opts.voronoiWeight) / totalWeight;
      };

      const n00 = sampleAt(x, y);
      const n10 = sampleAt(x - w, y);
      const n01 = sampleAt(x, y - h);
      const n11 = sampleAt(x - w, y - h);
      const bx = u;
      const by = v;
      const nx0 = n00 * (1 - bx) + n10 * bx;
      const nx1 = n01 * (1 - bx) + n11 * bx;
      const val = Math.max(0, Math.min(1, nx0 * (1 - by) + nx1 * by));

      const idx = y * w + x;
      heightField[idx] = val;
      aoField[idx] = Math.max(0.28, Math.min(1, 0.35 + val * 0.65));
      roughnessField[idx] = Math.max(
        0.04,
        Math.min(1, opts.maxRoughness - val * (opts.maxRoughness - opts.minRoughness))
      );
    }
  }

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return heightField[wy * w + wx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * opts.normalStrength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * opts.normalStrength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const outIdx = (y * w + x) * 4;
      normalData[outIdx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData[outIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData[outIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData[outIdx + 3] = 255;
    }
  }

  return {
    width: w,
    height: h,
    heightField,
    roughnessField,
    aoField,
    normalData,
  };
}
