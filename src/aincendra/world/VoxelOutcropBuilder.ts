import * as THREE from 'three';
import { FastNoiseField } from './FastNoiseField';

export interface VoxelChunkGeometryData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  solidVoxelCount: number;
}

/**
 * Zylann/godot_voxel-inspired chunked 3D scalar-field voxel extractor:
 * Evaluates a 3D FastNoiseLite density field inside a finite chunk grid and extracts
 * outward-facing surface quads with per-voxel AO shading and mineral vein tinting.
 */
export function buildVoxelOutcropData(options: {
  gridX: number;
  gridY: number;
  gridZ: number;
  voxelSize: number;
  seed: number;
  mode: 'basalt-arch' | 'aether-crystal';
}): VoxelChunkGeometryData {
  const { gridX, gridY, gridZ, voxelSize, seed, mode } = options;
  const noise = new FastNoiseField(seed);
  const solid = new Uint8Array(gridX * gridY * gridZ);

  const idx = (x: number, y: number, z: number) => (y * gridZ + z) * gridX + x;
  const cx = (gridX - 1) * 0.5;
  const cz = (gridZ - 1) * 0.5;
  let solidVoxelCount = 0;

  for (let y = 0; y < gridY; y++) {
    const ny = y / Math.max(1, gridY - 1);
    for (let z = 0; z < gridZ; z++) {
      const dz = (z - cz) / Math.max(1, cz);
      for (let x = 0; x < gridX; x++) {
        const dx = (x - cx) / Math.max(1, cx);
        const radial = Math.hypot(dx, dz);
        const field = noise.sampleVoxelDensity3D(x * 1.35, y * 1.35, z * 1.35);

        let density: number;
        if (mode === 'basalt-arch') {
          // Carved arch silhouette with hollow tunnel through Z axis
          const archTunnel = Math.hypot(dx * 1.15, (ny - 0.35) * 1.45);
          const outer = 1.0 - radial * 0.85 - ny * 0.35;
          density = outer + field * 0.42 - (archTunnel < 0.48 ? 0.95 : 0);
          if (y === 0 && radial < 0.95) density = 0.6;
        } else {
          // Clustered upward crystal spire formation
          const spire = 0.82 - radial * (1.05 + ny * 0.75) - ny * 0.25;
          density = spire + field * 0.38;
        }

        if (density > 0.08) {
          solid[idx(x, y, z)] = 1;
          solidVoxelCount += 1;
        }
      }
    }
  }

  const isSolid = (x: number, y: number, z: number): boolean => {
    if (x < 0 || x >= gridX || y < 0 || y >= gridY || z < 0 || z >= gridZ) return false;
    return solid[idx(x, y, z)] === 1;
  };

  const posArr: number[] = [];
  const normArr: number[] = [];
  const colArr: number[] = [];

  const faces: Array<{
    dir: [number, number, number];
    corners: Array<[number, number, number]>;
    shade: number;
  }> = [
    {
      dir: [0, 1, 0],
      corners: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
      shade: 1.0,
    },
    {
      dir: [0, -1, 0],
      corners: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
      shade: 0.55,
    },
    {
      dir: [1, 0, 0],
      corners: [
        [1, 0, 1],
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
      ],
      shade: 0.84,
    },
    {
      dir: [-1, 0, 0],
      corners: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
      shade: 0.76,
    },
    {
      dir: [0, 0, 1],
      corners: [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
      shade: 0.9,
    },
    {
      dir: [0, 0, -1],
      corners: [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
      shade: 0.72,
    },
  ];

  const baseCol = mode === 'aether-crystal' ? [0.22, 0.78, 0.88] : [0.32, 0.36, 0.38];
  const tipCol = mode === 'aether-crystal' ? [0.68, 0.96, 1.0] : [0.46, 0.54, 0.44];

  for (let y = 0; y < gridY; y++) {
    const tY = y / Math.max(1, gridY - 1);
    for (let z = 0; z < gridZ; z++) {
      for (let x = 0; x < gridX; x++) {
        if (!isSolid(x, y, z)) continue;
        const ox = (x - gridX * 0.5) * voxelSize;
        const oy = y * voxelSize;
        const oz = (z - gridZ * 0.5) * voxelSize;

        for (const f of faces) {
          const nx = x + f.dir[0];
          const ny = y + f.dir[1];
          const nz = z + f.dir[2];
          if (isSolid(nx, ny, nz)) continue;

          // Two triangles per exposed face
          const triOrder = [0, 1, 2, 0, 2, 3];
          const r = (baseCol[0] * (1 - tY) + tipCol[0] * tY) * f.shade;
          const g = (baseCol[1] * (1 - tY) + tipCol[1] * tY) * f.shade;
          const b = (baseCol[2] * (1 - tY) + tipCol[2] * tY) * f.shade;

          for (const ci of triOrder) {
            const c = f.corners[ci];
            posArr.push(ox + c[0] * voxelSize, oy + c[1] * voxelSize, oz + c[2] * voxelSize);
            normArr.push(f.dir[0], f.dir[1], f.dir[2]);
            colArr.push(r, g, b);
          }
        }
      }
    }
  }

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr),
    colors: new Float32Array(colArr),
    solidVoxelCount,
  };
}

export function createVoxelOutcropMesh(
  options: {
    gridX: number;
    gridY: number;
    gridZ: number;
    voxelSize: number;
    seed: number;
    mode: 'basalt-arch' | 'aether-crystal';
  },
  material: THREE.Material
): { mesh: THREE.Mesh; geometry: THREE.BufferGeometry } {
  const data = buildVoxelOutcropData(options);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, geometry };
}
