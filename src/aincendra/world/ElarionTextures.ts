import * as THREE from 'three';
import { evaluateMaterialMakerGraph } from './MaterialMakerGraph';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a tileable tangent-space normal map (NoColorSpace) from a grayscale heightfield canvas
 * using a Sobel 3x3 gradient filter so cobblestone, masonry, brick, and timber catch crisp directional highlights.
 */
function buildNormalMapFromHeightCanvas(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.DataTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const ctx = heightCanvas.getContext('2d', { willReadFrequently: true })!;
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
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

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Derives a PBR roughness map from a heightfield canvas: deeper mortar crevices are rougher (240),
 * raised worn stone crowns or polished timber ridges are smoother (minRough..maxRough).
 */
function buildRoughnessCanvasFromHeight(
  heightCanvas: HTMLCanvasElement,
  minRough: number,
  maxRough: number
): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const [rCanvas, rCtx] = makeCanvas(w, h);
  const src = heightCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const img = rCtx.createImageData(w, h);
  const dst = img.data;

  for (let i = 0; i < src.length; i += 4) {
    const heightNorm = src[i] / 255;
    const rough = Math.round((maxRough - heightNorm * (maxRough - minRough)) * 255);
    dst[i] = rough;
    dst[i + 1] = rough;
    dst[i + 2] = rough;
    dst[i + 3] = 255;
  }
  rCtx.putImageData(img, 0, 0);
  return rCanvas;
}

export interface SurfaceTexturePair {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Material-Maker-style procedural mineral/mossy terrain rock PBR set built via composable noise graphs.
 */
export function createMaterialMakerTerrainTexturePair(
  maxAnisotropy: number,
  repeatX = 36,
  repeatY = 36
): SurfaceTexturePair {
  const size = 256;
  const maps = evaluateMaterialMakerGraph({
    size,
    seed: 901,
    noiseScale: 0.048,
    voronoiWeight: 0.35,
    fbmWeight: 0.65,
    normalStrength: 2.2,
    minRoughness: 0.72,
    maxRoughness: 0.96,
  });

  const [albedoCanvas, aCtx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);
  const [roughCanvas, rCtx] = makeCanvas(size, size);
  const aImg = aCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const hVal = maps.heightField[i];
    const ao = maps.aoField[i];
    const rVal = Math.round(maps.roughnessField[i] * 255);
    const pIdx = i * 4;

    aImg.data[pIdx] = Math.round((128 + hVal * 44) * ao);
    aImg.data[pIdx + 1] = Math.round((152 + hVal * 48) * ao);
    aImg.data[pIdx + 2] = Math.round((102 + hVal * 32) * ao);
    aImg.data[pIdx + 3] = 255;

    const bByte = Math.round(hVal * 255);
    bImg.data[pIdx] = bByte;
    bImg.data[pIdx + 1] = bByte;
    bImg.data[pIdx + 2] = bByte;
    bImg.data[pIdx + 3] = 255;

    rImg.data[pIdx] = rVal;
    rImg.data[pIdx + 1] = rVal;
    rImg.data[pIdx + 2] = rVal;
    rImg.data[pIdx + 3] = 255;
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const normalMap = new THREE.DataTexture(maps.normalData, size, size, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeatX, repeatY);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.generateMipmaps = true;
  normalMap.anisotropy = Math.min(8, maxAnisotropy);
  normalMap.needsUpdate = true;

  return {
    map: finalizeTexture(albedoCanvas, repeatX, repeatY, Math.min(8, maxAnisotropy), true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, Math.min(8, maxAnisotropy), false),
    normalMap,
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, Math.min(8, maxAnisotropy), false),
  };
}

function addSurfaceNoise(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, alpha = 0.05): void {
  for (let i = 0; i < count; i++) {
    const x = (i * 97 + 13) % w;
    const y = (i * 53 + 29) % h;
    const sz = (i % 3) + 1;
    ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.45})`;
    ctx.fillRect(x, y, sz, sz);
  }
}

function addMineralVeinPass(ctx: CanvasRenderingContext2D, w: number, h: number, veins: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  for (let v = 0; v < veins; v++) {
    let px = ((v * 149) % w);
    let py = ((v * 89) % h);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let s = 0; s < 5; s++) {
      px += ((v * 23 + s * 37) % 34) - 12;
      py += ((v * 19 + s * 41) % 28) - 14;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function createCobbleTexturePair(maxAnisotropy: number, repeatX = 4, repeatY = 18): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#252930';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#1e1e1e';
  bCtx.fillRect(0, 0, size, size);

  const rows = 14;
  const cols = 10;
  const rowH = size / rows;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const seed = (r * 37 + (c + 3) * 19) % 29;
      const shade = 58 + seed * 1.45;
      const warm = seed % 3 === 0 ? 8 : seed % 5 === 0 ? -5 : 2;
      const x = c * colW + offset + 2.5;
      const y = r * rowH + 2.5;
      const cw = colW - 5;
      const ch = rowH - 5;

      const grad = ctx.createLinearGradient(x, y, x, y + ch);
      grad.addColorStop(0, `rgb(${Math.round(shade + warm + 15)}, ${Math.round(shade + 12)}, ${Math.round(shade + 16)})`);
      grad.addColorStop(0.55, `rgb(${Math.round(shade + warm)}, ${Math.round(shade + 3)}, ${Math.round(shade + 7)})`);
      grad.addColorStop(1, `rgb(${Math.round(shade + warm - 12)}, ${Math.round(shade - 9)}, ${Math.round(shade - 5)})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 6);
      ctx.fill();

      ctx.strokeStyle = 'rgba(14, 16, 20, 0.58)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const bGrad = bCtx.createRadialGradient(x + cw * 0.5, y + ch * 0.44, 2, x + cw * 0.5, y + ch * 0.5, cw * 0.68);
      bGrad.addColorStop(0, `rgb(${210 + seed}, ${210 + seed}, ${210 + seed})`);
      bGrad.addColorStop(0.7, 'rgb(155, 155, 155)');
      bGrad.addColorStop(1, 'rgb(45, 45, 45)');
      bCtx.fillStyle = bGrad;
      bCtx.beginPath();
      bCtx.roundRect(x, y, cw, ch, 6);
      bCtx.fill();
    }
  }

  addSurfaceNoise(ctx, size, size, 3200, 0.055);
  addSurfaceNoise(bCtx, size, size, 2400, 0.065);
  addMineralVeinPass(ctx, size, size, 12, 'rgba(210, 218, 224, 0.08)');

  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.64, 0.94);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 2.8, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

export function createPavementTexturePair(maxAnisotropy: number, repeatX = 2, repeatY = 14): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#52565c';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, size, size);

  const step = 128;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const v = ((x * 13 + y * 29) % 21) - 10;
      const grad = ctx.createLinearGradient(x, y, x + step, y + step);
      grad.addColorStop(0, `rgb(${132 + v}, ${128 + v}, ${122 + v})`);
      grad.addColorStop(1, `rgb(${118 + v}, ${115 + v}, ${109 + v})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 3, y + 3, step - 6, step - 6);

      ctx.strokeStyle = 'rgba(255, 250, 240, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + step - 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.lineTo(x + step - 4, y + 4);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(28, 30, 34, 0.52)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, step - 3, step - 3);

      bCtx.fillStyle = `rgb(${192 + v}, ${192 + v}, ${192 + v})`;
      bCtx.fillRect(x + 4, y + 4, step - 8, step - 8);
    }
  }

  addSurfaceNoise(ctx, size, size, 2800, 0.045);
  addSurfaceNoise(bCtx, size, size, 2000, 0.055);
  addMineralVeinPass(ctx, size, size, 14, 'rgba(30, 32, 36, 0.10)');

  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.68, 0.92);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 2.3, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

export function createSandstoneTexturePair(maxAnisotropy: number, repeatX = 2, repeatY = 2): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#756b5e';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#383838';
  bCtx.fillRect(0, 0, size, size);

  const rowH = 64;
  const colW = 128;
  for (let r = 0; r < 8; r++) {
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c < 5; c++) {
      const delta = ((r * 19 + (c + 3) * 23) % 24) - 12;
      const bx = c * colW + offset + 2;
      const by = r * rowH + 2;
      const bw = colW - 4;
      const bh = rowH - 4;

      const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
      grad.addColorStop(0, `rgb(${168 + delta}, ${157 + delta}, ${139 + delta})`);
      grad.addColorStop(0.5, `rgb(${156 + delta}, ${146 + delta}, ${129 + delta})`);
      grad.addColorStop(1, `rgb(${141 + delta}, ${131 + delta}, ${115 + delta})`);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);

      // Sedimentary grain striations
      ctx.fillStyle = 'rgba(255, 248, 232, 0.06)';
      ctx.fillRect(bx + 2, by + 12, bw - 4, 3);
      ctx.fillStyle = 'rgba(48, 40, 30, 0.08)';
      ctx.fillRect(bx + 2, by + 36, bw - 4, 2);

      ctx.strokeStyle = 'rgba(52, 46, 38, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);

      bCtx.fillStyle = `rgb(${182 + delta}, ${182 + delta}, ${182 + delta})`;
      bCtx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
    }
  }

  addSurfaceNoise(ctx, size, size, 3000, 0.048);
  addSurfaceNoise(bCtx, size, size, 2200, 0.06);

  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.72, 0.94);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 2.4, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

export function createBrickTexturePair(maxAnisotropy: number, repeatX = 2, repeatY = 2): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#4a433e';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#2c2c2c';
  bCtx.fillRect(0, 0, size, size);

  const rowH = 32;
  const colW = 64;
  for (let r = 0; r < 16; r++) {
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c < 9; c++) {
      const d = ((r * 17 + (c + 2) * 31) % 28) - 14;
      const soot = ((r * 7 + c * 11) % 9) === 0 ? -16 : 0;
      const bx = c * colW + offset + 2;
      const by = r * rowH + 2;
      const grad = ctx.createLinearGradient(bx, by, bx, by + rowH - 4);
      grad.addColorStop(0, `rgb(${116 + d + soot}, ${68 + Math.round(d * 0.6) + soot}, ${56 + Math.round(d * 0.5) + soot})`);
      grad.addColorStop(1, `rgb(${98 + d + soot}, ${58 + Math.round(d * 0.6) + soot}, ${48 + Math.round(d * 0.5) + soot})`);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, colW - 4, rowH - 4);

      bCtx.fillStyle = `rgb(${188 + d}, ${188 + d}, ${188 + d})`;
      bCtx.fillRect(bx, by, colW - 4, rowH - 4);
    }
  }

  addSurfaceNoise(ctx, size, size, 2800, 0.055);
  addSurfaceNoise(bCtx, size, size, 1800, 0.065);

  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.76, 0.96);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 2.7, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

export function createPlankTexturePair(maxAnisotropy: number, repeatX = 2, repeatY = 2): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#3f2c1f';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#323232';
  bCtx.fillRect(0, 0, size, size);

  const plankH = 64;
  for (let r = 0; r < 8; r++) {
    const d = ((r * 23) % 20) - 10;
    const grad = ctx.createLinearGradient(0, r * plankH + 2, 0, r * plankH + plankH - 2);
    grad.addColorStop(0, `rgb(${106 + d}, ${78 + d}, ${56 + d})`);
    grad.addColorStop(1, `rgb(${90 + d}, ${66 + d}, ${47 + d})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, r * plankH + 2, size, plankH - 4);
    bCtx.fillStyle = `rgb(${176 + d}, ${176 + d}, ${176 + d})`;
    bCtx.fillRect(0, r * plankH + 2, size, plankH - 4);

    ctx.strokeStyle = 'rgba(30, 18, 10, 0.34)';
    ctx.lineWidth = 1.6;
    bCtx.strokeStyle = 'rgba(92, 92, 92, 0.48)';
    bCtx.lineWidth = 1.6;
    for (let g = 0; g < 5; g++) {
      const gy = r * plankH + 8 + g * 12;
      ctx.beginPath();
      bCtx.beginPath();
      ctx.moveTo(0, gy);
      bCtx.moveTo(0, gy);
      for (let wx = 48; wx <= size; wx += 48) {
        const wy = gy + Math.sin(wx * 0.025 + r * 1.4 + g) * 2.5;
        ctx.lineTo(wx, wy);
        bCtx.lineTo(wx, wy);
      }
      ctx.stroke();
      bCtx.stroke();
    }

    const joinX = ((r * 137 + 80) % 380) + 64;
    ctx.fillStyle = '#201712';
    ctx.fillRect(joinX - 1, r * plankH + 2, 2, plankH - 4);
    ctx.fillRect(joinX + 6, r * plankH + 14, 4, 4);
    ctx.fillRect(joinX + 6, r * plankH + plankH - 18, 4, 4);
  }

  addSurfaceNoise(ctx, size, size, 1600, 0.035);
  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.62, 0.88);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 2.2, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

export function createRoofSlateTexturePair(maxAnisotropy: number, repeatX = 3, repeatY = 2): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#222a34';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#343434';
  bCtx.fillRect(0, 0, size, size);

  const rowH = 48;
  const colW = 48;
  const rows = Math.ceil(size / rowH);
  const cols = Math.ceil(size / colW);
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const d = ((r * 11 + (c + 1) * 19) % 18) - 9;
      const sx = c * colW + offset + 1.5;
      const sy = r * rowH + 1.5;

      const grad = ctx.createLinearGradient(sx, sy, sx, sy + rowH - 3);
      grad.addColorStop(0, `rgb(${54 + d}, ${65 + d}, ${78 + d})`);
      grad.addColorStop(1, `rgb(${38 + d}, ${47 + d}, ${58 + d})`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, colW - 3, rowH - 3);

      const bGrad = bCtx.createLinearGradient(sx, sy, sx, sy + rowH - 3);
      bGrad.addColorStop(0, 'rgb(120, 120, 120)');
      bGrad.addColorStop(1, 'rgb(212, 212, 212)');
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(sx, sy, colW - 3, rowH - 3);
    }
  }

  addSurfaceNoise(ctx, size, size, 1800, 0.04);
  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.56, 0.84);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 2.5, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

/**
 * Ornate marble & sandstone inlaid floor pattern for the Temple Quarter, Merchant Exchange, and Three-Council Assembly Hall.
 */
export function createMarbleInlayTexturePair(maxAnisotropy: number, repeatX = 6, repeatY = 6): SurfaceTexturePair {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#ddd5c5';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#bcbcbc';
  bCtx.fillRect(0, 0, size, size);

  const tile = 128;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const alt = ((x + y) / tile) % 2 === 0;
      ctx.fillStyle = alt ? '#e4ddd0' : '#cfc4b1';
      ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);

      // Diamond terracotta/copper inlay center
      ctx.fillStyle = alt ? '#b8825a' : '#58747c';
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.5, y + 18);
      ctx.lineTo(x + tile - 18, y + tile * 0.5);
      ctx.lineTo(x + tile * 0.5, y + tile - 18);
      ctx.lineTo(x + 18, y + tile * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(72, 62, 48, 0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);

      bCtx.fillStyle = '#c8c8c8';
      bCtx.fillRect(x + 4, y + 4, tile - 8, tile - 8);
      bCtx.fillStyle = '#b0b0b0';
      bCtx.beginPath();
      bCtx.moveTo(x + tile * 0.5, y + 18);
      bCtx.lineTo(x + tile - 18, y + tile * 0.5);
      bCtx.lineTo(x + tile * 0.5, y + tile - 18);
      bCtx.lineTo(x + 18, y + tile * 0.5);
      bCtx.closePath();
      bCtx.fill();
    }
  }

  addSurfaceNoise(ctx, size, size, 1800, 0.03);
  addMineralVeinPass(ctx, size, size, 16, 'rgba(255, 252, 245, 0.16)');
  const roughCanvas = buildRoughnessCanvasFromHeight(bumpCanvas, 0.32, 0.72);

  return {
    map: finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy, true),
    bumpMap: finalizeTexture(bumpCanvas, repeatX, repeatY, maxAnisotropy, false),
    normalMap: buildNormalMapFromHeightCanvas(bumpCanvas, 1.8, repeatX, repeatY, maxAnisotropy),
    roughnessMap: finalizeTexture(roughCanvas, repeatX, repeatY, maxAnisotropy, false),
  };
}

export function createWaterBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const nx = (x / size) * Math.PI * 2;
      const ny = (y / size) * Math.PI * 2;
      const w1 = Math.sin(nx * 4 + Math.cos(ny * 3));
      const w2 = Math.cos(ny * 5 - nx * 2);
      const w3 = Math.sin((nx + ny) * 7) * 0.35;
      const val = Math.round(128 + (w1 * 0.48 + w2 * 0.38 + w3 * 0.14) * 52);
      ctx.fillStyle = `rgb(${val},${val},${val})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  return finalizeTexture(canvas, 34, 34, maxAnisotropy, false);
}

// Legacy helper wrappers
export function createCobbleTexture(maxAnisotropy: number, repeatX = 4, repeatY = 18): THREE.CanvasTexture {
  return createCobbleTexturePair(maxAnisotropy, repeatX, repeatY).map;
}
export function createPavementTexture(maxAnisotropy: number, repeatX = 2, repeatY = 14): THREE.CanvasTexture {
  return createPavementTexturePair(maxAnisotropy, repeatX, repeatY).map;
}
export function createSandstoneTexture(maxAnisotropy: number, repeatX = 2, repeatY = 2): THREE.CanvasTexture {
  return createSandstoneTexturePair(maxAnisotropy, repeatX, repeatY).map;
}
export function createBrickTexture(maxAnisotropy: number, repeatX = 2, repeatY = 2): THREE.CanvasTexture {
  return createBrickTexturePair(maxAnisotropy, repeatX, repeatY).map;
}
export function createPlankTexture(maxAnisotropy: number, repeatX = 2, repeatY = 2): THREE.CanvasTexture {
  return createPlankTexturePair(maxAnisotropy, repeatX, repeatY).map;
}
export function createRoofSlateTexture(maxAnisotropy: number, repeatX = 3, repeatY = 2): THREE.CanvasTexture {
  return createRoofSlateTexturePair(maxAnisotropy, repeatX, repeatY).map;
}

export function createSignTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  borderHex: string,
  textHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 256);

  for (let y = 0; y < 256; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.035)';
    ctx.fillRect(0, y, 512, 4);
  }

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, 484, 228);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 460, 204);

  ctx.fillStyle = borderHex;
  for (const [rx, ry] of [
    [34, 34],
    [478, 34],
    [34, 222],
    [478, 222],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = textHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.fillText(title, 256, 108);

  ctx.font = '600 21px sans-serif';
  ctx.fillStyle = borderHex;
  ctx.fillText(subtitle, 256, 166);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
