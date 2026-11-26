import * as THREE from 'three';
import { init as initRecast, NavMesh, NavMeshQuery } from '@recast-navigation/core';
import { threeToSoloNavMesh } from '@recast-navigation/three';
import type { BoxCollider } from '../core/types';

let sharedRecastInit: Promise<void> | null = null;

function ensureRecastInit(): Promise<void> {
  if (!sharedRecastInit) {
    sharedRecastInit = initRecast();
  }
  return sharedRecastInit;
}

/**
 * Real recastnavigation/recastnavigation (Recast & Detour WASM) NavMesh System:
 * - Synthesizes a walkable NavMesh from Elarion's core playfield & static collider obstacles.
 * - Provides Detour NavMeshQuery pathfinding so enemies route cleanly around stalls,
 *   buildings, piers, and walls instead of getting stuck on corners.
 */
export class RecastNavSystem {
  private navMesh: NavMesh | null = null;
  private query: NavMeshQuery | null = null;
  private building = false;
  private disposed = false;

  public isReady(): boolean {
    return this.query !== null;
  }

  public async buildFromColliders(boxColliders: BoxCollider[]): Promise<boolean> {
    if (this.building || this.disposed) return false;
    this.building = true;
    try {
      await ensureRecastInit();
      if (this.disposed) return false;

      this.disposeNavMeshOnly();

      // Build lightweight walkable floor + obstacle cutout proxy meshes for rapid NavMesh baking
      const tempMeshes: THREE.Mesh[] = [];
      const tempGeos: THREE.BufferGeometry[] = [];
      const dummyMat = new THREE.MeshBasicMaterial();

      const floorGeo = new THREE.BoxGeometry(620, 0.4, 660);
      tempGeos.push(floorGeo);
      const floorMesh = new THREE.Mesh(floorGeo, dummyMat);
      floorMesh.position.set(0, -0.04, 240);
      floorMesh.updateMatrixWorld();
      tempMeshes.push(floorMesh);

      let addedObstacles = 0;
      for (const b of boxColliders) {
        if (addedObstacles >= 180) break;
        const sx = b.maxX - b.minX;
        const sy = b.maxY - b.minY;
        const sz = b.maxZ - b.minZ;
        if (sx < 0.6 || sz < 0.6 || sy < 0.8) continue;
        // Skip floating canopies/roofs high above agent walk height
        if (b.minY > 2.2) continue;

        const cx = (b.minX + b.maxX) * 0.5;
        const cz = (b.minZ + b.maxZ) * 0.5;
        if (Math.abs(cx) > 290 || cz < -75 || cz > 550) continue;

        const boxGeo = new THREE.BoxGeometry(sx, Math.max(2.6, sy), sz);
        tempGeos.push(boxGeo);
        const obsMesh = new THREE.Mesh(boxGeo, dummyMat);
        obsMesh.position.set(cx, b.minY + Math.max(2.6, sy) * 0.5, cz);
        obsMesh.updateMatrixWorld();
        tempMeshes.push(obsMesh);
        addedObstacles += 1;
      }

      const { success, navMesh } = threeToSoloNavMesh(tempMeshes, {
        cs: 1.2,
        ch: 0.4,
        walkableSlopeAngle: 48,
        walkableHeight: 5,
        walkableClimb: 2,
        walkableRadius: 1,
        maxEdgeLen: 16,
        maxSimplificationError: 1.5,
      });

      for (const g of tempGeos) g.dispose();
      dummyMat.dispose();

      if (this.disposed) {
        navMesh?.destroy();
        return false;
      }

      if (success && navMesh) {
        this.navMesh = navMesh;
        this.query = new NavMeshQuery(navMesh, { maxNodes: 1024 });
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      this.building = false;
    }
  }

  /**
   * Computes the next world steering target along the Detour NavMesh from `from` to `to`.
   * Returns null if WASM isn't ready yet or positions lie outside the baked area.
   */
  public computeNextWaypoint(from: THREE.Vector3, to: THREE.Vector3): { x: number; z: number } | null {
    if (!this.query) return null;
    try {
      const res = this.query.computePath(
        { x: from.x, y: 0.2, z: from.z },
        { x: to.x, y: 0.2, z: to.z },
        {
          halfExtents: { x: 6, y: 8, z: 6 },
          maxPathPolys: 128,
          maxStraightPathPoints: 32,
        }
      );
      if (!res.success || res.path.length === 0) return null;
      // Pick first waypoint > 0.75m ahead so agent never stalls on start point
      for (let i = 1; i < res.path.length; i++) {
        const pt = res.path[i];
        const dist = Math.hypot(pt.x - from.x, pt.z - from.z);
        if (dist > 0.75) {
          return { x: pt.x, z: pt.z };
        }
      }
      const last = res.path[res.path.length - 1];
      return { x: last.x, z: last.z };
    } catch {
      return null;
    }
  }

  private disposeNavMeshOnly(): void {
    this.query?.destroy();
    this.navMesh?.destroy();
    this.query = null;
    this.navMesh = null;
  }

  public dispose(): void {
    this.disposed = true;
    this.disposeNavMeshOnly();
  }
}
