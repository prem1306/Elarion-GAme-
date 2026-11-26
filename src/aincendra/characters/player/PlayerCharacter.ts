import * as THREE from 'three';
import { OzzPoseMixer } from '../../animation/OzzPoseMixer';
import type {
  BoxCollider,
  CombatState,
  InputSnapshot,
  LocomotionState,
  MovementConfig,
  PlayerEmoteKind,
  RampCollider,
  WorldBounds,
} from '../../core/types';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _shotDir = new THREE.Vector3();

const SWING_DURATION = 0.38;
const SWING_ACTIVE_START = 0.08;
const SWING_ACTIVE_END = 0.24;
const HEAVY_DURATION = 0.62;
const HEAVY_ACTIVE_START = 0.22;
const HEAVY_ACTIVE_END = 0.46;
const SIDEARM_DURATION = 0.30;
const DODGE_DURATION = 0.40;
const VAULT_DURATION = 0.40;
const COMBO_WINDOW = 0.85;
const MAX_STAMINA = 100;

export function buildSabreWeaponMesh(disposables: Array<{ dispose: () => void }>): THREE.Group {
  const sword = new THREE.Group();
  sword.name = 'Vaelcrest_Training_Sabre';

  const matGrip = new THREE.MeshStandardMaterial({ color: 0x38241a, roughness: 0.78, metalness: 0.06 });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xc88a4b, roughness: 0.28, metalness: 0.86 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0xd6dde6, roughness: 0.22, metalness: 0.92 });
  const matManaEdge = new THREE.MeshStandardMaterial({
    color: 0x6dd9ec,
    emissive: 0x2a94ad,
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.35,
  });

  const gripGeo = new THREE.CylinderGeometry(0.017, 0.02, 0.2, 8);
  const pommelGeo = new THREE.OctahedronGeometry(0.028, 0);
  const guardGeo = new THREE.BoxGeometry(0.16, 0.024, 0.036);
  const bladeGeo = new THREE.BoxGeometry(0.022, 0.78, 0.056);
  const tipGeo = new THREE.ConeGeometry(0.029, 0.14, 4);
  const fullerGeo = new THREE.BoxGeometry(0.025, 0.56, 0.014);

  disposables.push(
    matGrip,
    matBrass,
    matSteel,
    matManaEdge,
    gripGeo,
    pommelGeo,
    guardGeo,
    bladeGeo,
    tipGeo,
    fullerGeo
  );

  const holder = new THREE.Group();
  holder.rotation.x = Math.PI / 2;

  const grip = new THREE.Mesh(gripGeo, matGrip);
  grip.position.y = -0.02;

  const pommel = new THREE.Mesh(pommelGeo, matBrass);
  pommel.position.y = -0.13;

  const guard = new THREE.Mesh(guardGeo, matBrass);
  guard.position.y = 0.09;
  guard.castShadow = true;

  const blade = new THREE.Mesh(bladeGeo, matSteel);
  blade.position.y = 0.49;
  blade.castShadow = true;

  const tip = new THREE.Mesh(tipGeo, matSteel);
  tip.scale.set(0.55, 1, 1);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 0.95;
  tip.castShadow = true;

  const fuller = new THREE.Mesh(fullerGeo, matManaEdge);
  fuller.position.y = 0.44;

  holder.add(grip, pommel, guard, blade, tip, fuller);
  sword.add(holder);
  return sword;
}

export function buildManaSidearmMesh(disposables: Array<{ dispose: () => void }>): THREE.Group {
  const pistol = new THREE.Group();
  pistol.name = 'Vaelcrest_Mana_Sidearm';

  const matSteel = new THREE.MeshStandardMaterial({ color: 0x3b444f, roughness: 0.34, metalness: 0.85 });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xc88a4b, roughness: 0.3, metalness: 0.85 });
  const matGrip = new THREE.MeshStandardMaterial({ color: 0x3d2418, roughness: 0.78 });
  const matCoil = new THREE.MeshStandardMaterial({
    color: 0x7de2f0,
    emissive: 0x2a9db8,
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });

  const barrelGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.26, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const frameGeo = new THREE.BoxGeometry(0.042, 0.068, 0.19);
  const gripGeo = new THREE.BoxGeometry(0.036, 0.12, 0.054);
  const coilGeo = new THREE.BoxGeometry(0.048, 0.028, 0.11);

  disposables.push(matSteel, matBrass, matGrip, matCoil, barrelGeo, frameGeo, gripGeo, coilGeo);

  const barrel = new THREE.Mesh(barrelGeo, matSteel);
  barrel.position.set(0, 0.02, 0.14);
  const frame = new THREE.Mesh(frameGeo, matBrass);
  frame.position.set(0, 0.0, 0.06);
  const grip = new THREE.Mesh(gripGeo, matGrip);
  grip.position.set(0, -0.075, -0.01);
  grip.rotation.x = 0.26;
  const coil = new THREE.Mesh(coilGeo, matCoil);
  coil.position.set(0, 0.028, 0.11);

  pistol.add(barrel, frame, grip, coil);
  return pistol;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SwingSnapshot {
  swingId: number;
  comboStep: 1 | 2 | 3;
  isHeavy: boolean;
  isSidearm: boolean;
  progress: number;
  isSwinging: boolean;
  isActiveWindow: boolean;
  guarding: boolean;
  facingYaw: number;
}

/**
 * Upgraded Realistic Humanoid Character Controller:
 * - Sculpted multi-part human anatomy (cheekbones, nasal bridge, layered eyes, mouth, ears,
 *   pelvis bridge, biceps/forearms/five-finger hand + thumb, calf-tapered legs, layered coat lapels)
 * - Full action suite: 3-step light combo, Heavy Cleave (R), Mana Sidearm shot (X),
 *   Directional Dodge-Roll (V / Alt), Sprint Vaulting over low crates/logs (Space),
 *   Social Emotes (Wave / Salute / Sit), and Stamina management.
 */
export class PlayerCharacter {
  public readonly root = new THREE.Group();
  public readonly visualPivot = new THREE.Group();
  private readonly rigUpper = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly leftHipPivot = new THREE.Group();
  private readonly rightHipPivot = new THREE.Group();
  private readonly leftKneePivot = new THREE.Group();
  private readonly rightKneePivot = new THREE.Group();
  private readonly leftShoulderPivot = new THREE.Group();
  private readonly rightShoulderPivot = new THREE.Group();
  private readonly leftElbowPivot = new THREE.Group();
  private readonly rightElbowPivot = new THREE.Group();
  private readonly weaponMount = new THREE.Group();
  private readonly sidearmMount = new THREE.Group();
  private readonly contactShadow: THREE.Mesh;

  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly poseMixer = new OzzPoseMixer();

  public readonly position = new THREE.Vector3();
  public readonly velocity = new THREE.Vector3();
  public yaw = 0;
  public grounded = true;
  public crouched = false;
  public sprinting = false;
  public currentHeight: number;
  public lastLandingImpulse = 0;

  // Stamina
  public stamina = MAX_STAMINA;
  public readonly maxStamina = MAX_STAMINA;
  private staminaRegenDelay = 0;

  private walkCycle = 0;
  private lastStepIndex = 0;
  private idleTime = 0;
  private landSquash = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private bankAngle = 0;

  // Combat & Action states
  private swingTimer = 0;
  private heavyTimer = 0;
  private sidearmTimer = 0;
  private dodgeTimer = 0;
  private dodgeDirX = 0;
  private dodgeDirZ = 1;
  private vaultTimer = 0;
  private swingId = 0;
  private comboStep: 1 | 2 | 3 = 1;
  private comboResetTimer = 0;
  private queuedAttack = false;
  public guarding = false;
  private guardDuration = 0;
  private spellCastTimer = 0;

  // Social Emote state
  public activeEmote: PlayerEmoteKind = 'none';
  private emoteTimer = 0;

  private config: MovementConfig;

  constructor(config: MovementConfig, spawnPoint: THREE.Vector3) {
    this.config = { ...config };
    this.currentHeight = config.standHeight;
    this.position.copy(spawnPoint);
    this.root.position.copy(spawnPoint);

    this.contactShadow = this.buildCompositeMesh();
    this.root.add(this.visualPivot);
    this.root.add(this.contactShadow);
  }

  public updateConfig(next: Partial<MovementConfig>): void {
    this.config = { ...this.config, ...next };
  }

  public setMeshVisible(visible: boolean): void {
    this.visualPivot.visible = visible;
    this.contactShadow.visible = visible;
  }

  public reset(spawnPoint: THREE.Vector3): void {
    this.position.copy(spawnPoint);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.crouched = false;
    this.sprinting = false;
    this.stamina = MAX_STAMINA;
    this.staminaRegenDelay = 0;
    this.currentHeight = this.config.standHeight;
    this.yaw = 0;
    this.landSquash = 0;
    this.lastLandingImpulse = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.bankAngle = 0;
    this.swingTimer = 0;
    this.heavyTimer = 0;
    this.sidearmTimer = 0;
    this.dodgeTimer = 0;
    this.vaultTimer = 0;
    this.comboStep = 1;
    this.comboResetTimer = 0;
    this.queuedAttack = false;
    this.guarding = false;
    this.guardDuration = 0;
    this.spellCastTimer = 0;
    this.activeEmote = 'none';
    this.emoteTimer = 0;
    this.root.position.copy(this.position);
    this.visualPivot.rotation.set(0, this.yaw, 0);
    this.rigUpper.rotation.set(0, 0, 0);
  }

  public isParryWindowActive(): boolean {
    return this.guarding && this.guardDuration <= 0.28;
  }

  public triggerSpellCastPose(facingYaw?: number): void {
    this.spellCastTimer = 0.34;
    if (facingYaw !== undefined) {
      this.yaw = facingYaw;
    }
    this.activeEmote = 'none';
  }

  public applyKnockback(dirX: number, dirZ: number, strength = 6.5): void {
    this.velocity.x += dirX * strength;
    this.velocity.z += dirZ * strength;
  }

  public triggerHitRecoil(pitchRad = -0.18, rollRad = 0.08): void {
    this.poseMixer.triggerAdditiveRecoil(pitchRad, rollRad);
  }

  public triggerRiposteLunge(targetYaw?: number): void {
    if (typeof targetYaw === 'number') {
      this.yaw = targetYaw;
    }
    this.poseMixer.triggerAdditiveRecoil(0.24, 0.06);
    this.velocity.x += Math.sin(this.yaw) * 6.2;
    this.velocity.z += Math.cos(this.yaw) * 6.2;
  }

  public triggerEmote(emote: PlayerEmoteKind): void {
    if (emote === 'none') {
      this.activeEmote = 'none';
      this.emoteTimer = 0;
      return;
    }
    if (!this.grounded || this.dodgeTimer > 0 || this.vaultTimer > 0) return;
    if (this.activeEmote === emote && emote === 'sit') {
      this.activeEmote = 'none';
      this.emoteTimer = 0;
      return;
    }
    this.activeEmote = emote;
    this.emoteTimer = emote === 'sit' ? 9999 : emote === 'salute' ? 1.85 : 2.1;
    this.swingTimer = 0;
    this.heavyTimer = 0;
    this.sidearmTimer = 0;
    this.guarding = false;
  }

  public consumeLandingImpulse(): number {
    const val = this.lastLandingImpulse;
    this.lastLandingImpulse = 0;
    return val;
  }

  public getLocomotionState(): LocomotionState {
    if (this.dodgeTimer > 0) return 'Dodge Rolling';
    if (this.vaultTimer > 0) return 'Vaulting';
    if (this.activeEmote === 'sit') return 'Sitting';
    if (this.activeEmote === 'wave') return 'Waving';
    if (this.activeEmote === 'salute') return 'Saluting';
    if (!this.grounded) return 'Airborne';
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.crouched) return 'Crouching';
    if (horizSpeed < 0.12) return 'Idle';
    if (this.sprinting) return 'Sprinting';
    return 'Walking';
  }

  public getCombatState(): CombatState {
    if (this.sidearmTimer > 0) return 'Sidearm Shot';
    if (this.heavyTimer > 0) {
      const elapsed = HEAVY_DURATION - this.heavyTimer;
      return elapsed < HEAVY_ACTIVE_START ? 'Heavy Windup' : 'Heavy Cleave';
    }
    if (this.swingTimer > 0) {
      const elapsed = SWING_DURATION - this.swingTimer;
      if (elapsed < SWING_ACTIVE_START) return 'Windup';
      if (this.comboStep === 3) return 'Finisher';
      return this.comboStep === 2 ? 'Slash 2' : 'Slash 1';
    }
    if (this.guarding) return 'Guarding';
    return 'Ready';
  }

  public getSwingSnapshot(): SwingSnapshot {
    if (this.heavyTimer > 0) {
      const elapsed = HEAVY_DURATION - this.heavyTimer;
      return {
        swingId: this.swingId,
        comboStep: 3,
        isHeavy: true,
        isSidearm: false,
        progress: THREE.MathUtils.clamp(elapsed / HEAVY_DURATION, 0, 1),
        isSwinging: true,
        isActiveWindow: elapsed >= HEAVY_ACTIVE_START && elapsed <= HEAVY_ACTIVE_END,
        guarding: false,
        facingYaw: this.yaw,
      };
    }
    if (this.sidearmTimer > 0) {
      const elapsed = SIDEARM_DURATION - this.sidearmTimer;
      return {
        swingId: this.swingId,
        comboStep: 1,
        isHeavy: false,
        isSidearm: true,
        progress: THREE.MathUtils.clamp(elapsed / SIDEARM_DURATION, 0, 1),
        isSwinging: false,
        isActiveWindow: false,
        guarding: false,
        facingYaw: this.yaw,
      };
    }
    const isSwinging = this.swingTimer > 0;
    const elapsed = isSwinging ? SWING_DURATION - this.swingTimer : 0;
    return {
      swingId: this.swingId,
      comboStep: this.comboStep,
      isHeavy: false,
      isSidearm: false,
      progress: isSwinging ? THREE.MathUtils.clamp(elapsed / SWING_DURATION, 0, 1) : 0,
      isSwinging,
      isActiveWindow:
        isSwinging && elapsed >= SWING_ACTIVE_START && elapsed <= SWING_ACTIVE_END,
      guarding: this.guarding,
      facingYaw: this.yaw,
    };
  }

  public getCameraAnchorY(): number {
    const sitOffset = this.activeEmote === 'sit' ? -0.36 : 0;
    return (
      this.position.y +
      sitOffset +
      THREE.MathUtils.lerp(
        0.98,
        1.48,
        (this.currentHeight - this.config.crouchHeight) /
          Math.max(0.01, this.config.standHeight - this.config.crouchHeight)
      )
    );
  }

  public getFirstPersonEyeY(): number {
    const sitOffset = this.activeEmote === 'sit' ? -0.38 : 0;
    return this.position.y + sitOffset + (this.crouched ? 1.02 : 1.62);
  }

  private spendStamina(amount: number): boolean {
    if (this.stamina < amount) return false;
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaRegenDelay = 0.65;
    return true;
  }

  public update(
    dt: number,
    input: InputSnapshot,
    cameraYaw: number,
    boxColliders: BoxCollider[],
    rampColliders: RampCollider[],
    worldBoundsRadius: number,
    worldBounds?: WorldBounds,
    defaultGroundY = 0,
    groundHeightAt?: (x: number, z: number) => number,
    callbacks?: {
      onFireSidearm?: (origin: THREE.Vector3, dir: THREE.Vector3) => void;
      onPlayerEmote?: (emote: PlayerEmoteKind) => void;
      onFootstep?: (sprinting: boolean) => void;
    }
  ): void {
    const clampedDt = Math.min(dt, 0.05);

    // 1. Crouch resolution with overhead ceiling clearance check
    if (input.crouchActive) {
      this.crouched = true;
    } else if (this.crouched && this.canStandUp(boxColliders)) {
      this.crouched = false;
    }

    const targetHeight = this.crouched ? this.config.crouchHeight : this.config.standHeight;
    this.currentHeight = THREE.MathUtils.damp(this.currentHeight, targetHeight, 16, clampedDt);

    // 2. Camera-relative normalized movement input
    _forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    _right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    _wishDir
      .set(0, 0, 0)
      .addScaledVector(_forward, input.moveForward)
      .addScaledVector(_right, input.moveRight);

    const hasMoveInput = _wishDir.lengthSq() > 0.0001;
    if (hasMoveInput) {
      _wishDir.normalize();
    }

    // Cancel social emotes smoothly if player moves, jumps, dodges, or attacks
    if (
      this.activeEmote !== 'none' &&
      (hasMoveInput ||
        input.jumpPressed ||
        input.attackPressed ||
        input.heavyAttackPressed ||
        input.firearmPressed ||
        input.dodgePressed ||
        input.guardHeld)
    ) {
      this.activeEmote = 'none';
      this.emoteTimer = 0;
    }

    if (input.emotePressed && input.emotePressed !== 'none') {
      this.triggerEmote(input.emotePressed);
      callbacks?.onPlayerEmote?.(this.activeEmote);
    }

    if (this.emoteTimer > 0 && this.activeEmote !== 'sit') {
      this.emoteTimer = Math.max(0, this.emoteTimer - clampedDt);
      if (this.emoteTimer === 0) {
        this.activeEmote = 'none';
      }
    }

    // 2.5 Action & Combat timers
    if (this.dodgeTimer > 0) this.dodgeTimer = Math.max(0, this.dodgeTimer - clampedDt);
    if (this.vaultTimer > 0) this.vaultTimer = Math.max(0, this.vaultTimer - clampedDt);
    if (this.sidearmTimer > 0) this.sidearmTimer = Math.max(0, this.sidearmTimer - clampedDt);
    if (this.spellCastTimer > 0) this.spellCastTimer = Math.max(0, this.spellCastTimer - clampedDt);

    if (this.heavyTimer > 0) {
      this.heavyTimer = Math.max(0, this.heavyTimer - clampedDt);
    } else if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - clampedDt);
      if (this.swingTimer === 0) {
        this.comboResetTimer = COMBO_WINDOW;
      }
    } else if (this.comboResetTimer > 0) {
      this.comboResetTimer = Math.max(0, this.comboResetTimer - clampedDt);
      if (this.comboResetTimer === 0) {
        this.comboStep = 1;
      }
    }

    const busyLock = this.dodgeTimer > 0 || this.vaultTimer > 0;

    // Dodge-Roll trigger (V / Left Alt)
    if (
      input.dodgePressed &&
      !busyLock &&
      this.grounded &&
      this.spendStamina(22)
    ) {
      this.dodgeTimer = DODGE_DURATION;
      this.swingTimer = 0;
      this.heavyTimer = 0;
      this.sidearmTimer = 0;
      this.guarding = false;
      this.crouched = false;
      if (hasMoveInput) {
        this.dodgeDirX = _wishDir.x;
        this.dodgeDirZ = _wishDir.z;
      } else {
        this.dodgeDirX = Math.sin(this.yaw);
        this.dodgeDirZ = Math.cos(this.yaw);
      }
      this.yaw = Math.atan2(this.dodgeDirX, this.dodgeDirZ);
      this.velocity.x = this.dodgeDirX * 12.6;
      this.velocity.z = this.dodgeDirZ * 12.6;
    }

    // Heavy Cleave (R)
    if (
      input.heavyAttackPressed &&
      !busyLock &&
      this.heavyTimer <= 0 &&
      this.swingTimer <= 0 &&
      this.spendStamina(20)
    ) {
      this.swingId += 1;
      this.heavyTimer = HEAVY_DURATION;
      this.queuedAttack = false;
      this.guarding = false;
      this.poseMixer.triggerAdditiveRecoil(0.14, -0.08);
      this.yaw = hasMoveInput
        ? Math.atan2(_wishDir.x, _wishDir.z)
        : Math.atan2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
      if (this.grounded) {
        this.velocity.x += Math.sin(this.yaw) * 3.8;
        this.velocity.z += Math.cos(this.yaw) * 3.8;
      }
    }

    // Mana Sidearm Shot (X)
    if (
      input.firearmPressed &&
      !busyLock &&
      this.sidearmTimer <= 0 &&
      this.heavyTimer <= 0
    ) {
      this.sidearmTimer = SIDEARM_DURATION;
      this.swingTimer = 0;
      this.guarding = false;
      const aimYaw = Math.atan2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
      this.yaw = aimYaw;
      _shotDir.set(Math.sin(aimYaw), -0.02, Math.cos(aimYaw)).normalize();
      _muzzleWorld.set(
        this.position.x + Math.sin(aimYaw) * 0.55 - Math.cos(aimYaw) * 0.24,
        this.position.y + (this.crouched ? 0.95 : 1.38),
        this.position.z + Math.cos(aimYaw) * 0.55 + Math.sin(aimYaw) * 0.24
      );
      callbacks?.onFireSidearm?.(_muzzleWorld, _shotDir);
    }

    // Standard 3-Hit Sabre Combo (LMB / F)
    if (input.attackPressed && !busyLock && this.heavyTimer <= 0) {
      if (this.swingTimer <= 0) {
        this.startSwing(hasMoveInput, cameraYaw);
      } else if (this.swingTimer < SWING_DURATION * 0.55) {
        this.queuedAttack = true;
      }
    }

    if (this.swingTimer <= 0 && this.queuedAttack && !busyLock && this.heavyTimer <= 0) {
      this.queuedAttack = false;
      this.startSwing(hasMoveInput, cameraYaw);
    }

    this.guarding = Boolean(
      input.guardHeld && !busyLock && this.swingTimer <= 0 && this.heavyTimer <= 0 && this.sidearmTimer <= 0
    );
    if (this.guarding) {
      this.guardDuration += clampedDt;
    } else {
      this.guardDuration = 0;
    }

    if (input.sprintHeld && this.crouched && !input.crouchActive && this.canStandUp(boxColliders)) {
      this.crouched = false;
    }

    const canSprint =
      Boolean(input.sprintHeld && hasMoveInput && !this.crouched && !this.guarding && !busyLock) &&
      this.stamina > 1.5;
    this.sprinting = canSprint;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - 14.0 * clampedDt);
      this.staminaRegenDelay = 0.55;
    } else if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay = Math.max(0, this.staminaRegenDelay - clampedDt);
    } else if (!busyLock && this.heavyTimer <= 0) {
      const regenRate = hasMoveInput ? 12.0 : 19.0;
      this.stamina = Math.min(MAX_STAMINA, this.stamina + regenRate * clampedDt);
    }

    // 3. Responsive Acceleration, Dodge Momentum & Braking
    if (this.dodgeTimer > 0) {
      const t = 1 - this.dodgeTimer / DODGE_DURATION;
      const speedCurve = THREE.MathUtils.lerp(13.0, 5.2, t * t);
      this.velocity.x = this.dodgeDirX * speedCurve;
      this.velocity.z = this.dodgeDirZ * speedCurve;
    } else if (this.vaultTimer > 0) {
      // Maintain crisp vault surge forward
    } else {
      let maxSpeed = this.config.walkSpeed;
      if (this.crouched) {
        maxSpeed = this.config.crouchSpeed;
      } else if (this.guarding) {
        maxSpeed = this.config.walkSpeed * 0.65;
      } else if (this.sprinting) {
        maxSpeed = this.config.sprintSpeed;
      }

      const targetVx = hasMoveInput ? _wishDir.x * maxSpeed : 0;
      const targetVz = hasMoveInput ? _wishDir.z * maxSpeed : 0;

      const currentHorizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      let rate: number;

      if (hasMoveInput) {
        let baseAccel = this.grounded
          ? this.config.acceleration
          : this.config.acceleration * this.config.airControl;

        if (this.grounded && currentHorizSpeed > 0.5) {
          const dot =
            (this.velocity.x * _wishDir.x + this.velocity.z * _wishDir.z) / currentHorizSpeed;
          if (dot < 0.25) {
            const reverseFactor = THREE.MathUtils.clamp((0.25 - dot) / 1.25, 0, 1);
            baseAccel *= 1 + reverseFactor * (this.config.pivotTraction - 1);
          }
        }
        rate = baseAccel;
      } else {
        rate = this.grounded ? this.config.deceleration : this.config.deceleration * 0.22;
      }

      const dvx = targetVx - this.velocity.x;
      const dvz = targetVz - this.velocity.z;
      const dvLen = Math.hypot(dvx, dvz);
      const maxStep = rate * clampedDt;

      if (dvLen <= maxStep) {
        this.velocity.x = targetVx;
        this.velocity.z = targetVz;
      } else if (dvLen > 0.00001) {
        this.velocity.x += (dvx / dvLen) * maxStep;
        this.velocity.z += (dvz / dvLen) * maxStep;
      }

      if (!hasMoveInput && Math.hypot(this.velocity.x, this.velocity.z) < 0.01) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    // 4. Coyote Time, Jump Input Buffering & Sprint Vaulting over low obstacles
    if (this.grounded) {
      this.coyoteTimer = this.config.coyoteTime;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - clampedDt);
    }

    if (input.jumpPressed) {
      this.jumpBufferTimer = this.config.jumpBufferTime;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - clampedDt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.crouched && !busyLock) {
      const horizSpeedNow = Math.hypot(this.velocity.x, this.velocity.z);
      if (
        (this.sprinting || horizSpeedNow > 5.2) &&
        this.detectVaultObstacle(boxColliders) &&
        this.spendStamina(14)
      ) {
        this.vaultTimer = VAULT_DURATION;
        this.velocity.y = 5.55;
        this.velocity.x = Math.sin(this.yaw) * 7.8;
        this.velocity.z = Math.cos(this.yaw) * 7.8;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      } else {
        this.velocity.y = this.config.jumpVelocity;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
    }

    // 5. Variable Jump Gravity & Apex Hang Polish
    if (!this.grounded) {
      let gravityScale = 1.0;
      if (this.velocity.y > 0 && !input.jumpHeld && this.vaultTimer <= 0) {
        gravityScale = 1.48;
      } else if (Math.abs(this.velocity.y) < 1.35) {
        gravityScale = 0.84;
      }
      this.velocity.y -= this.config.gravity * gravityScale * clampedDt;
    }

    // 6. Horizontal integration & wall/pillar collision
    this.position.x += this.velocity.x * clampedDt;
    this.position.z += this.velocity.z * clampedDt;
    this.resolveHorizontalCollisions(boxColliders, worldBoundsRadius, worldBounds);

    // 7. Vertical integration, terrain/ramp support & step-down snapping
    const wasGrounded = this.grounded;
    const prevVelY = this.velocity.y;
    const prevY = this.position.y;
    this.position.y += this.velocity.y * clampedDt;

    const baseGround = groundHeightAt
      ? groundHeightAt(this.position.x, this.position.z)
      : defaultGroundY;
    const supportY = this.sampleSupportHeight(
      this.position.x,
      this.position.z,
      prevY,
      boxColliders,
      rampColliders,
      baseGround
    );

    if (this.velocity.y > 0) {
      const ceilingY = this.sampleCeilingHeight(this.position.x, this.position.z, prevY, boxColliders);
      if (ceilingY !== null && this.position.y + this.currentHeight > ceilingY) {
        this.position.y = Math.max(prevY, ceilingY - this.currentHeight);
        this.velocity.y = 0;
      }
    }

    const snapWindow = wasGrounded ? this.config.stepDownSnap : 0.04;
    if (
      this.velocity.y <= 0 &&
      this.position.y <= supportY + snapWindow &&
      prevY + this.config.stepUpHeight >= supportY
    ) {
      this.position.y = supportY;
      this.velocity.y = 0;
      this.grounded = true;

      if (!wasGrounded && prevVelY < -2.2) {
        const impact = Math.min(1, Math.abs(prevVelY) / 14);
        this.landSquash = Math.min(0.22, impact * 0.24);
        this.lastLandingImpulse = Math.max(this.lastLandingImpulse, impact);

        if (prevVelY < -8.0) {
          this.velocity.x *= 0.82;
          this.velocity.z *= 0.82;
        }
      }
    } else if (this.position.y > supportY + 0.04) {
      this.grounded = false;
    } else if (this.position.y <= supportY) {
      this.position.y = supportY;
      this.velocity.y = 0;
      this.grounded = true;
    }

    // 8. Speed-weighted rotation alignment + subtle turn banking
    const postSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let turnRateRad = 0;
    if (hasMoveInput && postSpeed > 0.12 && this.dodgeTimer <= 0 && this.sidearmTimer <= 0) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      const deltaAngle = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw));
      const speedRatio = THREE.MathUtils.clamp(postSpeed / this.config.sprintSpeed, 0, 1);
      const effectiveRate = THREE.MathUtils.lerp(
        this.config.rotationRate * 1.4,
        this.config.rotationRate * 0.9,
        speedRatio
      );
      const alpha = 1 - Math.exp(-effectiveRate * clampedDt);
      const stepYaw = deltaAngle * alpha;
      this.yaw += stepYaw;
      turnRateRad = stepYaw / Math.max(0.001, clampedDt);
    }

    const targetBank = THREE.MathUtils.clamp(
      -turnRateRad * 0.025 * Math.min(1, postSpeed / 5),
      -0.14,
      0.14
    );
    this.bankAngle = THREE.MathUtils.damp(this.bankAngle, targetBank, 12, clampedDt);

    // 9. Update transforms & articulated procedural pose
    this.root.position.copy(this.position);
    this.visualPivot.rotation.y = this.yaw;
    this.visualPivot.rotation.z = this.bankAngle;
    this.animatePose(clampedDt, postSpeed, supportY, callbacks?.onFootstep);
  }

  private detectVaultObstacle(boxColliders: BoxCollider[]): boolean {
    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    const probeX = this.position.x + fwdX * 0.95;
    const probeZ = this.position.z + fwdZ * 0.95;
    const feetY = this.position.y;
    for (const b of boxColliders) {
      if (probeX > b.minX - 0.35 && probeX < b.maxX + 0.35 && probeZ > b.minZ - 0.35 && probeZ < b.maxZ + 0.35) {
        const obsH = b.maxY - feetY;
        if (obsH >= 0.38 && obsH <= 1.32 && b.minY <= feetY + 0.45) {
          return true;
        }
      }
    }
    return false;
  }

  private startSwing(hasMoveInput: boolean, cameraYaw: number): void {
    if (this.comboResetTimer > 0) {
      this.comboStep = this.comboStep === 1 ? 2 : this.comboStep === 2 ? 3 : 1;
    } else {
      this.comboStep = 1;
    }

    this.swingId += 1;
    this.swingTimer = SWING_DURATION;
    this.comboResetTimer = COMBO_WINDOW;
    this.guarding = false;
    this.poseMixer.triggerAdditiveRecoil(this.comboStep === 3 ? 0.12 : 0.06, this.comboStep === 2 ? -0.05 : 0.05);

    if (!hasMoveInput) {
      this.yaw = Math.atan2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
    } else {
      this.yaw = Math.atan2(_wishDir.x, _wishDir.z);
    }

    if (this.grounded) {
      const lungeSpeed = this.comboStep === 3 ? 3.1 : 2.1;
      this.velocity.x += Math.sin(this.yaw) * lungeSpeed;
      this.velocity.z += Math.cos(this.yaw) * lungeSpeed;
    }
  }

  private canStandUp(boxColliders: BoxCollider[]): boolean {
    const r = this.config.capsuleRadius * 0.9;
    const headTop = this.position.y + this.config.standHeight;
    const crouchTop = this.position.y + this.config.crouchHeight;

    for (const b of boxColliders) {
      if (
        this.position.x + r > b.minX &&
        this.position.x - r < b.maxX &&
        this.position.z + r > b.minZ &&
        this.position.z - r < b.maxZ
      ) {
        if (b.minY >= crouchTop - 0.15 && b.minY < headTop) {
          return false;
        }
      }
    }
    return true;
  }

  private sampleSupportHeight(
    x: number,
    z: number,
    feetY: number,
    boxColliders: BoxCollider[],
    rampColliders: RampCollider[],
    defaultGroundY = 0
  ): number {
    let bestY = defaultGroundY;
    const r = this.config.capsuleRadius * 0.88;
    const maxStep = feetY + (this.grounded ? this.config.stepUpHeight : 0.08);

    for (const b of boxColliders) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
        if (b.maxY <= maxStep && b.maxY > bestY) {
          bestY = b.maxY;
        }
      }
    }

    for (const ramp of rampColliders) {
      if (x + r > ramp.minX && x - r < ramp.maxX && z + r > ramp.minZ && z - r < ramp.maxZ) {
        let t = 0;
        if (ramp.axis === '-z') t = (ramp.maxZ - z) / (ramp.maxZ - ramp.minZ);
        else if (ramp.axis === '+z') t = (z - ramp.minZ) / (ramp.maxZ - ramp.minZ);
        else if (ramp.axis === '+x') t = (x - ramp.minX) / (ramp.maxX - ramp.minX);
        else t = (ramp.maxX - x) / (ramp.maxX - ramp.minX);

        t = THREE.MathUtils.clamp(t, 0, 1);
        const rampY = THREE.MathUtils.lerp(ramp.yStart, ramp.yEnd, t);
        if (rampY <= maxStep + 0.18 && rampY > bestY) {
          bestY = rampY;
        }
      }
    }

    return bestY;
  }

  private sampleCeilingHeight(
    x: number,
    z: number,
    feetY: number,
    boxColliders: BoxCollider[]
  ): number | null {
    let lowestCeiling: number | null = null;
    const r = this.config.capsuleRadius * 0.85;

    for (const b of boxColliders) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
        if (b.minY >= feetY + 0.35) {
          if (lowestCeiling === null || b.minY < lowestCeiling) {
            lowestCeiling = b.minY;
          }
        }
      }
    }
    return lowestCeiling;
  }

  private resolveHorizontalCollisions(
    boxColliders: BoxCollider[],
    worldBoundsRadius: number,
    worldBounds?: WorldBounds
  ): void {
    const r = this.config.capsuleRadius;
    const feetY = this.position.y;
    const headY = feetY + this.currentHeight;
    const stepClearance = this.grounded ? this.config.stepUpHeight : 0.08;

    for (const b of boxColliders) {
      if (b.minY >= headY - 0.02 || b.maxY <= feetY + stepClearance) {
        continue;
      }

      const closestX = THREE.MathUtils.clamp(this.position.x, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(this.position.z, b.minZ, b.maxZ);
      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        if (distSq > 0.000001) {
          const dist = Math.sqrt(distSq);
          const push = r - dist;
          this.position.x += (dx / dist) * push;
          this.position.z += (dz / dist) * push;
        } else {
          const penLeft = Math.abs(this.position.x - b.minX);
          const penRight = Math.abs(b.maxX - this.position.x);
          const penFront = Math.abs(this.position.z - b.minZ);
          const penBack = Math.abs(b.maxZ - this.position.z);
          const minPen = Math.min(penLeft, penRight, penFront, penBack);
          if (minPen === penLeft) this.position.x = b.minX - r;
          else if (minPen === penRight) this.position.x = b.maxX + r;
          else if (minPen === penFront) this.position.z = b.minZ - r;
          else this.position.z = b.maxZ + r;
        }
      }
    }

    if (worldBounds) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, worldBounds.minX, worldBounds.maxX);
      this.position.z = THREE.MathUtils.clamp(this.position.z, worldBounds.minZ, worldBounds.maxZ);
    } else {
      this.position.x = THREE.MathUtils.clamp(this.position.x, -worldBoundsRadius, worldBoundsRadius);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -worldBoundsRadius, worldBoundsRadius);
    }
  }

  private animatePose(
    dt: number,
    horizSpeed: number,
    supportY: number,
    onFootstep?: (sprinting: boolean) => void
  ): void {
    this.idleTime += dt;
    this.landSquash = THREE.MathUtils.damp(this.landSquash, 0, 14, dt);

    const crouchScaleY = this.currentHeight / this.config.standHeight;
    const squashFactor = 1 - this.landSquash;
    this.visualPivot.scale.set(
      1 + this.landSquash * 0.24,
      crouchScaleY * squashFactor,
      1 + this.landSquash * 0.24
    );

    // Dodge-Roll full tuck somersault
    if (this.dodgeTimer > 0) {
      const p = 1 - this.dodgeTimer / DODGE_DURATION;
      this.rigUpper.position.y = -0.35 * Math.sin(p * Math.PI);
      this.rigUpper.rotation.x = p * Math.PI * 2;
      this.leftHipPivot.rotation.x = -0.9;
      this.rightHipPivot.rotation.x = -0.9;
      this.leftKneePivot.rotation.x = 1.65;
      this.rightKneePivot.rotation.x = 1.65;
      this.leftShoulderPivot.rotation.x = -0.8;
      this.rightShoulderPivot.rotation.x = -0.8;
      this.headGroup.rotation.x = 0.35;
      this.contactShadow.position.set(0, 0.02, 0);
      return;
    }

    this.rigUpper.rotation.x = THREE.MathUtils.damp(this.rigUpper.rotation.x, 0, 18, dt);

    // Sitting Emote pose
    if (this.activeEmote === 'sit') {
      this.rigUpper.position.y = THREE.MathUtils.damp(this.rigUpper.position.y, -0.44, 12, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, -0.08, 12, dt);
      this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, 0, 12, dt);
      this.leftHipPivot.position.y = THREE.MathUtils.damp(this.leftHipPivot.position.y, 0.35, 12, dt);
      this.rightHipPivot.position.y = THREE.MathUtils.damp(this.rightHipPivot.position.y, 0.35, 12, dt);
      this.leftHipPivot.rotation.x = THREE.MathUtils.damp(this.leftHipPivot.rotation.x, -1.38, 12, dt);
      this.rightHipPivot.rotation.x = THREE.MathUtils.damp(this.rightHipPivot.rotation.x, -1.32, 12, dt);
      this.leftKneePivot.rotation.x = THREE.MathUtils.damp(this.leftKneePivot.rotation.x, 1.45, 12, dt);
      this.rightKneePivot.rotation.x = THREE.MathUtils.damp(this.rightKneePivot.rotation.x, 1.38, 12, dt);
      this.leftShoulderPivot.rotation.set(-0.22, 0, 0.14);
      this.rightShoulderPivot.rotation.set(-0.22, 0, -0.14);
      this.leftElbowPivot.rotation.x = -0.58;
      this.rightElbowPivot.rotation.x = -0.58;
      this.headGroup.rotation.y = Math.sin(this.idleTime * 0.9) * 0.14;
      this.contactShadow.position.set(0, 0.02, 0);
      return;
    } else {
      this.leftHipPivot.position.y = THREE.MathUtils.damp(this.leftHipPivot.position.y, 0.79, 14, dt);
      this.rightHipPivot.position.y = THREE.MathUtils.damp(this.rightHipPivot.position.y, 0.79, 14, dt);
    }

    if (this.vaultTimer > 0) {
      // Sprint Vault athletic hurdle pose
      this.leftHipPivot.rotation.x = -1.1;
      this.rightHipPivot.rotation.x = -0.55;
      this.leftKneePivot.rotation.x = 1.65;
      this.rightKneePivot.rotation.x = 1.35;
      this.leftShoulderPivot.rotation.x = -1.25;
      this.rightShoulderPivot.rotation.x = -0.75;
      this.torsoGroup.rotation.x = 0.38;
    } else if (this.grounded && horizSpeed > 0.18) {
      const strideFreq = THREE.MathUtils.mapLinear(
        THREE.MathUtils.clamp(horizSpeed, 0, this.config.sprintSpeed),
        0,
        this.config.sprintSpeed,
        4.5,
        13.2
      );
      this.walkCycle += dt * strideFreq;
      const stepIndex = Math.floor(this.walkCycle / Math.PI);
      if (stepIndex !== this.lastStepIndex) {
        this.lastStepIndex = stepIndex;
        onFootstep?.(this.sprinting);
      }

      const strideAmp = this.sprinting ? 0.68 : this.crouched ? 0.36 : 0.48;
      const swingL = Math.sin(this.walkCycle);
      const swingR = -swingL;

      this.leftHipPivot.rotation.x = swingL * strideAmp;
      this.rightHipPivot.rotation.x = swingR * strideAmp;
      this.leftKneePivot.rotation.x = Math.max(0, -swingL) * (this.sprinting ? 0.95 : 0.62);
      this.rightKneePivot.rotation.x = Math.max(0, -swingR) * (this.sprinting ? 0.95 : 0.62);

      this.leftShoulderPivot.rotation.x = swingR * strideAmp * 0.85;
      this.rightShoulderPivot.rotation.x = swingL * strideAmp * 0.85;
      this.leftElbowPivot.rotation.x = -0.25 - Math.max(0, swingR) * 0.45;
      this.rightElbowPivot.rotation.x = -0.25 - Math.max(0, swingL) * 0.45;

      this.rigUpper.position.y = Math.abs(Math.sin(this.walkCycle)) * (this.sprinting ? 0.06 : 0.038);
      this.torsoGroup.rotation.x = this.sprinting ? 0.16 : this.crouched ? 0.24 : 0.06;
    } else if (!this.grounded) {
      const rising = this.velocity.y > 0.5;
      this.leftHipPivot.rotation.x = THREE.MathUtils.damp(this.leftHipPivot.rotation.x, rising ? -0.52 : -0.18, 10, dt);
      this.rightHipPivot.rotation.x = THREE.MathUtils.damp(this.rightHipPivot.rotation.x, rising ? 0.28 : 0.18, 10, dt);
      this.leftKneePivot.rotation.x = THREE.MathUtils.damp(this.leftKneePivot.rotation.x, rising ? 0.82 : 0.24, 10, dt);
      this.rightKneePivot.rotation.x = THREE.MathUtils.damp(this.rightKneePivot.rotation.x, rising ? 0.35 : 0.28, 10, dt);
      this.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(this.leftShoulderPivot.rotation.x, rising ? -0.65 : -0.32, 10, dt);
      this.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(this.rightShoulderPivot.rotation.x, rising ? -0.42 : -0.32, 10, dt);
      this.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.leftElbowPivot.rotation.x, -0.45, 10, dt);
      this.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.rightElbowPivot.rotation.x, -0.45, 10, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, rising ? 0.05 : 0.14, 10, dt);
    } else {
      const breath = Math.sin(this.idleTime * 2.1) * 0.015;
      this.leftHipPivot.rotation.x = THREE.MathUtils.damp(this.leftHipPivot.rotation.x, 0, 14, dt);
      this.rightHipPivot.rotation.x = THREE.MathUtils.damp(this.rightHipPivot.rotation.x, 0, 14, dt);
      this.leftKneePivot.rotation.x = THREE.MathUtils.damp(this.leftKneePivot.rotation.x, this.crouched ? 0.32 : 0, 14, dt);
      this.rightKneePivot.rotation.x = THREE.MathUtils.damp(this.rightKneePivot.rotation.x, this.crouched ? 0.32 : 0, 14, dt);
      this.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(this.leftShoulderPivot.rotation.x, breath, 10, dt);
      this.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(this.rightShoulderPivot.rotation.x, -breath, 10, dt);
      this.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.leftElbowPivot.rotation.x, -0.14, 14, dt);
      this.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.rightElbowPivot.rotation.x, -0.14, 14, dt);
      this.rigUpper.position.y = THREE.MathUtils.damp(this.rigUpper.position.y, breath * 0.6, 10, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, this.crouched ? 0.25 : 0, 14, dt);
    }

    // 10. Upper-body action/combat/emote layer
    this.sidearmMount.visible = this.sidearmTimer > 0;
    if (this.sidearmTimer > 0) {
      const p = 1 - this.sidearmTimer / SIDEARM_DURATION;
      const recoil = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 0.22;
      this.torsoGroup.rotation.y = 0.25;
      this.leftShoulderPivot.rotation.set(-1.55 - recoil, 0, -0.05);
      this.leftElbowPivot.rotation.set(-0.08, 0, 0);
    } else if (this.heavyTimer > 0) {
      const p = THREE.MathUtils.clamp((HEAVY_DURATION - this.heavyTimer) / HEAVY_DURATION, 0, 1);
      const curve =
        p < 0.35
          ? -THREE.MathUtils.smoothstep(p, 0, 0.35) * 0.45
          : Math.sin(THREE.MathUtils.clamp((p - 0.32) / 0.55, 0, 1) * Math.PI * 0.9);
      this.torsoGroup.rotation.y = THREE.MathUtils.lerp(-0.62, 0.72, curve);
      this.torsoGroup.rotation.x += 0.22 * Math.max(0, curve);
      this.rightShoulderPivot.rotation.set(-1.5 + curve * 0.8, 0.35, -0.9 + curve * 1.85);
      this.rightElbowPivot.rotation.set(-0.45, 0, 0);
      this.leftShoulderPivot.rotation.set(-1.1, 0, 0.45);
      this.leftElbowPivot.rotation.set(-0.6, 0, 0);
      this.weaponMount.rotation.set(0.28, 0, -0.15);
    } else if (this.swingTimer > 0) {
      const p = THREE.MathUtils.clamp((SWING_DURATION - this.swingTimer) / SWING_DURATION, 0, 1);
      const swingCurve =
        p < 0.22
          ? -THREE.MathUtils.smoothstep(p, 0, 0.22) * 0.35
          : Math.sin(THREE.MathUtils.clamp((p - 0.2) / 0.55, 0, 1) * Math.PI * 0.85);

      if (this.comboStep === 1) {
        this.torsoGroup.rotation.y = THREE.MathUtils.lerp(-0.38, 0.42, swingCurve);
        this.rightShoulderPivot.rotation.set(-1.35 + swingCurve * 0.7, 0.25, -0.55 + swingCurve * 1.15);
        this.rightElbowPivot.rotation.set(-0.65 + swingCurve * 0.35, 0, 0);
        this.weaponMount.rotation.set(0.18, 0, -0.2);
      } else if (this.comboStep === 2) {
        this.torsoGroup.rotation.y = THREE.MathUtils.lerp(0.42, -0.44, swingCurve);
        this.rightShoulderPivot.rotation.set(-1.2 + swingCurve * 0.5, -0.25, 0.72 - swingCurve * 1.32);
        this.rightElbowPivot.rotation.set(-0.55 + swingCurve * 0.25, 0, 0);
        this.weaponMount.rotation.set(0.12, 0, 0.25);
      } else {
        this.torsoGroup.rotation.y = THREE.MathUtils.lerp(-0.18, 0.14, swingCurve);
        this.torsoGroup.rotation.x += 0.18 * swingCurve;
        this.rightShoulderPivot.rotation.set(-2.65 + swingCurve * 2.95, 0, -0.15);
        this.rightElbowPivot.rotation.set(-0.38 + swingCurve * 0.2, 0, 0);
        this.weaponMount.rotation.set(0.32 * swingCurve, 0, 0);
      }
      this.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(this.leftShoulderPivot.rotation.x, -0.48, 18, dt);
      this.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.leftElbowPivot.rotation.x, -0.75, 18, dt);
    } else if (this.spellCastTimer > 0) {
      const p = 1 - this.spellCastTimer / 0.34;
      const thrust = Math.sin(Math.min(1, p * 1.8) * Math.PI) * 0.35;
      this.torsoGroup.rotation.y = 0.22;
      this.leftShoulderPivot.rotation.set(-1.52 - thrust, 0.12, -0.1);
      this.leftElbowPivot.rotation.set(-0.18, 0, 0);
      this.rightShoulderPivot.rotation.set(-0.95, -0.2, 0.2);
    } else if (this.guarding) {
      this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, -0.28, 16, dt);
      this.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(this.rightShoulderPivot.rotation.x, -1.15, 18, dt);
      this.rightShoulderPivot.rotation.z = THREE.MathUtils.damp(this.rightShoulderPivot.rotation.z, 0.52, 18, dt);
      this.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.rightElbowPivot.rotation.x, -1.05, 18, dt);
      this.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(this.leftShoulderPivot.rotation.x, -0.68, 16, dt);
      this.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.leftElbowPivot.rotation.x, -0.95, 16, dt);
      this.weaponMount.rotation.x = THREE.MathUtils.damp(this.weaponMount.rotation.x, -0.55, 18, dt);
      this.weaponMount.rotation.z = THREE.MathUtils.damp(this.weaponMount.rotation.z, 0.85, 18, dt);
    } else if (this.activeEmote === 'wave') {
      this.leftShoulderPivot.rotation.set(-2.35, 0, 0.42 + Math.sin(this.idleTime * 9.5) * 0.34);
      this.leftElbowPivot.rotation.set(-0.62 + Math.sin(this.idleTime * 9.5) * 0.25, 0, 0);
      this.headGroup.rotation.z = 0.08;
    } else if (this.activeEmote === 'salute') {
      this.leftShoulderPivot.rotation.set(-1.55, 0, 0.18);
      this.leftElbowPivot.rotation.set(-1.72, 0, 0.25);
      this.headGroup.rotation.x = 0.06;
    } else {
      this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, 0, 12, dt);
      this.rightShoulderPivot.rotation.z = THREE.MathUtils.damp(this.rightShoulderPivot.rotation.z, 0, 12, dt);
      this.rightShoulderPivot.rotation.y = THREE.MathUtils.damp(this.rightShoulderPivot.rotation.y, 0, 12, dt);
      this.leftShoulderPivot.rotation.z = THREE.MathUtils.damp(this.leftShoulderPivot.rotation.z, 0, 12, dt);
      this.weaponMount.rotation.x = THREE.MathUtils.damp(this.weaponMount.rotation.x, 0, 12, dt);
      this.weaponMount.rotation.z = THREE.MathUtils.damp(this.weaponMount.rotation.z, 0, 12, dt);
      this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, 0, 10, dt);
      this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, Math.sin(this.idleTime * 0.8) * 0.05, 8, dt);
      this.headGroup.rotation.z = THREE.MathUtils.damp(this.headGroup.rotation.z, 0, 10, dt);
    }

    const poseWeights = this.poseMixer.update(dt, {
      isMoving: this.grounded && horizSpeed > 0.18,
      isSwinging: this.swingTimer > 0 || this.heavyTimer > 0,
      isGuarding: this.guarding,
      spellCastTimer: this.spellCastTimer,
      riposteLungeTimer: this.dodgeTimer,
    });
    this.torsoGroup.rotation.x += poseWeights.recoilPitch;
    this.torsoGroup.rotation.z =
      poseWeights.recoilRoll * (1 - poseWeights.guardWeight * 0.5 + poseWeights.upperCombatWeight * 0.25);

    const heightAboveGround = Math.max(0, this.position.y - supportY);
    this.contactShadow.position.set(0, -heightAboveGround + 0.02, 0);
    const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.12);
    this.contactShadow.scale.set(shadowScale, shadowScale, 1);
  }

  private buildCompositeMesh(): THREE.Mesh {
    const matCoat = new THREE.MeshStandardMaterial({ color: 0x26384a, roughness: 0.72, metalness: 0.08 });
    const matVest = new THREE.MeshStandardMaterial({ color: 0x1b242e, roughness: 0.78, metalness: 0.06 });
    const matShirt = new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.82, metalness: 0.02 });
    const matTrousers = new THREE.MeshStandardMaterial({ color: 0x1e242d, roughness: 0.84, metalness: 0.05 });
    const matBoots = new THREE.MeshStandardMaterial({ color: 0x3b291f, roughness: 0.56, metalness: 0.14 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xb97d4f, roughness: 0.3, metalness: 0.88 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xdab499, roughness: 0.56, metalness: 0.02 });
    const matLips = new THREE.MeshStandardMaterial({ color: 0xb67a6b, roughness: 0.62 });
    const matMantle = new THREE.MeshStandardMaterial({ color: 0x3f4c59, roughness: 0.78, metalness: 0.08 });
    const matHair = new THREE.MeshStandardMaterial({ color: 0x261d18, roughness: 0.76, metalness: 0.05 });
    const matSclera = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.35 });
    const matIris = new THREE.MeshStandardMaterial({ color: 0x3b586e, roughness: 0.25 });
    const matPupil = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.2 });
    const matManaClasp = new THREE.MeshStandardMaterial({
      color: 0x5fd0e6,
      emissive: 0x227993,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.3,
    });

    this.disposables.push(
      matCoat,
      matVest,
      matShirt,
      matTrousers,
      matBoots,
      matCopper,
      matSkin,
      matLips,
      matMantle,
      matHair,
      matSclera,
      matIris,
      matPupil,
      matManaClasp
    );

    // Sculpted Anatomical Pelvis Bridge (seamless hip-to-torso link)
    const pelvisGeo = new THREE.CapsuleGeometry(0.14, 0.18, 4, 10);
    pelvisGeo.rotateZ(Math.PI / 2);
    pelvisGeo.scale(1.05, 0.85, 0.75);
    this.disposables.push(pelvisGeo);
    const pelvis = new THREE.Mesh(pelvisGeo, matTrousers);
    pelvis.position.set(0, 0.76, 0);
    this.visualPivot.add(pelvis);

    // Sculpted Articulated Legs (muscular thigh, patella knee, tapered calf, leather boot + heel)
    const thighGeo = new THREE.CylinderGeometry(0.092, 0.068, 0.36, 12);
    const calfGeo = new THREE.CylinderGeometry(0.068, 0.048, 0.30, 12);
    const bootShaftGeo = new THREE.CylinderGeometry(0.064, 0.056, 0.18, 10);
    const bootCuffGeo = new THREE.CylinderGeometry(0.074, 0.068, 0.045, 10);
    const bootFootGeo = new THREE.CapsuleGeometry(0.058, 0.13, 4, 8);
    const kneeCapGeo = new THREE.SphereGeometry(0.064, 8, 6);
    this.disposables.push(thighGeo, calfGeo, bootShaftGeo, bootCuffGeo, bootFootGeo, kneeCapGeo);

    const buildLeg = (hipPivot: THREE.Group, kneePivot: THREE.Group, xOffset: number): void => {
      hipPivot.position.set(xOffset, 0.79, 0);
      const thigh = new THREE.Mesh(thighGeo, matTrousers);
      thigh.position.set(0, -0.18, 0);
      thigh.castShadow = true;

      kneePivot.position.set(0, -0.35, 0);
      const knee = new THREE.Mesh(kneeCapGeo, matTrousers);
      const shin = new THREE.Mesh(calfGeo, matTrousers);
      shin.position.set(0, -0.15, 0);
      shin.castShadow = true;

      const bootShaft = new THREE.Mesh(bootShaftGeo, matBoots);
      bootShaft.position.set(0, -0.31, 0);
      bootShaft.castShadow = true;

      const bootCuff = new THREE.Mesh(bootCuffGeo, matBoots);
      bootCuff.position.set(0, -0.22, 0);

      const bootFoot = new THREE.Mesh(bootFootGeo, matBoots);
      bootFoot.rotation.x = Math.PI / 2;
      bootFoot.position.set(0, -0.39, 0.05);
      bootFoot.castShadow = true;

      kneePivot.add(knee, shin, bootShaft, bootCuff, bootFoot);
      hipPivot.add(thigh, kneePivot);
      this.visualPivot.add(hipPivot);
    };
    buildLeg(this.leftHipPivot, this.leftKneePivot, -0.118);
    buildLeg(this.rightHipPivot, this.rightKneePivot, 0.118);

    // Upper Body Hierarchy
    this.visualPivot.add(this.rigUpper);
    this.rigUpper.add(this.torsoGroup);

    // Realistic Athletic Human Torso + Tailored Coat Lapels & Vest
    const coatProfile = [
      new THREE.Vector2(0.01, 0.67),
      new THREE.Vector2(0.22, 0.67),
      new THREE.Vector2(0.19, 0.84),
      new THREE.Vector2(0.17, 0.96),
      new THREE.Vector2(0.225, 1.24),
      new THREE.Vector2(0.235, 1.38),
      new THREE.Vector2(0.105, 1.43),
      new THREE.Vector2(0.01, 1.43),
    ];
    const torsoGeo = new THREE.LatheGeometry(coatProfile, 14);
    torsoGeo.scale(1.06, 1.0, 0.65);

    const vestPanelGeo = new THREE.BoxGeometry(0.13, 0.42, 0.04);
    const lapelGeo = new THREE.BoxGeometry(0.055, 0.34, 0.032);
    const beltGeo = new THREE.CylinderGeometry(0.188, 0.194, 0.068, 14);
    beltGeo.scale(1.08, 1.0, 0.72);
    const buckleGeo = new THREE.BoxGeometry(0.082, 0.076, 0.038);
    const holsterGeo = new THREE.BoxGeometry(0.06, 0.18, 0.09);

    const mantleGeo = new THREE.CylinderGeometry(0.135, 0.28, 0.20, 14, 1, false);
    mantleGeo.scale(1.06, 1.0, 0.72);

    const collarGeo = new THREE.TorusGeometry(0.088, 0.025, 6, 12);
    const neckGeo = new THREE.CylinderGeometry(0.056, 0.068, 0.125, 12);

    // Contoured Anatomical Arms + Sculpted Palm & Thumb
    const pauldronGeo = new THREE.SphereGeometry(0.088, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const upperArmGeo = new THREE.CylinderGeometry(0.064, 0.052, 0.26, 10);
    const forearmGeo = new THREE.CylinderGeometry(0.052, 0.039, 0.22, 10);
    const cuffGeo = new THREE.CylinderGeometry(0.050, 0.048, 0.046, 10);
    const palmGeo = new THREE.BoxGeometry(0.042, 0.082, 0.056);
    const thumbGeo = new THREE.CapsuleGeometry(0.013, 0.032, 3, 5);

    // Anatomically Sculpted Realistic Human Head & Facial Features
    const craniumGeo = new THREE.SphereGeometry(0.118, 16, 14);
    craniumGeo.scale(0.88, 1.04, 0.98);
    const cheekGeo = new THREE.SphereGeometry(0.052, 8, 8);
    const jawGeo = new THREE.CylinderGeometry(0.084, 0.054, 0.095, 12);
    jawGeo.scale(0.86, 1.0, 0.94);
    const noseBridgeGeo = new THREE.BoxGeometry(0.024, 0.048, 0.034);
    const noseTipGeo = new THREE.SphereGeometry(0.017, 7, 7);
    const browGeo = new THREE.BoxGeometry(0.105, 0.018, 0.034);
    const mouthGeo = new THREE.BoxGeometry(0.042, 0.012, 0.018);
    const earGeo = new THREE.SphereGeometry(0.022, 6, 6);
    earGeo.scale(0.42, 1.25, 0.85);
    const eyeScleraGeo = new THREE.SphereGeometry(0.015, 7, 7);
    const eyeIrisGeo = new THREE.SphereGeometry(0.009, 7, 7);
    const eyePupilGeo = new THREE.SphereGeometry(0.005, 6, 6);
    const hairGeo = new THREE.SphereGeometry(0.126, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
    hairGeo.scale(0.91, 1.05, 1.01);
    const hairBangGeo = new THREE.BoxGeometry(0.13, 0.038, 0.055);
    const hoodGeo = new THREE.CylinderGeometry(0.135, 0.155, 0.10, 12);

    const packGeo = new THREE.BoxGeometry(0.26, 0.32, 0.12);
    const packFlapGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.27, 8, 1, false, 0, Math.PI);
    const claspGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.13, 8);

    this.disposables.push(
      torsoGeo,
      vestPanelGeo,
      lapelGeo,
      beltGeo,
      buckleGeo,
      holsterGeo,
      mantleGeo,
      collarGeo,
      neckGeo,
      pauldronGeo,
      upperArmGeo,
      forearmGeo,
      cuffGeo,
      palmGeo,
      thumbGeo,
      craniumGeo,
      cheekGeo,
      jawGeo,
      noseBridgeGeo,
      noseTipGeo,
      browGeo,
      mouthGeo,
      earGeo,
      eyeScleraGeo,
      eyeIrisGeo,
      eyePupilGeo,
      hairGeo,
      hairBangGeo,
      hoodGeo,
      packGeo,
      packFlapGeo,
      claspGeo
    );

    const torso = new THREE.Mesh(torsoGeo, matCoat);
    torso.castShadow = true;
    this.torsoGroup.add(torso);

    const vest = new THREE.Mesh(vestPanelGeo, matVest);
    vest.position.set(0, 1.13, 0.125);
    this.torsoGroup.add(vest);

    for (const sx of [-1, 1]) {
      const lapel = new THREE.Mesh(lapelGeo, matMantle);
      lapel.position.set(sx * 0.065, 1.22, 0.135);
      lapel.rotation.z = sx * 0.16;
      this.torsoGroup.add(lapel);
    }

    const belt = new THREE.Mesh(beltGeo, matBoots);
    belt.position.set(0, 0.87, 0);
    belt.castShadow = true;
    this.torsoGroup.add(belt);

    const buckle = new THREE.Mesh(buckleGeo, matCopper);
    buckle.position.set(0, 0.87, 0.14);
    this.torsoGroup.add(buckle);

    const holster = new THREE.Mesh(holsterGeo, matBoots);
    holster.position.set(-0.21, 0.80, 0.02);
    this.torsoGroup.add(holster);

    const mantle = new THREE.Mesh(mantleGeo, matMantle);
    mantle.position.set(0, 1.31, -0.01);
    mantle.castShadow = true;
    this.torsoGroup.add(mantle);

    const collar = new THREE.Mesh(collarGeo, matShirt);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.43, 0.01);
    this.torsoGroup.add(collar);

    const neck = new THREE.Mesh(neckGeo, matSkin);
    neck.position.set(0, 1.49, 0.01);
    this.torsoGroup.add(neck);

    const buildArm = (shoulderPivot: THREE.Group, elbowPivot: THREE.Group, xOffset: number, sideSign: number): void => {
      shoulderPivot.position.set(xOffset, 1.32, 0);
      const pauldron = new THREE.Mesh(pauldronGeo, matCopper);
      pauldron.position.set(0, 0.02, 0);
      pauldron.castShadow = true;

      const upperArm = new THREE.Mesh(upperArmGeo, matCoat);
      upperArm.position.set(0, -0.14, 0);
      upperArm.castShadow = true;

      elbowPivot.position.set(0, -0.27, 0);
      const forearm = new THREE.Mesh(forearmGeo, matCoat);
      forearm.position.set(0, -0.11, 0);
      forearm.castShadow = true;

      const cuff = new THREE.Mesh(cuffGeo, matShirt);
      cuff.position.set(0, -0.21, 0);

      const palm = new THREE.Mesh(palmGeo, matSkin);
      palm.position.set(0, -0.265, 0.008);
      palm.castShadow = true;

      const thumb = new THREE.Mesh(thumbGeo, matSkin);
      thumb.position.set(-sideSign * 0.024, -0.245, 0.028);
      thumb.rotation.x = 0.45;

      elbowPivot.add(forearm, cuff, palm, thumb);
      shoulderPivot.add(pauldron, upperArm, elbowPivot);
      this.torsoGroup.add(shoulderPivot);
    };
    buildArm(this.leftShoulderPivot, this.leftElbowPivot, -0.275, -1);
    buildArm(this.rightShoulderPivot, this.rightElbowPivot, 0.275, 1);

    this.weaponMount.position.set(0, -0.26, 0.03);
    const sabreMesh = buildSabreWeaponMesh(this.disposables);
    this.weaponMount.add(sabreMesh);
    this.rightElbowPivot.add(this.weaponMount);

    this.sidearmMount.position.set(0, -0.26, 0.04);
    const sidearmMesh = buildManaSidearmMesh(this.disposables);
    this.sidearmMount.add(sidearmMesh);
    this.sidearmMount.visible = false;
    this.leftElbowPivot.add(this.sidearmMount);

    // Realistic Sculpted Human Head
    this.headGroup.position.set(0, 1.62, 0.015);
    const cranium = new THREE.Mesh(craniumGeo, matSkin);
    cranium.castShadow = true;

    const jaw = new THREE.Mesh(jawGeo, matSkin);
    jaw.position.set(0, -0.056, 0.018);

    const cheekL = new THREE.Mesh(cheekGeo, matSkin);
    cheekL.position.set(-0.044, -0.018, 0.072);
    const cheekR = new THREE.Mesh(cheekGeo, matSkin);
    cheekR.position.set(0.044, -0.018, 0.072);

    const noseBridge = new THREE.Mesh(noseBridgeGeo, matSkin);
    noseBridge.rotation.x = -0.18;
    noseBridge.position.set(0, -0.002, 0.106);
    const noseTip = new THREE.Mesh(noseTipGeo, matSkin);
    noseTip.position.set(0, -0.022, 0.122);

    const brow = new THREE.Mesh(browGeo, matHair);
    brow.position.set(0, 0.028, 0.104);

    const mouth = new THREE.Mesh(mouthGeo, matLips);
    mouth.position.set(0, -0.054, 0.098);

    const earL = new THREE.Mesh(earGeo, matSkin);
    earL.position.set(-0.102, -0.006, 0.0);
    const earR = new THREE.Mesh(earGeo, matSkin);
    earR.position.set(0.102, -0.006, 0.0);

    for (const ex of [-0.036, 0.036]) {
      const sclera = new THREE.Mesh(eyeScleraGeo, matSclera);
      sclera.position.set(ex, 0.007, 0.098);
      const iris = new THREE.Mesh(eyeIrisGeo, matIris);
      iris.position.set(ex, 0.007, 0.108);
      const pupil = new THREE.Mesh(eyePupilGeo, matPupil);
      pupil.position.set(ex, 0.007, 0.114);
      this.headGroup.add(sclera, iris, pupil);
    }

    const hair = new THREE.Mesh(hairGeo, matHair);
    hair.position.set(0, 0.02, -0.012);
    hair.rotation.x = -0.18;

    const hairBang = new THREE.Mesh(hairBangGeo, matHair);
    hairBang.position.set(0.012, 0.068, 0.078);
    hairBang.rotation.set(0.28, 0, -0.14);

    const hoodRim = new THREE.Mesh(hoodGeo, matMantle);
    hoodRim.position.set(0, -0.14, -0.06);
    hoodRim.rotation.x = -0.55;

    this.headGroup.add(
      cranium,
      jaw,
      cheekL,
      cheekR,
      noseBridge,
      noseTip,
      brow,
      mouth,
      earL,
      earR,
      hair,
      hairBang,
      hoodRim
    );
    this.torsoGroup.add(this.headGroup);

    const satchel = new THREE.Mesh(packGeo, matBoots);
    satchel.position.set(0, 1.12, -0.19);
    satchel.castShadow = true;
    this.torsoGroup.add(satchel);

    const packFlap = new THREE.Mesh(packFlapGeo, matMantle);
    packFlap.rotation.z = Math.PI / 2;
    packFlap.position.set(0, 1.28, -0.19);
    this.torsoGroup.add(packFlap);

    const clasp = new THREE.Mesh(claspGeo, matManaClasp);
    clasp.position.set(0.1, 1.13, -0.26);
    this.torsoGroup.add(clasp);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    this.disposables.push(shadowTex, shadowGeo, shadowMat);

    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, 0.02, 0);
    return shadowMesh;
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
