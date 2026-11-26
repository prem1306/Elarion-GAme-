import * as THREE from 'three';
import {
  buildManaSidearmMesh,
  buildSabreWeaponMesh,
  type SwingSnapshot,
} from '../characters/player/PlayerCharacter';
import type {
  BoxCollider,
  CameraMode,
  CombatDummySpec,
  DummyStatusReadout,
  FloatingCombatPopup,
} from '../core/types';
import type { SpellId } from '../rpg/rpgTypes';
import { EffekseerStyleVfx } from './EffekseerStyleVfx';
import type { EnemyDropEvent, EnemyHitOutcome, EnemyManager } from './EnemyManager';

const _playerFwd = new THREE.Vector3();
const _toDummy = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _worldAnchor = new THREE.Vector3();

const SPARK_COUNT = 72;
const MELEE_RANGE = 2.85;
const HEAVY_RANGE = 3.55;
const MELEE_MIN_DOT = 0.18;
const DUMMY_RESPAWN_SECONDS = 1.8;
const BOLT_POOL_SIZE = 16;

interface DummyRuntime {
  spec: CombatDummySpec;
  root: THREE.Group;
  springPivot: THREE.Group;
  chestMat: THREE.MeshStandardMaterial;
  maxHp: number;
  hp: number;
  angleX: number;
  angleZ: number;
  velX: number;
  velZ: number;
  hitFlashTimer: number;
  hudRevealTimer: number;
  downTimer: number;
  lastHitSwingId: number;
}

interface DamagePopupRuntime {
  id: string;
  text: string;
  isCritical: boolean;
  worldPos: THREE.Vector3;
  age: number;
  lifetime: number;
}

interface BoltRuntime {
  mesh: THREE.Mesh;
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  traveled: number;
}

function createBullseyeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c8b392';
  ctx.fillRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;
  const rings: Array<[number, string]> = [
    [54, '#242b33'],
    [42, '#a6312d'],
    [28, '#e8dcc4'],
    [14, '#c88a4b'],
  ];
  for (const [r, col] of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Combat & Ranged Sidearm System:
 * - Spring-pivoted Training Target Dummies with knockback & auto-reset
 * - 3-hit light combo, Heavy Cleave (R) shockwave arc, and Mana Sidearm ranged bolts (X)
 * - First-person sabre + sidearm viewmodels and pooled zero-GC spark bursts
 */
export class CombatSystem {
  public readonly group = new THREE.Group();
  public readonly fpWeaponRoot = new THREE.Group();

  private readonly dummiesGroup = new THREE.Group();
  private readonly dummies: DummyRuntime[] = [];
  private readonly popups: DamagePopupRuntime[] = [];
  private readonly bolts: BoltRuntime[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly effekseerVfx = new EffekseerStyleVfx();

  private readonly matWood: THREE.MeshStandardMaterial;
  private readonly matIron: THREE.MeshStandardMaterial;
  private readonly matBrass: THREE.MeshStandardMaterial;
  private readonly matBurlap: THREE.MeshStandardMaterial;
  private readonly matLeather: THREE.MeshStandardMaterial;
  private readonly matBullseye: THREE.MeshStandardMaterial;

  private readonly baseBeamGeo: THREE.BoxGeometry;
  private readonly collarGeo: THREE.CylinderGeometry;
  private readonly postGeo: THREE.CylinderGeometry;
  private readonly torsoGeo: THREE.LatheGeometry;
  private readonly strapGeo: THREE.CylinderGeometry;
  private readonly armBarGeo: THREE.CylinderGeometry;
  private readonly armPadGeo: THREE.CylinderGeometry;
  private readonly headGeo: THREE.SphereGeometry;
  private readonly helmGeo: THREE.CylinderGeometry;
  private readonly crestGeo: THREE.CylinderGeometry;
  private readonly pauldronGeo: THREE.SphereGeometry;

  private readonly slashGroup = new THREE.Group();
  private readonly slashMat: THREE.MeshBasicMaterial;
  private readonly slashMesh: THREE.Mesh;

  private readonly fpWeaponHolder = new THREE.Group();
  private readonly fpSidearmHolder = new THREE.Group();
  private fpWalkPhase = 0;

  private readonly sparkGeo: THREE.BufferGeometry;
  private readonly sparkMat: THREE.PointsMaterial;
  private readonly sparkPoints: THREE.Points;
  private readonly sparkPositions: Float32Array;
  private readonly sparkVelocities: Float32Array;
  private sparkLife = 0;

  private readonly waveMesh: THREE.Mesh;
  private readonly waveMat: THREE.MeshBasicMaterial;
  private waveTimer = 0;
  private waveDuration = 0.45;
  private waveMaxRadius = 6;

  private readonly beamMesh: THREE.Mesh;
  private readonly beamMat: THREE.MeshBasicMaterial;
  private beamTimer = 0;

  private readonly wardMesh: THREE.Mesh;
  private readonly wardMat: THREE.MeshBasicMaterial;

  private comboCount = 0;
  private comboDecayTimer = 0;
  private totalHits = 0;
  private lastDamageDealt = 0;
  private pendingDefeats = 0;
  private popupSeq = 0;
  private telemetryDirty = false;

  constructor() {
    this.group.name = 'Aincendra_Combat_System';
    this.group.add(this.dummiesGroup);
    this.group.add(this.effekseerVfx.group);

    this.matWood = new THREE.MeshStandardMaterial({ color: 0x5c3e2a, roughness: 0.82, metalness: 0.04 });
    this.matIron = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.44, metalness: 0.82 });
    this.matBrass = new THREE.MeshStandardMaterial({ color: 0xc2854a, roughness: 0.3, metalness: 0.86 });
    this.matBurlap = new THREE.MeshStandardMaterial({ color: 0xb59b74, roughness: 0.9, metalness: 0.02 });
    this.matLeather = new THREE.MeshStandardMaterial({ color: 0x3b271c, roughness: 0.72, metalness: 0.08 });
    const bullseyeTex = createBullseyeTexture();
    this.matBullseye = new THREE.MeshStandardMaterial({ map: bullseyeTex, roughness: 0.65, metalness: 0.05 });

    this.baseBeamGeo = new THREE.BoxGeometry(1.15, 0.12, 0.18);
    this.collarGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.22, 10);
    this.postGeo = new THREE.CylinderGeometry(0.065, 0.08, 1.55, 8);

    const torsoProfile = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.22, 0.02),
      new THREE.Vector2(0.2, 0.25),
      new THREE.Vector2(0.27, 0.56),
      new THREE.Vector2(0.24, 0.68),
      new THREE.Vector2(0.01, 0.7),
    ];
    this.torsoGeo = new THREE.LatheGeometry(torsoProfile, 12);
    this.torsoGeo.scale(1.12, 1.0, 0.78);

    this.strapGeo = new THREE.CylinderGeometry(0.225, 0.215, 0.08, 12);
    this.strapGeo.scale(1.14, 1.0, 0.8);
    this.armBarGeo = new THREE.CylinderGeometry(0.042, 0.042, 1.08, 8);
    this.armPadGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.32, 8);
    this.headGeo = new THREE.SphereGeometry(0.155, 12, 10);
    this.helmGeo = new THREE.CylinderGeometry(0.165, 0.178, 0.18, 12);
    this.crestGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 14);
    this.pauldronGeo = new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);

    this.disposables.push(
      bullseyeTex,
      this.matWood,
      this.matIron,
      this.matBrass,
      this.matBurlap,
      this.matLeather,
      this.matBullseye,
      this.baseBeamGeo,
      this.collarGeo,
      this.postGeo,
      this.torsoGeo,
      this.strapGeo,
      this.armBarGeo,
      this.armPadGeo,
      this.headGeo,
      this.helmGeo,
      this.crestGeo,
      this.pauldronGeo
    );

    const slashGeo = new THREE.RingGeometry(0.95, 1.56, 24, 1, -1.15, 2.3);
    slashGeo.rotateX(-Math.PI / 2);
    this.slashMat = new THREE.MeshBasicMaterial({
      color: 0xf4c382,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.slashMesh = new THREE.Mesh(slashGeo, this.slashMat);
    this.slashGroup.add(this.slashMesh);
    this.slashGroup.visible = false;
    this.group.add(this.slashGroup);
    this.disposables.push(slashGeo, this.slashMat);

    // First-person Sabre + Sidearm viewmodels
    const fpSabre = buildSabreWeaponMesh(this.disposables);
    fpSabre.rotation.set(-0.62, -0.25, 0.18);
    this.fpWeaponHolder.add(fpSabre);
    this.fpWeaponHolder.position.set(0.32, -0.28, -0.44);
    this.fpWeaponRoot.add(this.fpWeaponHolder);

    const fpSidearm = buildManaSidearmMesh(this.disposables);
    fpSidearm.rotation.set(0.04, Math.PI, 0);
    this.fpSidearmHolder.add(fpSidearm);
    this.fpSidearmHolder.position.set(-0.28, -0.22, -0.42);
    this.fpSidearmHolder.visible = false;
    this.fpWeaponRoot.add(this.fpSidearmHolder);
    this.fpWeaponRoot.visible = false;

    // Pooled Mana Sidearm Bolts
    const boltGeo = new THREE.SphereGeometry(0.085, 8, 8);
    boltGeo.scale(0.8, 0.8, 2.6);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x7de2f0 });
    this.disposables.push(boltGeo, boltMat);
    for (let i = 0; i < BOLT_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(boltGeo, boltMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.bolts.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        traveled: 0,
      });
    }

    // Pooled Impact Sparks
    this.sparkPositions = new Float32Array(SPARK_COUNT * 3);
    this.sparkVelocities = new Float32Array(SPARK_COUNT * 3);
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkMat = new THREE.PointsMaterial({
      color: 0xffd27a,
      size: 0.085,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.sparkPoints = new THREE.Points(this.sparkGeo, this.sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.sparkPoints.visible = false;
    this.group.add(this.sparkPoints);
    this.disposables.push(this.sparkGeo, this.sparkMat);

    // Expanding AoE Spell / Exothermic Vent Wave Ring
    const waveGeo = new THREE.RingGeometry(0.86, 1.0, 40);
    waveGeo.rotateX(-Math.PI / 2);
    this.waveMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waveMesh = new THREE.Mesh(waveGeo, this.waveMat);
    this.waveMesh.visible = false;
    this.group.add(this.waveMesh);
    this.disposables.push(waveGeo, this.waveMat);

    // Arc Bolt / Ley-Lance 3D Beam Cylinder
    const beamGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.0, 8);
    beamGeo.rotateX(Math.PI / 2);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x6ee3f5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
    this.beamMesh.visible = false;
    this.group.add(this.beamMesh);
    this.disposables.push(beamGeo, this.beamMat);

    // Chrono Ward Protective Aura Dome
    const wardGeo = new THREE.SphereGeometry(1.18, 16, 12);
    this.wardMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
      depthWrite: false,
    });
    this.wardMesh = new THREE.Mesh(wardGeo, this.wardMat);
    this.wardMesh.visible = false;
    this.group.add(this.wardMesh);
    this.disposables.push(wardGeo, this.wardMat);
  }

  public getComboCount(): number {
    return this.comboCount;
  }

  public getTotalHits(): number {
    return this.totalHits;
  }

  public getLastDamageDealt(): number {
    return this.lastDamageDealt;
  }

  public consumeDirty(): boolean {
    const d = this.telemetryDirty;
    this.telemetryDirty = false;
    return d;
  }

  public spawnSidearmBolt(origin: THREE.Vector3, dir: THREE.Vector3): void {
    const slot = this.bolts.find((b) => !b.active) ?? this.bolts[0];
    slot.active = true;
    slot.pos.copy(origin);
    slot.vel.copy(dir).normalize().multiplyScalar(48.0);
    slot.traveled = 0;
    slot.mesh.position.copy(origin);
    slot.mesh.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
    slot.mesh.visible = true;
    this.spawnSparks(origin, dir.x, dir.z, true);
  }

  public spawnVfxBurst(pos: THREE.Vector3, colorHex: number, scale = 4.5, moteCount = 12): void {
    this.effekseerVfx.spawnBurst(pos, colorHex, scale, moteCount);
  }

  public spawnSpellVisual(
    spellId: SpellId | 'vent',
    origin: THREE.Vector3,
    targetPos?: THREE.Vector3 | null,
    facingYaw = 0
  ): void {
    if (spellId === 'pyre_nova' || spellId === 'vent') {
      const colHex = spellId === 'pyre_nova' ? 0xf97316 : 0x38bdf8;
      this.waveMat.color.setHex(colHex);
      this.waveMesh.position.set(origin.x, origin.y + 0.12, origin.z);
      this.waveMaxRadius = spellId === 'pyre_nova' ? 6.0 : 6.8;
      this.waveDuration = 0.45;
      this.waveTimer = this.waveDuration;
      this.waveMesh.scale.setScalar(0.5);
      this.waveMesh.visible = true;
      this.spawnSparks(origin.clone().add(new THREE.Vector3(0, 1.0, 0)), 0, 1, true);
      this.effekseerVfx.spawnBurst(origin, colHex, spellId === 'pyre_nova' ? 6.2 : 7.0, 14);
    } else if (spellId === 'arc_bolt' || spellId === 'ley_lance') {
      const start = new THREE.Vector3(origin.x, origin.y + 1.25, origin.z);
      const end = targetPos
        ? new THREE.Vector3(targetPos.x, targetPos.y + 1.15, targetPos.z)
        : new THREE.Vector3(
            origin.x + Math.sin(facingYaw) * 18,
            origin.y + 1.2,
            origin.z + Math.cos(facingYaw) * 18
          );
      const dist = Math.max(1.0, start.distanceTo(end));
      const beamHex = spellId === 'arc_bolt' ? 0x6ee3f5 : 0x34d399;
      this.beamMat.color.setHex(beamHex);
      this.beamMesh.position.copy(start).lerp(end, 0.5);
      this.beamMesh.scale.set(spellId === 'ley_lance' ? 1.6 : 1.0, spellId === 'ley_lance' ? 1.6 : 1.0, dist);
      this.beamMesh.lookAt(end);
      this.beamTimer = 0.28;
      this.beamMesh.visible = true;
      this.spawnSparks(end, Math.sin(facingYaw), Math.cos(facingYaw), true);
      this.effekseerVfx.spawnBurst(end, beamHex, spellId === 'ley_lance' ? 4.8 : 3.6, 10);
    } else if (spellId === 'chrono_ward') {
      this.waveMat.color.setHex(0xa78bfa);
      this.waveMesh.position.set(origin.x, origin.y + 0.14, origin.z);
      this.waveMaxRadius = 4.6;
      this.waveDuration = 0.4;
      this.waveTimer = this.waveDuration;
      this.waveMesh.visible = true;
      this.effekseerVfx.spawnBurst(origin, 0xa78bfa, 4.6, 12);
    }
  }

  public clearDummies(): void {
    for (const d of this.dummies) {
      d.chestMat.dispose();
    }
    this.dummies.length = 0;
    this.popups.length = 0;
    for (const b of this.bolts) {
      b.active = false;
      b.mesh.visible = false;
    }
    while (this.dummiesGroup.children.length > 0) {
      this.dummiesGroup.remove(this.dummiesGroup.children[0]);
    }
  }

  public setDummies(specs: CombatDummySpec[] = [], boxColliders?: BoxCollider[]): void {
    this.clearDummies();
    for (const spec of specs) {
      const runtime = this.createDummyInstance(spec);
      this.dummies.push(runtime);
      this.dummiesGroup.add(runtime.root);

      if (boxColliders) {
        const [x, y, z] = spec.position;
        boxColliders.push({
          minX: x - 0.44,
          maxX: x + 0.44,
          minY: y,
          maxY: y + 1.95,
          minZ: z - 0.44,
          maxZ: z + 0.44,
        });
      }
    }
  }

  private createDummyInstance(spec: CombatDummySpec): DummyRuntime {
    const root = new THREE.Group();
    root.name = `CombatDummy_${spec.id}`;
    root.position.set(spec.position[0], spec.position[1], spec.position[2]);
    root.rotation.y = spec.facingYaw;

    const beamA = new THREE.Mesh(this.baseBeamGeo, this.matWood);
    beamA.position.y = 0.06;
    beamA.castShadow = true;
    beamA.receiveShadow = true;

    const beamB = new THREE.Mesh(this.baseBeamGeo, this.matWood);
    beamB.position.y = 0.06;
    beamB.rotation.y = Math.PI / 2;
    beamB.castShadow = true;
    beamB.receiveShadow = true;

    const collar = new THREE.Mesh(this.collarGeo, this.matIron);
    collar.position.y = 0.16;
    collar.castShadow = true;

    root.add(beamA, beamB, collar);

    const springPivot = new THREE.Group();
    springPivot.position.y = 0.18;

    const post = new THREE.Mesh(this.postGeo, this.matWood);
    post.position.y = 0.72;
    post.castShadow = true;

    const chestMat = spec.armored ? this.matIron.clone() : this.matBurlap.clone();
    const torso = new THREE.Mesh(this.torsoGeo, chestMat);
    torso.position.y = 0.72;
    torso.castShadow = true;
    torso.receiveShadow = true;

    const belt = new THREE.Mesh(this.strapGeo, this.matLeather);
    belt.position.y = 0.88;

    const harness = new THREE.Mesh(this.strapGeo, this.matLeather);
    harness.position.y = 1.24;

    const crest = new THREE.Mesh(this.crestGeo, this.matBullseye);
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 1.12, 0.22);

    const armBar = new THREE.Mesh(this.armBarGeo, this.matWood);
    armBar.rotation.z = Math.PI / 2;
    armBar.position.y = 1.28;
    armBar.castShadow = true;

    const padL = new THREE.Mesh(this.armPadGeo, this.matBurlap);
    padL.rotation.z = Math.PI / 2;
    padL.position.set(-0.38, 1.28, 0);
    padL.castShadow = true;

    const padR = new THREE.Mesh(this.armPadGeo, this.matBurlap);
    padR.rotation.z = Math.PI / 2;
    padR.position.set(0.38, 1.28, 0);
    padR.castShadow = true;

    const head = new THREE.Mesh(this.headGeo, this.matBurlap);
    head.position.y = 1.56;
    head.castShadow = true;

    const helm = new THREE.Mesh(this.helmGeo, spec.armored ? this.matBrass : this.matIron);
    helm.position.y = 1.61;
    helm.castShadow = true;

    springPivot.add(post, torso, belt, harness, crest, armBar, padL, padR, head, helm);

    if (spec.armored) {
      const pL = new THREE.Mesh(this.pauldronGeo, this.matBrass);
      pL.position.set(-0.3, 1.32, 0);
      pL.castShadow = true;
      const pR = new THREE.Mesh(this.pauldronGeo, this.matBrass);
      pR.position.set(0.3, 1.32, 0);
      pR.castShadow = true;
      springPivot.add(pL, pR);
    }

    root.add(springPivot);
    const maxHp = spec.maxHp ?? (spec.armored ? 220 : 150);

    return {
      spec,
      root,
      springPivot,
      chestMat,
      maxHp,
      hp: maxHp,
      angleX: 0,
      angleZ: 0,
      velX: 0,
      velZ: 0,
      hitFlashTimer: 0,
      hudRevealTimer: 0,
      downTimer: 0,
      lastHitSwingId: -1,
    };
  }

  private applyDummyHit(
    dummy: DummyRuntime,
    dmg: number,
    pushDirX: number,
    pushDirZ: number,
    impulseMag: number,
    label: string,
    isCritical: boolean,
    onHitImpact?: (critical: boolean) => void
  ): void {
    const prevHp = dummy.hp;
    dummy.hp = Math.max(0, dummy.hp - dmg);
    dummy.hitFlashTimer = 0.14;
    dummy.hudRevealTimer = 4.5;

    const cosD = Math.cos(-dummy.spec.facingYaw);
    const sinD = Math.sin(-dummy.spec.facingYaw);
    const localPushX = pushDirX * cosD - pushDirZ * sinD;
    const localPushZ = pushDirX * sinD + pushDirZ * cosD;
    dummy.velX += localPushZ * impulseMag;
    dummy.velZ -= localPushX * impulseMag;

    if (prevHp > 0 && dummy.hp === 0) {
      dummy.downTimer = DUMMY_RESPAWN_SECONDS;
      this.pendingDefeats += 1;
    }

    this.comboCount += 1;
    this.comboDecayTimer = 2.6;
    this.totalHits += 1;
    this.lastDamageDealt = dmg;
    this.telemetryDirty = true;

    const impactPos = new THREE.Vector3(
      dummy.spec.position[0],
      dummy.spec.position[1] + 1.18,
      dummy.spec.position[2]
    );
    this.spawnSparks(impactPos, pushDirX, pushDirZ, isCritical);
    this.popupSeq += 1;
    this.popups.push({
      id: `dmg_${this.popupSeq}`,
      text: label,
      isCritical,
      worldPos: impactPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.38, 0)),
      age: 0,
      lifetime: 0.85,
    });

    onHitImpact?.(isCritical);
  }

  private spawnSparks(origin: THREE.Vector3, dirX: number, dirZ: number, critical: boolean): void {
    this.sparkMat.color.setHex(critical ? 0x7de2f0 : 0xffd27a);
    this.sparkLife = 0.42;
    this.sparkPoints.visible = true;

    for (let i = 0; i < SPARK_COUNT; i++) {
      const idx = i * 3;
      this.sparkPositions[idx] = origin.x + (Math.random() - 0.5) * 0.2;
      this.sparkPositions[idx + 1] = origin.y + (Math.random() - 0.5) * 0.2;
      this.sparkPositions[idx + 2] = origin.z + (Math.random() - 0.5) * 0.2;

      const spread = 2.4 + Math.random() * 3.8;
      this.sparkVelocities[idx] = dirX * 1.6 + (Math.random() - 0.5) * spread;
      this.sparkVelocities[idx + 1] = 1.6 + Math.random() * 3.5;
      this.sparkVelocities[idx + 2] = dirZ * 1.6 + (Math.random() - 0.5) * spread;
    }
    const posAttr = this.sparkGeo.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerHorizSpeed: number,
    cameraMode: CameraMode,
    swing: SwingSnapshot,
    onHitImpact?: (critical: boolean, hitEnemy: boolean) => void,
    enemyManager?: EnemyManager,
    attackBonus = 0,
    wardActive = false,
    dropsOut?: EnemyDropEvent[],
    spellPower = 0,
    poiseDamageMult = 1.0
  ): EnemyHitOutcome {
    const clampedDt = Math.min(dt, 0.05);
    const totalOutcome: EnemyHitOutcome = {
      hits: 0,
      stanceBroken: false,
      riposteTriggered: false,
      riposteHeatRelief: 0,
      riposteCapacitorGain: 0,
    };

    // Update Spell Wave, Beam & Chrono Ward Dome
    if (wardActive && cameraMode === 'third-person') {
      this.wardMesh.visible = true;
      this.wardMesh.position.set(playerPos.x, playerPos.y + 1.05, playerPos.z);
      this.wardMesh.rotation.y += clampedDt * 1.4;
    } else {
      this.wardMesh.visible = false;
    }

    if (this.waveTimer > 0) {
      this.waveTimer = Math.max(0, this.waveTimer - clampedDt);
      const t = 1 - this.waveTimer / this.waveDuration;
      this.waveMesh.scale.setScalar(0.5 + t * this.waveMaxRadius);
      this.waveMat.opacity = (1 - t) * 0.85;
      if (this.waveTimer === 0) this.waveMesh.visible = false;
    }

    if (this.beamTimer > 0) {
      this.beamTimer = Math.max(0, this.beamTimer - clampedDt);
      this.beamMat.opacity = Math.min(1, this.beamTimer / 0.28);
      if (this.beamTimer === 0) this.beamMesh.visible = false;
    }

    if (this.comboDecayTimer > 0) {
      this.comboDecayTimer -= clampedDt;
      if (this.comboDecayTimer <= 0 && this.comboCount > 0) {
        this.comboCount = 0;
        this.telemetryDirty = true;
      }
    }

    // 1. Update 3D Slash / Heavy Cleave Arc Ribbon
    if (swing.isSwinging && swing.progress >= 0.16 && swing.progress <= 0.88) {
      const arcT = (swing.progress - 0.16) / 0.72;
      this.slashGroup.visible = true;
      this.slashGroup.position.set(playerPos.x, playerPos.y + 1.15, playerPos.z);
      this.slashGroup.rotation.set(0, swing.facingYaw, 0);

      if (swing.isHeavy) {
        this.slashMesh.rotation.set(0.08, Math.PI * 0.5, 0);
        this.slashMat.color.setHex(0x6ee3f5);
        this.slashMesh.scale.setScalar(1.22 + arcT * 0.44);
      } else if (swing.comboStep === 1) {
        this.slashMesh.rotation.set(0.32, Math.PI * 0.5, -0.35);
        this.slashMat.color.setHex(0xf4c382);
        this.slashMesh.scale.setScalar(0.88 + arcT * 0.28);
      } else if (swing.comboStep === 2) {
        this.slashMesh.rotation.set(-0.32, Math.PI * 0.5, 0.35);
        this.slashMat.color.setHex(0xf4c382);
        this.slashMesh.scale.setScalar(0.88 + arcT * 0.28);
      } else {
        this.slashMesh.rotation.set(0, Math.PI * 0.5, Math.PI * 0.48);
        this.slashMat.color.setHex(0x7de2f0);
        this.slashMesh.scale.setScalar(0.95 + arcT * 0.32);
      }
      this.slashMat.opacity = Math.sin(arcT * Math.PI) * (swing.isHeavy ? 0.85 : 0.72);
    } else {
      this.slashGroup.visible = false;
    }

    // 2. First-Person Viewmodels (Sabre & Sidearm)
    this.fpWeaponRoot.visible = cameraMode === 'first-person';
    if (this.fpWeaponRoot.visible) {
      this.fpSidearmHolder.visible = swing.isSidearm;
      if (swing.isSidearm) {
        const kick = Math.sin(Math.min(1, swing.progress * 2.2) * Math.PI) * 0.14;
        this.fpSidearmHolder.position.set(-0.28, -0.22 + kick * 0.25, -0.44 + kick);
        this.fpSidearmHolder.rotation.set(kick * 1.4, 0, 0);
      }
      if (swing.isSwinging) {
        const p = swing.progress;
        const sweep =
          p < 0.22
            ? -THREE.MathUtils.smoothstep(p, 0, 0.22) * 0.5
            : Math.sin(THREE.MathUtils.clamp((p - 0.18) / 0.6, 0, 1) * Math.PI * 0.9);
        if (swing.isHeavy) {
          this.fpWeaponHolder.position.set(0.38 - sweep * 0.62, -0.22, -0.48 - sweep * 0.16);
          this.fpWeaponHolder.rotation.set(-0.45, sweep * 1.65 - 0.4, sweep * 1.1);
        } else if (swing.comboStep === 1) {
          this.fpWeaponHolder.position.set(0.32 - sweep * 0.42, -0.26 + sweep * 0.08, -0.46 - sweep * 0.12);
          this.fpWeaponHolder.rotation.set(-sweep * 0.65, sweep * 1.15, sweep * 0.85);
        } else if (swing.comboStep === 2) {
          this.fpWeaponHolder.position.set(-0.1 + sweep * 0.46, -0.26 + sweep * 0.06, -0.46 - sweep * 0.12);
          this.fpWeaponHolder.rotation.set(-sweep * 0.55, -sweep * 1.15 + 0.4, -sweep * 0.85);
        } else {
          this.fpWeaponHolder.position.set(0.14, -0.14 - sweep * 0.34, -0.44 - sweep * 0.18);
          this.fpWeaponHolder.rotation.set(-1.15 * sweep + 0.35, 0, 0);
        }
      } else if (swing.guarding) {
        this.fpWeaponHolder.position.x = THREE.MathUtils.damp(this.fpWeaponHolder.position.x, 0.04, 16, clampedDt);
        this.fpWeaponHolder.position.y = THREE.MathUtils.damp(this.fpWeaponHolder.position.y, -0.18, 16, clampedDt);
        this.fpWeaponHolder.position.z = THREE.MathUtils.damp(this.fpWeaponHolder.position.z, -0.42, 16, clampedDt);
        this.fpWeaponHolder.rotation.x = THREE.MathUtils.damp(this.fpWeaponHolder.rotation.x, 0.2, 16, clampedDt);
        this.fpWeaponHolder.rotation.y = THREE.MathUtils.damp(this.fpWeaponHolder.rotation.y, 0.42, 16, clampedDt);
        this.fpWeaponHolder.rotation.z = THREE.MathUtils.damp(this.fpWeaponHolder.rotation.z, 0.95, 16, clampedDt);
      } else {
        this.fpWalkPhase += clampedDt * (playerHorizSpeed > 0.25 ? 8.5 : 2.2);
        const bobAmp = playerHorizSpeed > 0.25 ? 0.016 : 0.004;
        this.fpWeaponHolder.position.x = THREE.MathUtils.damp(
          this.fpWeaponHolder.position.x,
          0.32 + Math.cos(this.fpWalkPhase * 0.5) * bobAmp,
          12,
          clampedDt
        );
        this.fpWeaponHolder.position.y = THREE.MathUtils.damp(
          this.fpWeaponHolder.position.y,
          -0.28 + Math.abs(Math.sin(this.fpWalkPhase)) * bobAmp,
          12,
          clampedDt
        );
        this.fpWeaponHolder.position.z = THREE.MathUtils.damp(this.fpWeaponHolder.position.z, -0.44, 12, clampedDt);
        this.fpWeaponHolder.rotation.x = THREE.MathUtils.damp(this.fpWeaponHolder.rotation.x, 0, 12, clampedDt);
        this.fpWeaponHolder.rotation.y = THREE.MathUtils.damp(this.fpWeaponHolder.rotation.y, 0, 12, clampedDt);
        this.fpWeaponHolder.rotation.z = THREE.MathUtils.damp(this.fpWeaponHolder.rotation.z, 0, 12, clampedDt);
      }
    }

    // 3. Melee & Heavy Cleave Hit Detection (Training Dummies + Live Enemies)
    if (swing.isActiveWindow) {
      _playerFwd.set(Math.sin(swing.facingYaw), 0, Math.cos(swing.facingYaw));
      const range = swing.isHeavy ? HEAVY_RANGE : MELEE_RANGE;
      const minDot = swing.isHeavy ? -0.15 : MELEE_MIN_DOT;
      const isCritical = swing.isHeavy || swing.comboStep === 3;
      const baseDmg =
        (swing.isHeavy ? 56 : swing.comboStep === 1 ? 22 : swing.comboStep === 2 ? 26 : 38) +
        attackBonus;

      if (enemyManager && dropsOut) {
        const stanceDmg = Math.round((swing.isHeavy ? 42 : swing.comboStep === 3 ? 28 : 18) * poiseDamageMult);
        const swingRes = enemyManager.applyMeleeSwing(
          swing.swingId,
          playerPos,
          swing.facingYaw,
          range,
          minDot,
          baseDmg,
          stanceDmg,
          22 + attackBonus,
          spellPower,
          isCritical,
          swing.isHeavy ? 10.5 : isCritical ? 8.0 : 5.2,
          dropsOut
        );
        if (swingRes.hits > 0) {
          totalOutcome.hits += swingRes.hits;
          if (swingRes.stanceBroken) totalOutcome.stanceBroken = true;
          if (swingRes.riposteTriggered) {
            totalOutcome.riposteTriggered = true;
            totalOutcome.riposteHeatRelief += swingRes.riposteHeatRelief;
            totalOutcome.riposteCapacitorGain += swingRes.riposteCapacitorGain;
          }
          this.comboCount += swingRes.hits;
          this.comboDecayTimer = 2.8;
          this.totalHits += swingRes.hits;
          this.lastDamageDealt = baseDmg;
          this.telemetryDirty = true;
          const hitImpactPos = playerPos
            .clone()
            .add(new THREE.Vector3(_playerFwd.x * 1.4, 1.15, _playerFwd.z * 1.4));
          this.spawnSparks(
            hitImpactPos,
            _playerFwd.x,
            _playerFwd.z,
            isCritical || swingRes.riposteTriggered
          );
          if (isCritical || swingRes.riposteTriggered) {
            this.effekseerVfx.spawnBurst(
              hitImpactPos,
              swingRes.riposteTriggered ? 0xfbbf24 : 0x7de2f0,
              swingRes.riposteTriggered ? 4.8 : 2.8,
              swingRes.riposteTriggered ? 12 : 6
            );
          }
          onHitImpact?.(isCritical || swingRes.riposteTriggered, true);
        }
      }

      for (const dummy of this.dummies) {
        if (dummy.downTimer > 0 || dummy.lastHitSwingId === swing.swingId) continue;

        const dx = dummy.spec.position[0] - playerPos.x;
        const dy = Math.abs(dummy.spec.position[1] - playerPos.y);
        const dz = dummy.spec.position[2] - playerPos.z;
        if (dy > 1.9) continue;

        const distSq = dx * dx + dz * dz;
        if (distSq > range * range) continue;

        const dist = Math.max(0.01, Math.sqrt(distSq));
        _toDummy.set(dx / dist, 0, dz / dist);
        const dot = _toDummy.dot(_playerFwd);
        if (dist > 0.85 && dot < minDot) continue;

        dummy.lastHitSwingId = swing.swingId;
        const dmg = dummy.spec.armored ? Math.round(baseDmg * 0.85) : baseDmg;
        const label = swing.isHeavy
          ? `-${dmg} CLEAVE!`
          : isCritical
            ? `-${dmg} CRIT!`
            : `-${dmg}`;
        this.applyDummyHit(
          dummy,
          dmg,
          _toDummy.x,
          _toDummy.z,
          swing.isHeavy ? 11.2 : isCritical ? 8.5 : 5.4,
          label,
          isCritical,
          (crit) => onHitImpact?.(crit, false)
        );
      }
    }

    // 4. Update Mana Sidearm Projectiles (Dummies + Live Enemies)
    for (const bolt of this.bolts) {
      if (!bolt.active) continue;
      const stepDist = bolt.vel.length() * clampedDt;
      bolt.pos.addScaledVector(bolt.vel, clampedDt);
      bolt.traveled += stepDist;
      bolt.mesh.position.copy(bolt.pos);

      let hit = false;
      if (enemyManager && dropsOut) {
        const vLen = Math.max(0.01, Math.hypot(bolt.vel.x, bolt.vel.z));
        const boltDmg = 34 + Math.round(attackBonus * 0.75);
        const boltRes = enemyManager.applyPointHit(
          bolt.pos,
          0.78,
          boltDmg,
          Math.round(16 * poiseDamageMult),
          bolt.vel.x / vLen,
          bolt.vel.z / vLen,
          `-${boltDmg} MANA`,
          true,
          dropsOut
        );
        if (boltRes.hit) {
          totalOutcome.hits += 1;
          if (boltRes.stanceBroken) totalOutcome.stanceBroken = true;
          this.comboCount += 1;
          this.comboDecayTimer = 2.8;
          this.totalHits += 1;
          this.lastDamageDealt = boltDmg;
          this.telemetryDirty = true;
          this.spawnSparks(bolt.pos, bolt.vel.x / vLen, bolt.vel.z / vLen, true);
          this.effekseerVfx.spawnBurst(bolt.pos, 0x7de2f0, 2.4, 6);
          onHitImpact?.(true, true);
          hit = true;
        }
      }

      if (!hit) {
        for (const dummy of this.dummies) {
          if (dummy.downTimer > 0) continue;
          const dx = dummy.spec.position[0] - bolt.pos.x;
          const dz = dummy.spec.position[2] - bolt.pos.z;
          if (
            dx * dx + dz * dz < 0.72 * 0.72 &&
            bolt.pos.y >= dummy.spec.position[1] &&
            bolt.pos.y <= dummy.spec.position[1] + 2.05
          ) {
            const vLen = Math.max(0.01, Math.hypot(bolt.vel.x, bolt.vel.z));
            const dmg = (dummy.spec.armored ? 28 : 34) + Math.round(attackBonus * 0.5);
            this.applyDummyHit(
              dummy,
              dmg,
              bolt.vel.x / vLen,
              bolt.vel.z / vLen,
              6.8,
              `-${dmg} MANA`,
              true,
              (crit) => onHitImpact?.(crit, false)
            );
            hit = true;
            break;
          }
        }
      }

      if (hit || bolt.traveled >= 28.0) {
        bolt.active = false;
        bolt.mesh.visible = false;
      }
    }

    // 5. Update Dummy Spring Physics, Hit Flash, and Respawn
    for (const dummy of this.dummies) {
      if (dummy.hudRevealTimer > 0) {
        dummy.hudRevealTimer = Math.max(0, dummy.hudRevealTimer - clampedDt);
      }

      if (dummy.hitFlashTimer > 0) {
        dummy.hitFlashTimer = Math.max(0, dummy.hitFlashTimer - clampedDt);
        dummy.chestMat.emissive.setHex(dummy.hitFlashTimer > 0 ? 0xb84b24 : 0x000000);
        dummy.chestMat.emissiveIntensity = dummy.hitFlashTimer > 0 ? 0.65 : 0;
      }

      if (dummy.downTimer > 0) {
        dummy.downTimer = Math.max(0, dummy.downTimer - clampedDt);
        dummy.angleX = THREE.MathUtils.damp(dummy.angleX, 1.24, 10, clampedDt);
        dummy.angleZ = THREE.MathUtils.damp(dummy.angleZ, 0.14, 10, clampedDt);
        if (dummy.downTimer === 0) {
          dummy.hp = dummy.maxHp;
          dummy.velX = -4.2;
        }
      } else {
        const stiffness = 135;
        const damping = 10.5;
        const accX = -stiffness * dummy.angleX - damping * dummy.velX;
        const accZ = -stiffness * dummy.angleZ - damping * dummy.velZ;
        dummy.velX += accX * clampedDt;
        dummy.velZ += accZ * clampedDt;
        dummy.angleX = THREE.MathUtils.clamp(dummy.angleX + dummy.velX * clampedDt, -0.75, 0.75);
        dummy.angleZ = THREE.MathUtils.clamp(dummy.angleZ + dummy.velZ * clampedDt, -0.75, 0.75);
      }

      dummy.springPivot.rotation.set(dummy.angleX, 0, dummy.angleZ);
    }

    // 6. Update Impact Sparks
    if (this.sparkLife > 0) {
      this.sparkLife = Math.max(0, this.sparkLife - clampedDt);
      for (let i = 0; i < SPARK_COUNT; i++) {
        const idx = i * 3;
        this.sparkVelocities[idx + 1] -= 11.5 * clampedDt;
        this.sparkPositions[idx] += this.sparkVelocities[idx] * clampedDt;
        this.sparkPositions[idx + 1] += this.sparkVelocities[idx + 1] * clampedDt;
        this.sparkPositions[idx + 2] += this.sparkVelocities[idx + 2] * clampedDt;
      }
      const posAttr = this.sparkGeo.getAttribute('position') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      this.sparkMat.opacity = Math.min(1, this.sparkLife / 0.42);
      if (this.sparkLife === 0) {
        this.sparkPoints.visible = false;
      }
    }

    // 7. Age Floating Damage Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += clampedDt;
      p.worldPos.y += clampedDt * 1.15;
      if (p.age >= p.lifetime) {
        this.popups.splice(i, 1);
      }
    }

    this.effekseerVfx.update(clampedDt);

    return totalOutcome;
  }

  public computeCombatOverlay(
    camera: THREE.Camera,
    viewportWidth: number,
    viewportHeight: number,
    playerPos: THREE.Vector3
  ): { popups: FloatingCombatPopup[]; dummies: DummyStatusReadout[] } {
    const outPopups: FloatingCombatPopup[] = [];
    const outDummies: DummyStatusReadout[] = [];
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return { popups: outPopups, dummies: outDummies };
    }

    camera.getWorldDirection(_camFwd);

    for (const p of this.popups) {
      _toDummy.subVectors(p.worldPos, camera.position);
      if (_toDummy.dot(_camFwd) <= 0.15) continue;

      _proj.copy(p.worldPos).project(camera);
      if (_proj.z < -1 || _proj.z > 1) continue;

      const sx = (_proj.x * 0.5 + 0.5) * viewportWidth;
      const sy = (-_proj.y * 0.5 + 0.5) * viewportHeight;
      if (sx < -40 || sx > viewportWidth + 40 || sy < -20 || sy > viewportHeight + 40) continue;

      const t = p.age / p.lifetime;
      outPopups.push({
        id: p.id,
        text: p.text,
        isCritical: p.isCritical,
        screenX: sx,
        screenY: sy,
        opacity: THREE.MathUtils.clamp(t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8, 0, 1),
        scale: p.isCritical ? 1.18 - t * 0.12 : 1.0,
      });
    }

    for (const d of this.dummies) {
      const dist = Math.hypot(
        d.spec.position[0] - playerPos.x,
        d.spec.position[2] - playerPos.z
      );
      if (d.hudRevealTimer <= 0 && dist > 5.8) continue;

      _worldAnchor.set(d.spec.position[0], d.spec.position[1] + 2.02, d.spec.position[2]);
      _toDummy.subVectors(_worldAnchor, camera.position);
      if (_toDummy.dot(_camFwd) <= 0.15) continue;

      _proj.copy(_worldAnchor).project(camera);
      if (_proj.z < -1 || _proj.z > 1) continue;

      const sx = (_proj.x * 0.5 + 0.5) * viewportWidth;
      const sy = (-_proj.y * 0.5 + 0.5) * viewportHeight;
      if (sx < 24 || sx > viewportWidth - 24 || sy < 24 || sy > viewportHeight - 24) continue;

      outDummies.push({
        id: d.spec.id,
        name: d.spec.name,
        hp: d.hp,
        maxHp: d.maxHp,
        screenX: sx,
        screenY: sy,
        opacity: d.hudRevealTimer > 0 ? 1 : THREE.MathUtils.clamp(1 - (dist - 4.2) / 1.6, 0, 0.9),
      });
    }

    return { popups: outPopups, dummies: outDummies };
  }

  public consumeDefeats(): number {
    const count = this.pendingDefeats;
    this.pendingDefeats = 0;
    return count;
  }

  public dispose(): void {
    this.clearDummies();
    this.effekseerVfx.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
