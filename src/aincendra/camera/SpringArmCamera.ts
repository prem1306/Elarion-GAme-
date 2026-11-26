import * as THREE from 'three';
import type { CameraMode, InputSnapshot, MovementConfig } from '../core/types';

const _anchor = new THREE.Vector3();
const _lagAnchor = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _rayRight = new THREE.Vector3();
const _rayUp = new THREE.Vector3();
const _probeOrigin = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

/**
 * Milestone 2 Polished Spring-Arm Camera:
 * - Multi-ray whisker collision probe (center + 4 radius offsets) to prevent corner clipping
 * - Smooth damped camera position lag & landing impact dip
 * - Dynamic FOV transitions between Walk, Sprint, and Crouch
 */
export class SpringArmCamera {
  public readonly camera: THREE.PerspectiveCamera;
  public yaw = 0;
  public pitch = -0.26;
  public mode: CameraMode = 'third-person';

  private currentArmLength: number;
  private currentAnchorY = 1.48;
  private lagX = 0;
  private lagZ = 0;
  private lagInitialized = false;
  private landingDip = 0;
  private combatImpulse = 0;
  private currentFov: number;

  private targetArmLength: number;
  private sensitivity: number;
  private lagSpeed: number;
  private baseFov: number;
  private sprintFov: number;
  private crouchFov: number;

  private readonly raycaster = new THREE.Raycaster();
  private readonly minPitch = -1.18;
  private readonly maxPitch = 0.72;
  private readonly probeMargin = 0.28;
  private readonly whiskerRadius = 0.2;

  constructor(aspect: number, config: MovementConfig) {
    this.camera = new THREE.PerspectiveCamera(config.baseFov, aspect, 0.1, 2600);
    this.targetArmLength = config.cameraDistance;
    this.currentArmLength = config.cameraDistance;
    this.sensitivity = config.cameraSensitivity;
    this.lagSpeed = config.cameraLagSpeed;
    this.baseFov = config.baseFov;
    this.sprintFov = config.sprintFov;
    this.crouchFov = config.crouchFov;
    this.currentFov = config.baseFov;
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
    this.lagInitialized = false;
  }

  public updateConfig(next: Partial<MovementConfig>): void {
    if (next.cameraDistance !== undefined) {
      this.targetArmLength = THREE.MathUtils.clamp(next.cameraDistance, 2.2, 8.0);
    }
    if (next.cameraSensitivity !== undefined) {
      this.sensitivity = next.cameraSensitivity;
    }
    if (next.cameraLagSpeed !== undefined) {
      this.lagSpeed = next.cameraLagSpeed;
    }
  }

  public triggerLandingDip(impulse: number): void {
    this.landingDip = Math.max(this.landingDip, impulse * 0.18);
  }

  public triggerCombatImpulse(amount: number): void {
    this.combatImpulse = Math.max(this.combatImpulse, amount);
  }

  public resetOrientation(playerPos?: THREE.Vector3): void {
    this.yaw = 0;
    this.pitch = -0.26;
    this.landingDip = 0;
    this.combatImpulse = 0;
    if (playerPos) {
      this.lagX = playerPos.x;
      this.lagZ = playerPos.z;
      this.lagInitialized = true;
    } else {
      this.lagInitialized = false;
    }
  }

  public update(
    dt: number,
    input: InputSnapshot,
    playerPos: THREE.Vector3,
    targetAnchorY: number,
    eyeY: number,
    isSprinting: boolean,
    isCrouched: boolean,
    raycastTargets: THREE.Object3D[]
  ): void {
    const clampedDt = Math.min(dt, 0.05);

    this.yaw -= input.lookDeltaX * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - input.lookDeltaY * this.sensitivity,
      this.minPitch,
      this.maxPitch
    );

    // Smooth landing dip & combat hit recoil recovery
    this.landingDip = THREE.MathUtils.damp(this.landingDip, 0, 12, clampedDt);
    this.combatImpulse = THREE.MathUtils.damp(this.combatImpulse, 0, 22, clampedDt);

    // Smooth dynamic FOV
    const desiredFov = isSprinting
      ? this.sprintFov
      : isCrouched
      ? this.crouchFov
      : this.baseFov;
    const nextFov = THREE.MathUtils.damp(this.currentFov, desiredFov, 9, clampedDt);
    if (Math.abs(nextFov - this.currentFov) > 0.01) {
      this.currentFov = nextFov;
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.mode === 'first-person') {
      this.currentAnchorY = THREE.MathUtils.damp(this.currentAnchorY, eyeY - this.landingDip, 18, clampedDt);
      this.camera.position.set(playerPos.x, this.currentAnchorY + this.combatImpulse * 0.25, playerPos.z);

      const cosP = Math.cos(this.pitch);
      _lookTarget.set(
        playerPos.x - Math.sin(this.yaw) * cosP * 5,
        this.currentAnchorY + Math.sin(this.pitch) * 5 + this.combatImpulse * 0.5,
        playerPos.z - Math.cos(this.yaw) * cosP * 5
      );
      this.camera.lookAt(_lookTarget);
      return;
    }

    // Smooth camera lag anchor on XZ
    if (!this.lagInitialized) {
      this.lagX = playerPos.x;
      this.lagZ = playerPos.z;
      this.lagInitialized = true;
    } else {
      this.lagX = THREE.MathUtils.damp(this.lagX, playerPos.x, this.lagSpeed, clampedDt);
      this.lagZ = THREE.MathUtils.damp(this.lagZ, playerPos.z, this.lagSpeed, clampedDt);
    }

    this.currentAnchorY = THREE.MathUtils.damp(this.currentAnchorY, targetAnchorY - this.landingDip, 16, clampedDt);
    _lagAnchor.set(this.lagX, this.currentAnchorY, this.lagZ);

    // Shoulder framing offset
    _anchor.copy(_lagAnchor);
    _anchor.x += Math.cos(this.yaw) * 0.42;
    _anchor.z += -Math.sin(this.yaw) * 0.42;

    const cosP = Math.cos(this.pitch);
    _rayDir.set(
      Math.sin(this.yaw) * cosP,
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * cosP
    ).normalize();

    // Orthogonal probe basis for 5-ray whisker collision sweep
    _rayRight.crossVectors(_worldUp, _rayDir).normalize();
    _rayUp.crossVectors(_rayDir, _rayRight).normalize();

    const maxFar = this.targetArmLength + this.probeMargin;
    let closestHitDist = maxFar;

    const offsets: Array<[number, number]> = [
      [0, 0],
      [this.whiskerRadius, 0],
      [-this.whiskerRadius, 0],
      [0, this.whiskerRadius],
      [0, -this.whiskerRadius],
    ];

    this.raycaster.near = 0.08;
    this.raycaster.far = maxFar;

    for (const [ox, oy] of offsets) {
      _probeOrigin
        .copy(_anchor)
        .addScaledVector(_rayRight, ox)
        .addScaledVector(_rayUp, oy);
      this.raycaster.set(_probeOrigin, _rayDir);
      const hits = this.raycaster.intersectObjects(raycastTargets, false);
      if (hits.length > 0 && hits[0].distance < closestHitDist) {
        closestHitDist = hits[0].distance;
      }
    }

    const desiredDist = closestHitDist < maxFar
      ? Math.max(0.55, closestHitDist - this.probeMargin)
      : this.targetArmLength;

    const dampSpeed = desiredDist < this.currentArmLength ? 32 : 9;
    this.currentArmLength = THREE.MathUtils.damp(this.currentArmLength, desiredDist, dampSpeed, clampedDt);

    _desiredCamPos.copy(_anchor).addScaledVector(_rayDir, this.currentArmLength - this.combatImpulse * 0.85);
    const minCamY = playerPos.y + 0.25;
    if (_desiredCamPos.y < minCamY) {
      _desiredCamPos.y = minCamY;
    }

    this.camera.position.copy(_desiredCamPos);
    _lookTarget.copy(_anchor).addScaledVector(_rayDir, -4.0);
    this.camera.lookAt(_lookTarget);
  }
}
