import * as THREE from 'three';

const _tmpLightTarget = new THREE.Vector3();

interface PartitionChunk {
  object: THREE.Object3D;
  cellX: number;
  cellZ: number;
}

export interface AnchorLightTarget {
  x: number;
  y: number;
  z: number;
}

const CELL_SIZE = 72;
const ACTIVE_CELL_RADIUS = 2; // 5x5 cell streaming window (~360m x 360m)

/**
 * Phase 1 World Partition & Dynamic Local Bounce Light Rig:
 * - Partitions discrete scene sub-groups into spatial cells and toggles distant
 *   off-sector prop clusters outside the active cell radius (preserving hero landmarks,
 *   ground terrain, sea, and lights).
 * - Maintains 3 zero-allocation unshadowed PointLights for Lumen-style warm forge
 *   and cool ley-conduit local bounce illumination within software-WebGL budgets.
 */
export class WorldPartitionStreamer {
  private readonly chunks: PartitionChunk[] = [];
  private lastPlayerCellX = Number.NaN;
  private lastPlayerCellZ = Number.NaN;

  private readonly spellBounceLight: THREE.PointLight;
  private readonly hearthBounceLight: THREE.PointLight;
  private readonly leyBounceLight: THREE.PointLight;

  private spellPulseTimer = 0;
  private readonly hearthAnchors: AnchorLightTarget[] = [
    { x: -72, y: 2.2, z: 4 },
    { x: -52, y: 2.0, z: 30 },
    { x: 13, y: 2.2, z: -2 },
    { x: -46, y: 2.2, z: 206 },
  ];
  private readonly leyAnchors: AnchorLightTarget[] = [
    { x: 0, y: 2.2, z: 22 },
    { x: -47, y: 2.5, z: 5 },
    { x: 64, y: 3.4, z: 6 },
    { x: -192, y: 2.8, z: -12 },
    { x: 0, y: 3.5, z: 542 },
  ];

  constructor(scene: THREE.Scene) {
    this.spellBounceLight = new THREE.PointLight(0x67e8f9, 0, 14, 1.6);
    this.hearthBounceLight = new THREE.PointLight(0xfb923c, 2.2, 24, 1.5);
    this.leyBounceLight = new THREE.PointLight(0x38bdf8, 1.9, 24, 1.5);

    this.hearthBounceLight.position.set(13, 2.2, -2);
    this.leyBounceLight.position.set(0, 2.2, 22);

    scene.add(this.spellBounceLight, this.hearthBounceLight, this.leyBounceLight);
  }

  public clearChunks(): void {
    for (const c of this.chunks) {
      c.object.visible = true;
    }
    this.chunks.length = 0;
    this.lastPlayerCellX = Number.NaN;
    this.lastPlayerCellZ = Number.NaN;
  }

  public indexWorldGroup(worldGroup: THREE.Group): number {
    this.clearChunks();
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    worldGroup.updateMatrixWorld(true);
    for (const child of worldGroup.children) {
      if (!child.visible) continue;
      const nm = child.name || '';
      if (/ground|terrain|sea|sky|road|bridge|wall|gate|landmark|mount/i.test(nm)) {
        continue;
      }
      box.setFromObject(child);
      if (box.isEmpty()) continue;
      box.getSize(size);
      // Skip giant spanning meshes (terrain slabs, road networks, bounding perimeters)
      if (size.x > 110 || size.z > 110) continue;

      box.getCenter(center);
      this.chunks.push({
        object: child,
        cellX: Math.floor(center.x / CELL_SIZE),
        cellZ: Math.floor(center.z / CELL_SIZE),
      });
    }
    return this.chunks.length;
  }

  public triggerSpellBounce(pos: THREE.Vector3, colorHex: number, peakIntensity = 4.2): void {
    this.spellBounceLight.color.setHex(colorHex);
    this.spellBounceLight.position.set(pos.x, pos.y + 1.5, pos.z);
    this.spellBounceLight.intensity = peakIntensity;
    this.spellPulseTimer = 0.55;
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    const clampedDt = Math.min(dt, 0.05);

    // 1. Update cell streaming visibility only when player crosses cell boundary
    const cx = Math.floor(playerPos.x / CELL_SIZE);
    const cz = Math.floor(playerPos.z / CELL_SIZE);
    if (cx !== this.lastPlayerCellX || cz !== this.lastPlayerCellZ) {
      this.lastPlayerCellX = cx;
      this.lastPlayerCellZ = cz;
      for (const chunk of this.chunks) {
        const dx = Math.abs(chunk.cellX - cx);
        const dz = Math.abs(chunk.cellZ - cz);
        chunk.object.visible = dx <= ACTIVE_CELL_RADIUS && dz <= ACTIVE_CELL_RADIUS;
      }
    }

    // 2. Decay spell/vent bounce light cleanly
    if (this.spellPulseTimer > 0) {
      this.spellPulseTimer = Math.max(0, this.spellPulseTimer - clampedDt);
      this.spellBounceLight.intensity = (this.spellPulseTimer / 0.55) * 4.2;
      this.spellBounceLight.position.set(playerPos.x, playerPos.y + 1.4, playerPos.z);
    } else if (this.spellBounceLight.intensity > 0) {
      this.spellBounceLight.intensity = 0;
    }

    // 3. Snap nearest Hearth & Ley bounce anchors smoothly around player
    let bestHearth = this.hearthAnchors[0];
    let bestHDist = Infinity;
    for (const a of this.hearthAnchors) {
      const d = (a.x - playerPos.x) ** 2 + (a.z - playerPos.z) ** 2;
      if (d < bestHDist) {
        bestHDist = d;
        bestHearth = a;
      }
    }
    this.hearthBounceLight.position.lerp(
      _tmpLightTarget.set(bestHearth.x, bestHearth.y, bestHearth.z),
      Math.min(1, clampedDt * 6)
    );

    let bestLey = this.leyAnchors[0];
    let bestLDist = Infinity;
    for (const a of this.leyAnchors) {
      const d = (a.x - playerPos.x) ** 2 + (a.z - playerPos.z) ** 2;
      if (d < bestLDist) {
        bestLDist = d;
        bestLey = a;
      }
    }
    this.leyBounceLight.position.lerp(
      _tmpLightTarget.set(bestLey.x, bestLey.y, bestLey.z),
      Math.min(1, clampedDt * 6)
    );
  }

  public dispose(): void {
    this.clearChunks();
    this.spellBounceLight.parent?.remove(this.spellBounceLight);
    this.hearthBounceLight.parent?.remove(this.hearthBounceLight);
    this.leyBounceLight.parent?.remove(this.leyBounceLight);
    this.spellBounceLight.dispose();
    this.hearthBounceLight.dispose();
    this.leyBounceLight.dispose();
  }
}
