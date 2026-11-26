import * as THREE from 'three';

interface ExpandingRingVfx {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  duration: number;
  maxScale: number;
}

interface SpiralingMote {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  origin: THREE.Vector3;
  angle: number;
  radiusSpeed: number;
  liftSpeed: number;
  age: number;
  lifetime: number;
}

/**
 * Effekseer-inspired Additive GPU Ribbon & Spiraling Particle VFX Layer:
 * - Multi-layered additive rings, bright core flares, and helical mana motes
 *   that complement CombatSystem's beams, slash arcs, and Riposte detonations.
 */
export class EffekseerStyleVfx {
  public readonly group = new THREE.Group();
  private readonly rings: ExpandingRingVfx[] = [];
  private readonly motes: SpiralingMote[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];

  private readonly ringGeo: THREE.RingGeometry;
  private readonly moteGeo: THREE.OctahedronGeometry;

  constructor() {
    this.group.name = 'Effekseer_Additive_VFX';

    this.ringGeo = new THREE.RingGeometry(0.74, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.moteGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.disposables.push(this.ringGeo, this.moteGeo);

    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6ee3f5,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.disposables.push(mat);
      this.rings.push({ mesh, mat, age: 1, duration: 1, maxScale: 1 });
    }

    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.moteGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.disposables.push(mat);
      this.motes.push({
        mesh,
        mat,
        active: false,
        origin: new THREE.Vector3(),
        angle: 0,
        radiusSpeed: 4,
        liftSpeed: 3,
        age: 0,
        lifetime: 0.6,
      });
    }
  }

  public spawnBurst(pos: THREE.Vector3, colorHex: number, scale = 4.5, moteCount = 10): void {
    // Primary + inner harmonic additive shockwave rings
    let ringsSpawned = 0;
    for (const r of this.rings) {
      if (!r.mesh.visible) {
        r.mesh.visible = true;
        r.mesh.position.set(pos.x, pos.y + 0.16 + ringsSpawned * 0.25, pos.z);
        r.mesh.scale.setScalar(0.35);
        r.mat.color.setHex(ringsSpawned === 0 ? colorHex : 0xffffff);
        r.mat.opacity = 0.85;
        r.age = 0;
        r.duration = ringsSpawned === 0 ? 0.48 : 0.34;
        r.maxScale = ringsSpawned === 0 ? scale : scale * 0.65;
        ringsSpawned += 1;
        if (ringsSpawned >= 2) break;
      }
    }

    let spawned = 0;
    for (const m of this.motes) {
      if (!m.active) {
        m.active = true;
        m.origin.set(pos.x, pos.y + 0.5, pos.z);
        m.angle = (spawned / Math.max(1, moteCount)) * Math.PI * 2;
        m.radiusSpeed = 2.8 + (spawned % 3) * 1.4;
        m.liftSpeed = 1.8 + (spawned % 4) * 0.9;
        m.age = 0;
        m.lifetime = 0.45 + (spawned % 3) * 0.12;
        m.mat.color.setHex(colorHex);
        m.mat.opacity = 0.95;
        m.mesh.visible = true;
        m.mesh.position.copy(m.origin);
        spawned += 1;
        if (spawned >= moteCount) break;
      }
    }
  }

  public update(dt: number): void {
    const clamped = Math.min(dt, 0.05);

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += clamped;
      const t = Math.min(1, r.age / r.duration);
      r.mesh.scale.setScalar(0.35 + t * r.maxScale);
      r.mat.opacity = (1 - t) * 0.82;
      if (t >= 1) {
        r.mesh.visible = false;
      }
    }

    for (const m of this.motes) {
      if (!m.active) continue;
      m.age += clamped;
      const t = Math.min(1, m.age / m.lifetime);
      const rad = m.age * m.radiusSpeed;
      const spin = m.angle + m.age * 7.5;
      m.mesh.position.set(
        m.origin.x + Math.cos(spin) * rad,
        m.origin.y + m.age * m.liftSpeed,
        m.origin.z + Math.sin(spin) * rad
      );
      m.mesh.rotation.y += clamped * 9;
      m.mesh.scale.setScalar(1.15 - t * 0.8);
      m.mat.opacity = (1 - t) * 0.92;
      if (t >= 1) {
        m.active = false;
        m.mesh.visible = false;
      }
    }
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
