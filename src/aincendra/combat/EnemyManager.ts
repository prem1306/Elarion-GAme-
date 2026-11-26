import * as THREE from 'three';
import type { BoxCollider, DummyStatusReadout, FloatingCombatPopup } from '../core/types';
import type { RecastNavSystem } from '../navigation/RecastNavSystem';
import { applyEnemyStanceDamage, resolveRiposteStrike } from '../rpg/gasAttributes';
import type { EnemyArchetype } from '../rpg/rpgTypes';
import { ModelAssetCache, type LocalModelKey } from '../world/ModelAssetCache';

const _toPlayer = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _worldAnchor = new THREE.Vector3();

export interface EnemySpawnDef {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  position: [number, number, number];
  isBoss?: boolean;
  isWilds?: boolean;
}

export interface EnemyDropEvent {
  enemyId: string;
  name: string;
  archetype: EnemyArchetype;
  isBoss: boolean;
  isWilds: boolean;
  xp: number;
  crowns: number;
  lootItemId: string;
  lootQty: number;
}

export interface EnemyPlayerHitEvent {
  attackerId: string;
  rawDamage: number;
  attackerName: string;
  knockDirX: number;
  knockDirZ: number;
  heavy: boolean;
}

export interface EnemyHitOutcome {
  hits: number;
  stanceBroken: boolean;
  riposteTriggered: boolean;
  riposteHeatRelief: number;
  riposteCapacitorGain: number;
}

interface EnemyRuntime {
  def: EnemySpawnDef;
  root: THREE.Group;
  modelHolder: THREE.Group;
  fallbackGroup: THREE.Group;
  telegraphRing: THREE.Mesh;
  telegraphMat: THREE.MeshBasicMaterial;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  pos: THREE.Vector3;
  homePos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  radius: number;
  speed: number;
  aggroRange: number;
  xpReward: number;
  crownReward: number;
  lootItemId: string;
  lootQty: number;
  state: 'idle' | 'engage' | 'windup' | 'recover' | 'staggered' | 'ko' | 'respawning';
  stateTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  hudRevealTimer: number;
  respawnTimer: number;
  lastHitSwingId: number;
  strafeSign: number;
  strafeFlipTimer: number;
  slowTimer: number;
  hasToken: boolean;
  navTargetX: number;
  navTargetZ: number;
  navTimer: number;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  hitMaterials: THREE.MeshStandardMaterial[];
}

interface EnemyProjectile {
  mesh: THREE.Mesh;
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  damage: number;
  sourceName: string;
}

interface PopupRuntime {
  id: string;
  text: string;
  isCritical: boolean;
  worldPos: THREE.Vector3;
  age: number;
  lifetime: number;
}

const MAX_ATTACK_TOKENS = 3;
const PROJECTILE_POOL_SIZE = 18;

const ARCHETYPE_MODEL: Record<EnemyArchetype, LocalModelKey> = {
  sentinel: 'dark_sentinel',
  'ley-mage': 'ley_mage',
  'furnace-golem': 'furnace_golem',
  'crystal-wyrm': 'crystal_wyrm',
};

const ARCHETYPE_HEIGHT: Record<EnemyArchetype, number> = {
  sentinel: 2.15,
  'ley-mage': 1.92,
  'furnace-golem': 2.85,
  'crystal-wyrm': 4.4,
};

function createContactShadowTex(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class EnemyManager {
  public readonly group = new THREE.Group();
  private readonly enemies: EnemyRuntime[] = [];
  private readonly projectiles: EnemyProjectile[] = [];
  private readonly popups: PopupRuntime[] = [];
  private readonly modelCache: ModelAssetCache;
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly shadowTex: THREE.CanvasTexture;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private popupSeq = 0;

  constructor(modelCache: ModelAssetCache) {
    this.group.name = 'Aincendra_Enemy_Manager';
    this.modelCache = modelCache;

    this.shadowTex = createContactShadowTex();
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    this.disposables.push(this.shadowTex, this.shadowMat);

    // Pre-allocated projectile pool for Ley Mages & Crystal Wyrm
    const orbGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    this.disposables.push(orbGeo, orbMat);
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.projectiles.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        damage: 14,
        sourceName: 'Ley Mage',
      });
    }
  }

  public spawnElarionEnemies(groundHeightAt?: (x: number, z: number) => number): void {
    this.clear();

    const gy = (x: number, z: number) => (groundHeightAt ? groundHeightAt(x, z) : 0.16);
    const defs: EnemySpawnDef[] = [
      {
        id: 'enm_sentinel_foundry',
        name: 'Corrupted Sentinel',
        archetype: 'sentinel',
        position: [-46, gy(-46, 38), 38],
      },
      {
        id: 'enm_sentinel_freight',
        name: 'Freight-Yard Sentinel',
        archetype: 'sentinel',
        position: [-144, gy(-144, 52), 52],
      },
      {
        id: 'enm_golem_smelting',
        name: 'Furnace Golem',
        archetype: 'furnace-golem',
        position: [-102, gy(-102, 22), 22],
      },
      {
        id: 'enm_mage_academic',
        name: 'Rogue Ley-Mage',
        archetype: 'ley-mage',
        position: [72, gy(72, 74), 74],
      },
      {
        id: 'enm_sentinel_citadel',
        name: 'Citadel Ward Sentinel',
        archetype: 'sentinel',
        position: [152, gy(152, 68), 68],
      },
      {
        id: 'enm_mage_merchant',
        name: 'Aether Siphoner',
        archetype: 'ley-mage',
        position: [-46, gy(-46, 206), 206],
      },
      {
        id: 'enm_sentinel_southroad',
        name: 'Bastion Road Sentinel',
        archetype: 'sentinel',
        position: [52, gy(52, 245), 245],
      },
      // Vaelcrest Wilds (South of Bastion Gate)
      {
        id: 'enm_wilds_sentinel',
        name: 'Blighted Sentinel',
        archetype: 'sentinel',
        position: [-18, gy(-18, 382), 382],
        isWilds: true,
      },
      {
        id: 'enm_wilds_mage',
        name: 'Wilds Ley-Conduit Mage',
        archetype: 'ley-mage',
        position: [26, gy(26, 424), 424],
        isWilds: true,
      },
      {
        id: 'enm_wilds_golem',
        name: 'Overclocked Furnace Golem',
        archetype: 'furnace-golem',
        position: [-42, gy(-42, 468), 468],
        isWilds: true,
      },
      {
        id: 'boss_crystal_wyrm',
        name: 'Aetheric Crystal Wyrm',
        archetype: 'crystal-wyrm',
        position: [0, gy(0, 522), 522],
        isBoss: true,
        isWilds: true,
      },
    ];

    for (const def of defs) {
      this.createEnemy(def);
    }
  }

  private buildFallbackComposite(archetype: EnemyArchetype): {
    group: THREE.Group;
    mats: THREE.MeshStandardMaterial[];
  } {
    const g = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];

    if (archetype === 'sentinel') {
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x262c36, roughness: 0.35, metalness: 0.78 });
      const crimson = new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      });
      mats.push(darkSteel, crimson);
      const legGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.9, 8);
      const torsoGeo = new THREE.BoxGeometry(0.68, 0.85, 0.42);
      const pauldronGeo = new THREE.SphereGeometry(0.24, 10, 8);
      const helmGeo = new THREE.ConeGeometry(0.22, 0.48, 6);
      const bladeGeo = new THREE.BoxGeometry(0.08, 1.15, 0.16);
      this.disposables.push(legGeo, torsoGeo, pauldronGeo, helmGeo, bladeGeo);

      const legL = new THREE.Mesh(legGeo, darkSteel);
      legL.position.set(-0.18, 0.45, 0);
      const legR = new THREE.Mesh(legGeo, darkSteel);
      legR.position.set(0.18, 0.45, 0);
      const torso = new THREE.Mesh(torsoGeo, darkSteel);
      torso.position.y = 1.25;
      const pL = new THREE.Mesh(pauldronGeo, crimson);
      pL.position.set(-0.44, 1.56, 0);
      const pR = new THREE.Mesh(pauldronGeo, crimson);
      pR.position.set(0.44, 1.56, 0);
      const helm = new THREE.Mesh(helmGeo, darkSteel);
      helm.position.y = 1.92;
      const blade = new THREE.Mesh(bladeGeo, crimson);
      blade.position.set(0.54, 1.12, 0.38);
      blade.rotation.x = 0.6;
      g.add(legL, legR, torso, pL, pR, helm, blade);
    } else if (archetype === 'ley-mage') {
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x3b1e54, roughness: 0.76, metalness: 0.12 });
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xd8b4fe,
        emissive: 0x9333ea,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      });
      mats.push(robeMat, glowMat);
      const robeGeo = new THREE.ConeGeometry(0.45, 1.45, 10);
      const hoodGeo = new THREE.SphereGeometry(0.22, 10, 8);
      const staffGeo = new THREE.CylinderGeometry(0.035, 0.04, 1.85, 8);
      const orbGeo = new THREE.OctahedronGeometry(0.15, 0);
      this.disposables.push(robeGeo, hoodGeo, staffGeo, orbGeo);

      const robe = new THREE.Mesh(robeGeo, robeMat);
      robe.position.y = 0.72;
      const hood = new THREE.Mesh(hoodGeo, robeMat);
      hood.position.y = 1.58;
      const staff = new THREE.Mesh(staffGeo, robeMat);
      staff.position.set(0.42, 0.95, 0.2);
      const orb = new THREE.Mesh(orbGeo, glowMat);
      orb.position.set(0.42, 1.95, 0.2);
      g.add(robe, hood, staff, orb);
    } else if (archetype === 'furnace-golem') {
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x3f3732, roughness: 0.55, metalness: 0.72 });
      const magmaMat = new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xea580c,
        emissiveIntensity: 1.35,
        roughness: 0.25,
      });
      mats.push(ironMat, magmaMat);
      const bodyGeo = new THREE.BoxGeometry(1.25, 1.45, 0.92);
      const coreGeo = new THREE.OctahedronGeometry(0.42, 1);
      const armGeo = new THREE.BoxGeometry(0.42, 1.35, 0.44);
      const headGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.45, 8);
      this.disposables.push(bodyGeo, coreGeo, armGeo, headGeo);

      const body = new THREE.Mesh(bodyGeo, ironMat);
      body.position.y = 1.45;
      const core = new THREE.Mesh(coreGeo, magmaMat);
      core.position.set(0, 1.45, 0.42);
      const armL = new THREE.Mesh(armGeo, ironMat);
      armL.position.set(-0.9, 1.25, 0.1);
      const armR = new THREE.Mesh(armGeo, ironMat);
      armR.position.set(0.9, 1.25, 0.1);
      const head = new THREE.Mesh(headGeo, ironMat);
      head.position.y = 2.38;
      g.add(body, core, armL, armR, head);
    } else {
      // crystal-wyrm boss fallback
      const scaleMat = new THREE.MeshStandardMaterial({ color: 0x164e63, roughness: 0.32, metalness: 0.6 });
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.1,
        roughness: 0.18,
      });
      mats.push(scaleMat, crystalMat);
      const bodyGeo = new THREE.CapsuleGeometry(0.75, 2.2, 8, 12);
      const wingGeo = new THREE.BoxGeometry(2.6, 0.12, 1.25);
      const headGeo = new THREE.ConeGeometry(0.55, 1.4, 6);
      const crestGeo = new THREE.OctahedronGeometry(0.45, 0);
      this.disposables.push(bodyGeo, wingGeo, headGeo, crestGeo);

      const body = new THREE.Mesh(bodyGeo, scaleMat);
      body.rotation.x = Math.PI / 2.4;
      body.position.y = 1.85;
      const wingL = new THREE.Mesh(wingGeo, crystalMat);
      wingL.position.set(-1.6, 2.35, -0.2);
      wingL.rotation.z = 0.35;
      const wingR = new THREE.Mesh(wingGeo, crystalMat);
      wingR.position.set(1.6, 2.35, -0.2);
      wingR.rotation.z = -0.35;
      const head = new THREE.Mesh(headGeo, scaleMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 2.75, 1.55);
      const crest = new THREE.Mesh(crestGeo, crystalMat);
      crest.position.set(0, 3.3, 1.0);
      g.add(body, wingL, wingR, head, crest);
    }

    for (const m of mats) this.disposables.push(m);
    return { group: g, mats };
  }

  private createEnemy(def: EnemySpawnDef): void {
    const root = new THREE.Group();
    root.name = `Enemy_${def.id}`;
    root.position.set(def.position[0], def.position[1], def.position[2]);

    const shadowRadius = def.isBoss ? 2.4 : def.archetype === 'furnace-golem' ? 1.25 : 0.78;
    const shadowGeo = new THREE.CircleGeometry(shadowRadius, 18);
    shadowGeo.rotateX(-Math.PI / 2);
    this.disposables.push(shadowGeo);
    const shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
    shadowMesh.position.y = 0.02;
    root.add(shadowMesh);

    const teleRadius = def.isBoss ? 5.2 : def.archetype === 'furnace-golem' ? 4.4 : 2.55;
    const teleGeo = new THREE.RingGeometry(teleRadius * 0.62, teleRadius, 28);
    teleGeo.rotateX(-Math.PI / 2);
    const teleMat = new THREE.MeshBasicMaterial({
      color: def.archetype === 'ley-mage' ? 0xc084fc : 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(teleGeo, teleMat);
    const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
    telegraphRing.position.y = 0.04;
    telegraphRing.visible = false;
    root.add(telegraphRing);

    const modelHolder = new THREE.Group();
    const { group: fallbackGroup, mats: hitMaterials } = this.buildFallbackComposite(def.archetype);
    modelHolder.add(fallbackGroup);
    root.add(modelHolder);
    this.group.add(root);

    const statsByArchetype: Record<
      EnemyArchetype,
      { hp: number; poise: number; speed: number; radius: number; aggro: number; xp: number; cr: number; loot: string; qty: number }
    > = {
      sentinel: {
        hp: 115,
        poise: 60,
        speed: 4.1,
        radius: 0.75,
        aggro: 18,
        xp: 48,
        cr: 16,
        loot: 'iron_ore',
        qty: 1,
      },
      'ley-mage': {
        hp: 90,
        poise: 45,
        speed: 3.4,
        radius: 0.68,
        aggro: 22,
        xp: 55,
        cr: 20,
        loot: 'mana_shard',
        qty: 2,
      },
      'furnace-golem': {
        hp: 210,
        poise: 110,
        speed: 2.5,
        radius: 1.05,
        aggro: 19,
        xp: 90,
        cr: 32,
        loot: 'crystal_core',
        qty: 1,
      },
      'crystal-wyrm': {
        hp: 540,
        poise: 180,
        speed: 4.6,
        radius: 1.85,
        aggro: 32,
        xp: 280,
        cr: 120,
        loot: 'wyrm_scale',
        qty: 2,
      },
    };
    const st = statsByArchetype[def.archetype];

    const runtime: EnemyRuntime = {
      def,
      root,
      modelHolder,
      fallbackGroup,
      telegraphRing,
      telegraphMat: teleMat,
      hp: st.hp,
      maxHp: st.hp,
      poise: st.poise,
      maxPoise: st.poise,
      pos: new THREE.Vector3(...def.position),
      homePos: new THREE.Vector3(...def.position),
      vel: new THREE.Vector3(),
      yaw: 0,
      radius: st.radius,
      speed: st.speed,
      aggroRange: st.aggro,
      xpReward: st.xp,
      crownReward: st.cr,
      lootItemId: st.loot,
      lootQty: st.qty,
      state: 'idle',
      stateTimer: 0,
      attackCooldown: 1.2 + Math.random() * 0.8,
      hitFlashTimer: 0,
      hudRevealTimer: 0,
      respawnTimer: 0,
      lastHitSwingId: -1,
      strafeSign: Math.random() > 0.5 ? 1 : -1,
      strafeFlipTimer: 2.5,
      slowTimer: 0,
      hasToken: false,
      navTargetX: def.position[0],
      navTargetZ: def.position[2],
      navTimer: 0,
      mixer: null,
      idleAction: null,
      hitMaterials,
    };
    this.enemies.push(runtime);

    // Load local GLB asynchronously without blocking spawn
    this.modelCache.mountIntoContainer(
      modelHolder,
      ARCHETYPE_MODEL[def.archetype],
      ARCHETYPE_HEIGHT[def.archetype],
      fallbackGroup,
      (loadedGroup, animations) => {
        loadedGroup.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = (obj as THREE.Mesh).material;
            if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const clonedMat = (m as THREE.MeshStandardMaterial).clone();
              (obj as THREE.Mesh).material = clonedMat;
              runtime.hitMaterials.push(clonedMat);
              this.disposables.push(clonedMat);
            }
          }
        });
        if (animations.length > 0) {
          const mixer = new THREE.AnimationMixer(loadedGroup);
          const action = mixer.clipAction(animations[0]);
          action.play();
          runtime.mixer = mixer;
          runtime.idleAction = action;
        }
      }
    );
  }

  private spawnPopup(worldPos: THREE.Vector3, text: string, isCritical: boolean): void {
    this.popupSeq += 1;
    this.popups.push({
      id: `epop_${this.popupSeq}`,
      text,
      isCritical,
      worldPos: worldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.8, 0)),
      age: 0,
      lifetime: 0.9,
    });
  }

  private damageEnemy(
    e: EnemyRuntime,
    rawDmg: number,
    stanceDmg: number,
    pushX: number,
    pushZ: number,
    knockStrength: number,
    label: string,
    isCritical: boolean,
    dropsOut: EnemyDropEvent[]
  ): { stanceBroken: boolean } {
    if (e.state === 'ko' || e.state === 'respawning') return { stanceBroken: false };

    const dmg = Math.max(1, Math.round(rawDmg));
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlashTimer = 0.14;
    e.hudRevealTimer = 5.5;
    const kbScale = e.def.isBoss ? 0.25 : e.def.archetype === 'furnace-golem' ? 0.45 : 1.0;
    e.vel.x += pushX * knockStrength * kbScale;
    e.vel.z += pushZ * knockStrength * kbScale;

    this.spawnPopup(e.pos, label || `-${dmg}`, isCritical);

    let stanceBroken = false;
    if (e.hp > 0 && e.state !== 'staggered' && stanceDmg > 0) {
      const stanceRes = applyEnemyStanceDamage(e.poise, e.maxPoise, stanceDmg);
      e.poise = stanceRes.nextPoise;
      if (stanceRes.staggeredNow) {
        stanceBroken = true;
        e.state = 'staggered';
        e.stateTimer = 2.85;
        e.hasToken = false;
        e.telegraphMat.color.setHex(0xfbbf24);
        e.telegraphMat.opacity = 0.72;
        e.telegraphRing.visible = true;
        e.modelHolder.rotation.x = 0.28;
        this.spawnPopup(e.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 'STAGGERED!', true);
      }
    }

    if (e.hp <= 0) {
      e.state = 'ko';
      e.stateTimer = 0.48;
      e.hasToken = false;
      e.telegraphRing.visible = false;
      dropsOut.push({
        enemyId: e.def.id,
        name: e.def.name,
        archetype: e.def.archetype,
        isBoss: Boolean(e.def.isBoss),
        isWilds: Boolean(e.def.isWilds),
        xp: e.xpReward,
        crowns: e.crownReward,
        lootItemId: e.lootItemId,
        lootQty: e.lootQty,
      });
    }
    return { stanceBroken };
  }

  public applyParryStanceCounter(attackerId: string, stanceDamage: number): boolean {
    const e = this.enemies.find((item) => item.def.id === attackerId);
    if (!e || e.state === 'ko' || e.state === 'respawning' || e.state === 'staggered') {
      return false;
    }
    e.hudRevealTimer = 5.5;
    const res = applyEnemyStanceDamage(e.poise, e.maxPoise, stanceDamage);
    e.poise = res.nextPoise;
    if (res.staggeredNow) {
      e.state = 'staggered';
      e.stateTimer = 3.0;
      e.hasToken = false;
      e.telegraphMat.color.setHex(0xfbbf24);
      e.telegraphMat.opacity = 0.75;
      e.telegraphRing.visible = true;
      e.modelHolder.rotation.x = 0.28;
      this.spawnPopup(e.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 'PARRY STAGGER!', true);
      return true;
    }
    this.spawnPopup(e.pos, `STANCE -${Math.round(stanceDamage)}`, false);
    return false;
  }

  public applyMeleeSwing(
    swingId: number,
    playerPos: THREE.Vector3,
    facingYaw: number,
    range: number,
    minDot: number,
    damage: number,
    stanceDamage: number,
    attackPower: number,
    spellPower: number,
    isCritical: boolean,
    knockStrength: number,
    dropsOut: EnemyDropEvent[]
  ): EnemyHitOutcome {
    const fwdX = Math.sin(facingYaw);
    const fwdZ = Math.cos(facingYaw);
    const outcome: EnemyHitOutcome = {
      hits: 0,
      stanceBroken: false,
      riposteTriggered: false,
      riposteHeatRelief: 0,
      riposteCapacitorGain: 0,
    };

    for (const e of this.enemies) {
      if (e.state === 'ko' || e.state === 'respawning' || e.lastHitSwingId === swingId) continue;
      const dx = e.pos.x - playerPos.x;
      const dy = Math.abs(e.pos.y - playerPos.y);
      const dz = e.pos.z - playerPos.z;
      if (dy > 2.6) continue;
      const effRange = range + e.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq > effRange * effRange) continue;

      const dist = Math.max(0.01, Math.sqrt(distSq));
      const nx = dx / dist;
      const nz = dz / dist;
      const dot = nx * fwdX + nz * fwdZ;
      if (dist > 1.1 && dot < minDot) continue;

      e.lastHitSwingId = swingId;
      outcome.hits += 1;

      if (e.state === 'staggered') {
        const riposte = resolveRiposteStrike(attackPower, spellPower);
        e.state = 'recover';
        e.stateTimer = 0.55;
        e.poise = e.maxPoise;
        e.modelHolder.rotation.x = 0;
        e.telegraphRing.visible = false;
        e.telegraphMat.color.setHex(e.def.archetype === 'ley-mage' ? 0xc084fc : 0xef4444);
        outcome.riposteTriggered = true;
        outcome.riposteHeatRelief += riposte.heatRelief;
        outcome.riposteCapacitorGain += riposte.capacitorGain;
        this.damageEnemy(
          e,
          riposte.damage,
          0,
          nx,
          nz,
          11.5,
          `RIPOSTE! -${riposte.damage}`,
          true,
          dropsOut
        );
      } else {
        const tag = isCritical ? `-${damage} CRIT!` : `-${damage}`;
        const dmgRes = this.damageEnemy(
          e,
          damage,
          stanceDamage,
          nx,
          nz,
          knockStrength,
          tag,
          isCritical,
          dropsOut
        );
        if (dmgRes.stanceBroken) outcome.stanceBroken = true;
      }
    }
    return outcome;
  }

  public applyPointHit(
    worldPos: THREE.Vector3,
    hitRadius: number,
    damage: number,
    stanceDamage: number,
    pushDirX: number,
    pushDirZ: number,
    label: string,
    isCritical: boolean,
    dropsOut: EnemyDropEvent[]
  ): { hit: boolean; stanceBroken: boolean } {
    for (const e of this.enemies) {
      if (e.state === 'ko' || e.state === 'respawning') continue;
      const r = hitRadius + e.radius;
      const dx = e.pos.x - worldPos.x;
      const dz = e.pos.z - worldPos.z;
      if (
        dx * dx + dz * dz <= r * r &&
        worldPos.y >= e.pos.y - 0.5 &&
        worldPos.y <= e.pos.y + ARCHETYPE_HEIGHT[e.def.archetype] + 0.6
      ) {
        const dmgRes = this.damageEnemy(
          e,
          damage,
          stanceDamage,
          pushDirX,
          pushDirZ,
          6.5,
          label,
          isCritical,
          dropsOut
        );
        return { hit: true, stanceBroken: dmgRes.stanceBroken };
      }
    }
    return { hit: false, stanceBroken: false };
  }

  public applyAreaBurst(
    center: THREE.Vector3,
    radius: number,
    damage: number,
    stanceDamage: number,
    labelPrefix: string,
    chillSeconds: number,
    dropsOut: EnemyDropEvent[]
  ): { hits: number; stanceBroken: boolean } {
    let hitCount = 0;
    let stanceBroken = false;
    for (const e of this.enemies) {
      if (e.state === 'ko' || e.state === 'respawning') continue;
      const dx = e.pos.x - center.x;
      const dz = e.pos.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius + e.radius) {
        hitCount += 1;
        const nx = dist > 0.01 ? dx / dist : 0;
        const nz = dist > 0.01 ? dz / dist : 1;
        if (chillSeconds > 0) e.slowTimer = Math.max(e.slowTimer, chillSeconds);
        if (damage > 0 || stanceDamage > 0) {
          const dmgRes = this.damageEnemy(
            e,
            damage,
            stanceDamage,
            nx,
            nz,
            8.5,
            damage > 0 ? `-${damage} ${labelPrefix}` : labelPrefix,
            true,
            dropsOut
          );
          if (dmgRes.stanceBroken) stanceBroken = true;
        }
      }
    }
    return { hits: hitCount, stanceBroken };
  }

  public findNearestTargetPosition(playerPos: THREE.Vector3, maxRange: number): THREE.Vector3 | null {
    let best: EnemyRuntime | null = null;
    let bestDist = maxRange * maxRange;
    for (const e of this.enemies) {
      if (e.state === 'ko' || e.state === 'respawning') continue;
      const dx = e.pos.x - playerPos.x;
      const dz = e.pos.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDist) {
        bestDist = d2;
        best = e;
      }
    }
    return best ? best.pos.clone() : null;
  }

  private fireEnemyOrb(origin: THREE.Vector3, dirX: number, dirY: number, dirZ: number, speed: number, damage: number, sourceName: string): void {
    const slot = this.projectiles.find((p) => !p.active) ?? this.projectiles[0];
    slot.active = true;
    slot.pos.copy(origin);
    slot.vel.set(dirX, dirY, dirZ).normalize().multiplyScalar(speed);
    slot.age = 0;
    slot.damage = damage;
    slot.sourceName = sourceName;
    slot.mesh.position.copy(origin);
    slot.mesh.visible = true;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    groundHeightAt: ((x: number, z: number) => number) | undefined,
    boxColliders: BoxCollider[],
    playerHitsOut: EnemyPlayerHitEvent[],
    playerDefeated: boolean,
    navSystem?: RecastNavSystem
  ): void {
    const clampedDt = Math.min(dt, 0.05);

    let activeTokens = 0;
    for (const e of this.enemies) {
      if (e.hasToken) activeTokens += 1;
    }

    for (const e of this.enemies) {
      if (e.hudRevealTimer > 0) e.hudRevealTimer = Math.max(0, e.hudRevealTimer - clampedDt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - clampedDt);

      // Hit flash visual feedback
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - clampedDt);
        const on = e.hitFlashTimer > 0;
        for (const mat of e.hitMaterials) {
          mat.emissive.setHex(on ? 0xff9f43 : 0x000000);
          mat.emissiveIntensity = on ? 0.75 : 0;
        }
      }

      if (e.mixer && e.state !== 'ko' && e.state !== 'respawning') {
        e.mixer.update(clampedDt * (e.slowTimer > 0 ? 0.5 : 1.0));
      }

      if (e.state === 'respawning') {
        if (!e.def.isBoss) {
          e.respawnTimer -= clampedDt;
          if (e.respawnTimer <= 0) {
            e.hp = e.maxHp;
            e.poise = e.maxPoise;
            e.pos.copy(e.homePos);
            e.vel.set(0, 0, 0);
            e.root.visible = true;
            e.modelHolder.rotation.x = 0;
            e.modelHolder.scale.setScalar(1);
            e.state = 'idle';
          }
        }
        continue;
      }

      if (e.state === 'ko') {
        e.stateTimer -= clampedDt;
        const p = 1 - Math.max(0, e.stateTimer) / 0.48;
        e.modelHolder.rotation.x = THREE.MathUtils.lerp(0, Math.PI * 0.48, p);
        e.modelHolder.scale.setScalar(THREE.MathUtils.lerp(1, 0.12, p));
        if (e.stateTimer <= 0) {
          e.state = 'respawning';
          e.respawnTimer = 42;
          e.root.visible = false;
        }
        continue;
      }

      if (e.attackCooldown > 0) {
        e.attackCooldown = Math.max(0, e.attackCooldown - clampedDt);
      }

      const speedMult = e.slowTimer > 0 ? 0.55 : 1.0;
      _toPlayer.subVectors(playerPos, e.pos);
      const distXZ = Math.hypot(_toPlayer.x, _toPlayer.z);
      const distHome = Math.hypot(e.pos.x - e.homePos.x, e.pos.z - e.homePos.z);

      if (playerDefeated || distHome > 38) {
        e.hasToken = false;
        e.state = 'idle';
        e.modelHolder.rotation.x = 0;
        e.telegraphRing.visible = false;
      }

      if (e.state === 'staggered') {
        e.vel.x = THREE.MathUtils.damp(e.vel.x, 0, 12, clampedDt);
        e.vel.z = THREE.MathUtils.damp(e.vel.z, 0, 12, clampedDt);
        e.stateTimer -= clampedDt;
        e.telegraphMat.opacity = 0.48 + 0.35 * Math.sin(e.stateTimer * 18);
        e.telegraphRing.scale.setScalar(1.06 + Math.sin(e.stateTimer * 12) * 0.08);
        if (e.stateTimer <= 0) {
          e.state = 'engage';
          e.poise = e.maxPoise;
          e.modelHolder.rotation.x = 0;
          e.telegraphRing.visible = false;
          e.telegraphMat.color.setHex(e.def.archetype === 'ley-mage' ? 0xc084fc : 0xef4444);
        }
      } else if (e.state === 'idle') {
        if (!playerDefeated && distXZ <= e.aggroRange) {
          e.state = 'engage';
          e.hudRevealTimer = 3.0;
        } else if (distHome > 1.2) {
          const hx = (e.homePos.x - e.pos.x) / distHome;
          const hz = (e.homePos.z - e.pos.z) / distHome;
          e.vel.x = THREE.MathUtils.damp(e.vel.x, hx * e.speed * 0.65, 6, clampedDt);
          e.vel.z = THREE.MathUtils.damp(e.vel.z, hz * e.speed * 0.65, 6, clampedDt);
          e.yaw = Math.atan2(hx, hz);
        } else {
          e.vel.x = THREE.MathUtils.damp(e.vel.x, 0, 8, clampedDt);
          e.vel.z = THREE.MathUtils.damp(e.vel.z, 0, 8, clampedDt);
        }
      } else if (e.state === 'engage') {
        let dirX = distXZ > 0.01 ? _toPlayer.x / distXZ : 0;
        let dirZ = distXZ > 0.01 ? _toPlayer.z / distXZ : 1;

        if (distXZ > 3.5 && navSystem?.isReady()) {
          e.navTimer -= clampedDt;
          if (e.navTimer <= 0) {
            e.navTimer = 0.28;
            const wp = navSystem.computeNextWaypoint(e.pos, playerPos);
            if (wp) {
              e.navTargetX = wp.x;
              e.navTargetZ = wp.z;
            } else {
              e.navTargetX = playerPos.x;
              e.navTargetZ = playerPos.z;
            }
          }
          const nx = e.navTargetX - e.pos.x;
          const nz = e.navTargetZ - e.pos.z;
          const nd = Math.hypot(nx, nz);
          if (nd > 0.25) {
            dirX = nx / nd;
            dirZ = nz / nd;
          }
        }
        e.yaw = Math.atan2(dirX, dirZ);

        e.strafeFlipTimer -= clampedDt;
        if (e.strafeFlipTimer <= 0) {
          e.strafeFlipTimer = 2.2 + Math.random() * 1.5;
          e.strafeSign *= -1;
        }
        const perpX = -dirZ * e.strafeSign;
        const perpZ = dirX * e.strafeSign;

        // Distinct Movement Policy per Archetype
        if (e.def.archetype === 'ley-mage') {
          // Kiter: backs up if < 7m, advances if > 14m, strafes smoothly between 7-14m
          let radial = 0;
          if (distXZ < 7.0) radial = -0.9;
          else if (distXZ > 14.0) radial = 0.85;
          _desired.set(dirX * radial + perpX * 0.55, 0, dirZ * radial + perpZ * 0.55);
          if (_desired.lengthSq() > 0.01) _desired.normalize();
          e.vel.x = THREE.MathUtils.damp(e.vel.x, _desired.x * e.speed * speedMult, 7, clampedDt);
          e.vel.z = THREE.MathUtils.damp(e.vel.z, _desired.z * e.speed * speedMult, 7, clampedDt);
        } else if (e.def.archetype === 'furnace-golem') {
          // Heavy Juggernaut: steady inexorable push toward AoE slam radius
          const moveWeight = distXZ > 2.8 ? 1.0 : 0.0;
          e.vel.x = THREE.MathUtils.damp(e.vel.x, dirX * e.speed * moveWeight * speedMult, 5, clampedDt);
          e.vel.z = THREE.MathUtils.damp(e.vel.z, dirZ * e.speed * moveWeight * speedMult, 5, clampedDt);
        } else if (e.def.archetype === 'crystal-wyrm') {
          // Boss: swooping flank orbit + lunge
          const radial = distXZ > 6.5 ? 0.9 : distXZ < 3.4 ? -0.4 : 0.15;
          _desired.set(dirX * radial + perpX * 0.72, 0, dirZ * radial + perpZ * 0.72).normalize();
          e.vel.x = THREE.MathUtils.damp(e.vel.x, _desired.x * e.speed * speedMult, 6, clampedDt);
          e.vel.z = THREE.MathUtils.damp(e.vel.z, _desired.z * e.speed * speedMult, 6, clampedDt);
        } else {
          // Sentinel Chaser/Flanker
          const radial = distXZ > 2.25 ? 0.95 : 0.0;
          _desired.set(dirX * radial + perpX * 0.36, 0, dirZ * radial + perpZ * 0.36);
          if (_desired.lengthSq() > 0.01) _desired.normalize();
          e.vel.x = THREE.MathUtils.damp(e.vel.x, _desired.x * e.speed * speedMult, 8, clampedDt);
          e.vel.z = THREE.MathUtils.damp(e.vel.z, _desired.z * e.speed * speedMult, 8, clampedDt);
        }

        const triggerRange =
          e.def.archetype === 'ley-mage'
            ? 17.5
            : e.def.archetype === 'furnace-golem'
              ? 4.2
              : e.def.archetype === 'crystal-wyrm'
                ? 11.5
                : 2.7;

        if (distXZ <= triggerRange && e.attackCooldown <= 0 && activeTokens < MAX_ATTACK_TOKENS) {
          e.hasToken = true;
          activeTokens += 1;
          e.state = 'windup';
          e.stateTimer =
            e.def.archetype === 'furnace-golem'
              ? 0.78
              : e.def.archetype === 'crystal-wyrm'
                ? 0.72
                : e.def.archetype === 'ley-mage'
                  ? 0.55
                  : 0.48;
          e.telegraphRing.visible = true;
          e.telegraphMat.opacity = 0.25;
        }
      } else if (e.state === 'windup') {
        e.vel.x = THREE.MathUtils.damp(e.vel.x, 0, 12, clampedDt);
        e.vel.z = THREE.MathUtils.damp(e.vel.z, 0, 12, clampedDt);
        e.stateTimer -= clampedDt;
        const pulse = 0.45 + 0.45 * Math.sin(e.stateTimer * 24);
        e.telegraphMat.opacity = pulse;
        e.telegraphRing.scale.setScalar(1.0 + Math.max(0, e.stateTimer) * 0.25);

        if (e.stateTimer <= 0) {
          e.telegraphRing.visible = false;
          e.hasToken = false;
          e.state = 'recover';
          e.stateTimer = 0.42;
          e.attackCooldown = e.def.isBoss ? 2.1 : e.def.archetype === 'furnace-golem' ? 2.8 : 2.0;

          const dirX = distXZ > 0.01 ? _toPlayer.x / distXZ : Math.sin(e.yaw);
          const dirZ = distXZ > 0.01 ? _toPlayer.z / distXZ : Math.cos(e.yaw);

          if (e.def.archetype === 'ley-mage') {
            this.fireEnemyOrb(
              new THREE.Vector3(e.pos.x, e.pos.y + 1.4, e.pos.z),
              dirX,
              (playerPos.y + 1.1 - (e.pos.y + 1.4)) / Math.max(4, distXZ),
              dirZ,
              15.5,
              14,
              e.def.name
            );
          } else if (e.def.archetype === 'crystal-wyrm') {
            if (distXZ > 5.4) {
              // 3-orb crystal fan
              for (const angleOffset of [-0.22, 0, 0.22]) {
                const cosA = Math.cos(angleOffset);
                const sinA = Math.sin(angleOffset);
                const rx = dirX * cosA - dirZ * sinA;
                const rz = dirX * sinA + dirZ * cosA;
                this.fireEnemyOrb(
                  new THREE.Vector3(e.pos.x, e.pos.y + 2.1, e.pos.z),
                  rx,
                  -0.06,
                  rz,
                  17.5,
                  18,
                  e.def.name
                );
              }
            } else if (distXZ <= 5.4) {
              playerHitsOut.push({
                attackerId: e.def.id,
                rawDamage: 28,
                attackerName: e.def.name,
                knockDirX: dirX,
                knockDirZ: dirZ,
                heavy: true,
              });
            }
          } else if (e.def.archetype === 'furnace-golem') {
            if (distXZ <= 4.6) {
              playerHitsOut.push({
                attackerId: e.def.id,
                rawDamage: 24,
                attackerName: e.def.name,
                knockDirX: dirX,
                knockDirZ: dirZ,
                heavy: true,
              });
            }
          } else if (distXZ <= 3.1) {
            playerHitsOut.push({
              attackerId: e.def.id,
              rawDamage: 16,
              attackerName: e.def.name,
              knockDirX: dirX,
              knockDirZ: dirZ,
              heavy: false,
            });
          }
        }
      } else if (e.state === 'recover') {
        e.vel.x = THREE.MathUtils.damp(e.vel.x, 0, 10, clampedDt);
        e.vel.z = THREE.MathUtils.damp(e.vel.z, 0, 10, clampedDt);
        e.stateTimer -= clampedDt;
        if (e.stateTimer <= 0) {
          e.state = 'engage';
        }
      }

      // Integrate velocity + basic obstacle separation
      e.pos.x += e.vel.x * clampedDt;
      e.pos.z += e.vel.z * clampedDt;
      for (const b of boxColliders) {
        if (b.maxY < e.pos.y + 0.3 || b.minY > e.pos.y + 2.0) continue;
        const cx = THREE.MathUtils.clamp(e.pos.x, b.minX, b.maxX);
        const cz = THREE.MathUtils.clamp(e.pos.z, b.minZ, b.maxZ);
        const dx = e.pos.x - cx;
        const dz = e.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < e.radius * e.radius && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          e.pos.x += (dx / d) * (e.radius - d);
          e.pos.z += (dz / d) * (e.radius - d);
        }
      }

      const gy = groundHeightAt ? groundHeightAt(e.pos.x, e.pos.z) : e.homePos.y;
      e.pos.y = Math.max(gy, 0.16 * (e.pos.z <= 335 ? 1 : -10));
      if (e.pos.z > 335 || Math.abs(e.pos.x) > 295) {
        e.pos.y = gy;
      } else {
        e.pos.y = Math.max(0.16, gy);
      }
      e.root.position.copy(e.pos);
      e.modelHolder.rotation.y = e.yaw;
    }

    // Update enemy projectiles
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.age += clampedDt;
      p.pos.addScaledVector(p.vel, clampedDt);
      p.mesh.position.copy(p.pos);

      const dx = playerPos.x - p.pos.x;
      const dz = playerPos.z - p.pos.z;
      const dy = playerPos.y + 1.05 - p.pos.y;
      if (!playerDefeated && dx * dx + dz * dz < 0.72 * 0.72 && Math.abs(dy) < 1.15) {
        const len = Math.max(0.01, Math.hypot(p.vel.x, p.vel.z));
        playerHitsOut.push({
          attackerId: 'projectile',
          rawDamage: p.damage,
          attackerName: p.sourceName,
          knockDirX: p.vel.x / len,
          knockDirZ: p.vel.z / len,
          heavy: false,
        });
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.age >= 3.2) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // Age damage popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.age += clampedDt;
      pop.worldPos.y += clampedDt * 1.1;
      if (pop.age >= pop.lifetime) {
        this.popups.splice(i, 1);
      }
    }
  }

  public getBossHudInfo(
    playerPos: THREE.Vector3
  ): { name: string; hp: number; maxHp: number; poise: number; maxPoise: number; staggered: boolean } | null {
    const boss = this.enemies.find((e) => e.def.isBoss && e.state !== 'respawning');
    if (!boss) return null;
    const dist = Math.hypot(boss.pos.x - playerPos.x, boss.pos.z - playerPos.z);
    if (dist > 45 && boss.hudRevealTimer <= 0) return null;
    return {
      name: boss.def.name,
      hp: boss.hp,
      maxHp: boss.maxHp,
      poise: boss.poise,
      maxPoise: boss.maxPoise,
      staggered: boss.state === 'staggered',
    };
  }

  public getNearbyEnemyCount(playerPos: THREE.Vector3): number {
    let n = 0;
    for (const e of this.enemies) {
      if (e.state === 'ko' || e.state === 'respawning') continue;
      if (Math.hypot(e.pos.x - playerPos.x, e.pos.z - playerPos.z) <= 26) n += 1;
    }
    return n;
  }

  public projectEnemyOverlays(
    camera: THREE.Camera,
    viewportWidth: number,
    viewportHeight: number,
    playerPos: THREE.Vector3
  ): { popups: FloatingCombatPopup[]; bars: DummyStatusReadout[] } {
    const outPopups: FloatingCombatPopup[] = [];
    const outBars: DummyStatusReadout[] = [];
    if (viewportWidth <= 0 || viewportHeight <= 0) return { popups: outPopups, bars: outBars };

    camera.getWorldDirection(_camFwd);

    for (const p of this.popups) {
      _toPlayer.subVectors(p.worldPos, camera.position);
      if (_toPlayer.dot(_camFwd) <= 0.15) continue;
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
        scale: p.isCritical ? 1.2 - t * 0.12 : 1.0,
      });
    }

    for (const e of this.enemies) {
      if (e.state === 'respawning' || e.state === 'ko' || e.def.isBoss) continue;
      const dist = Math.hypot(e.pos.x - playerPos.x, e.pos.z - playerPos.z);
      if (e.hudRevealTimer <= 0 && dist > 11) continue;

      _worldAnchor.set(e.pos.x, e.pos.y + ARCHETYPE_HEIGHT[e.def.archetype] + 0.35, e.pos.z);
      _toPlayer.subVectors(_worldAnchor, camera.position);
      if (_toPlayer.dot(_camFwd) <= 0.15) continue;
      _proj.copy(_worldAnchor).project(camera);
      if (_proj.z < -1 || _proj.z > 1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * viewportWidth;
      const sy = (-_proj.y * 0.5 + 0.5) * viewportHeight;
      if (sx < 24 || sx > viewportWidth - 24 || sy < 24 || sy > viewportHeight - 24) continue;

      outBars.push({
        id: e.def.id,
        name: e.def.name,
        hp: e.hp,
        maxHp: e.maxHp,
        poise: e.poise,
        maxPoise: e.maxPoise,
        staggered: e.state === 'staggered',
        screenX: sx,
        screenY: sy,
        opacity: e.hudRevealTimer > 0 ? 1 : THREE.MathUtils.clamp(1 - (dist - 8) / 3, 0, 0.9),
      });
    }

    return { popups: outPopups, bars: outBars };
  }

  public resetAll(): void {
    for (const e of this.enemies) {
      e.hp = e.maxHp;
      e.poise = e.maxPoise;
      e.pos.copy(e.homePos);
      e.vel.set(0, 0, 0);
      e.root.position.copy(e.homePos);
      e.root.visible = true;
      e.modelHolder.rotation.x = 0;
      e.modelHolder.scale.setScalar(1);
      e.state = 'idle';
      e.hasToken = false;
      e.telegraphRing.visible = false;
      e.hudRevealTimer = 0;
      e.slowTimer = 0;
    }
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.popups.length = 0;
  }

  public clear(): void {
    for (const e of this.enemies) {
      e.mixer?.stopAllAction();
      this.group.remove(e.root);
    }
    this.enemies.length = 0;
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.popups.length = 0;
  }

  public dispose(): void {
    this.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
