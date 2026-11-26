import initJolt from 'jolt-physics';
import * as THREE from 'three';
import type { BoxCollider } from '../core/types';

type JoltNamespace = Awaited<ReturnType<typeof initJolt>>;
type JoltBody = InstanceType<JoltNamespace['Body']>;
type JoltBodyID = InstanceType<JoltNamespace['BodyID']>;
type JoltInterfaceType = InstanceType<JoltNamespace['JoltInterface']>;
type JoltBodyInterface = InstanceType<JoltNamespace['BodyInterface']>;
type JoltVec3 = InstanceType<JoltNamespace['Vec3']>;
type JoltRVec3 = InstanceType<JoltNamespace['RVec3']>;
type JoltShape = InstanceType<JoltNamespace['Shape']>;

interface DynamicProp {
  mesh: THREE.Group;
  body: JoltBody;
  bodyId: JoltBodyID;
  halfExtentY: number;
  kind: 'crate' | 'barrel' | 'canister';
}

const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_OBJECT_LAYERS = 2;

let sharedJoltPromise: Promise<JoltNamespace> | null = null;

function getJoltRuntime(): Promise<JoltNamespace> {
  if (!sharedJoltPromise) {
    sharedJoltPromise = initJolt();
  }
  return sharedJoltPromise;
}

/**
 * Real jrouwe/JoltPhysics WebAssembly Rigid-Body World:
 * - Simulates interactive harbour crates, ironbound kegs, and glowing Aether canisters
 *   across Elarion Harbourgate, Foundry Row, and Copperwell Square.
 * - Registers static ground & obstacle colliders from the district map.
 * - Responds physically to player contact, melee swings, spells, and Exothermic Vents.
 */
export class JoltPhysicsWorld {
  public readonly group = new THREE.Group();

  private Jolt: JoltNamespace | null = null;
  private joltInterface: JoltInterfaceType | null = null;
  private bodyInterface: JoltBodyInterface | null = null;
  private tempImpulseVec: JoltVec3 | null = null;
  private tempPosVec: JoltRVec3 | null = null;

  private readonly staticBodyIds: JoltBodyID[] = [];
  private readonly dynamicProps: DynamicProp[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private initialized = false;
  private initializing = false;
  private disposed = false;

  constructor() {
    this.group.name = 'Jolt_Physics_Props';
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public async initializeForWorld(
    boxColliders: BoxCollider[],
    groundHeightAt?: (x: number, z: number) => number
  ): Promise<void> {
    if (this.initializing || this.disposed) return;
    this.initializing = true;
    try {
      const Jolt = await getJoltRuntime();
      if (this.disposed) return;
      this.Jolt = Jolt;

      const settings = new Jolt.JoltSettings();
      const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
      objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
      objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);

      const bpNonMoving = new Jolt.BroadPhaseLayer(0);
      const bpMoving = new Jolt.BroadPhaseLayer(1);
      const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, 2);
      bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, bpNonMoving);
      bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving);

      settings.mObjectLayerPairFilter = objectFilter;
      settings.mBroadPhaseLayerInterface = bpInterface;
      settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
        settings.mBroadPhaseLayerInterface,
        2,
        settings.mObjectLayerPairFilter,
        NUM_OBJECT_LAYERS
      );

      this.joltInterface = new Jolt.JoltInterface(settings);
      Jolt.destroy(settings);

      const sys = this.joltInterface.GetPhysicsSystem();
      this.bodyInterface = sys.GetBodyInterface();
      this.tempImpulseVec = new Jolt.Vec3(0, 0, 0);
      this.tempPosVec = new Jolt.RVec3(0, 0, 0);

      this.rebuildBodies(boxColliders, groundHeightAt);
      this.initialized = true;
    } catch {
      // Safe fallback if WASM fails in constrained environments
    } finally {
      this.initializing = false;
    }
  }

  public rebuildBodies(
    boxColliders: BoxCollider[],
    groundHeightAt?: (x: number, z: number) => number
  ): void {
    if (!this.Jolt || !this.bodyInterface || this.disposed) return;
    this.clearBodies();

    const Jolt = this.Jolt;
    const bi = this.bodyInterface;

    // 1. Primary city & harbour ground plane slab (y = 0.16 top surface)
    const groundShape = new Jolt.BoxShape(new Jolt.Vec3(340, 0.5, 340), 0.05, undefined);
    const groundSettings = new Jolt.BodyCreationSettings(
      groundShape,
      new Jolt.RVec3(0, -0.34, 150),
      new Jolt.Quat(0, 0, 0, 1),
      Jolt.EMotionType_Static,
      LAYER_NON_MOVING
    );
    groundSettings.mFriction = 0.72;
    groundSettings.mRestitution = 0.12;
    const groundBody = bi.CreateBody(groundSettings);
    bi.AddBody(groundBody.GetID(), Jolt.EActivation_DontActivate);
    this.staticBodyIds.push(groundBody.GetID());
    Jolt.destroy(groundSettings);

    // 2. Register up to 140 static city colliders near core districts for realistic bounce/containment
    let registeredObstacles = 0;
    for (const b of boxColliders) {
      if (registeredObstacles >= 140) break;
      const sx = (b.maxX - b.minX) * 0.5;
      const sy = (b.maxY - b.minY) * 0.5;
      const sz = (b.maxZ - b.minZ) * 0.5;
      if (sx < 0.1 || sy < 0.1 || sz < 0.1) continue;
      const cx = (b.minX + b.maxX) * 0.5;
      const cy = (b.minY + b.maxY) * 0.5;
      const cz = (b.minZ + b.maxZ) * 0.5;
      if (Math.abs(cx) > 220 || cz < -90 || cz > 280) continue;

      const shape = new Jolt.BoxShape(new Jolt.Vec3(sx, sy, sz), Math.min(0.05, sx * 0.1, sy * 0.1, sz * 0.1), undefined);
      const settings = new Jolt.BodyCreationSettings(
        shape,
        new Jolt.RVec3(cx, cy, cz),
        new Jolt.Quat(0, 0, 0, 1),
        Jolt.EMotionType_Static,
        LAYER_NON_MOVING
      );
      const body = bi.CreateBody(settings);
      bi.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
      this.staticBodyIds.push(body.GetID());
      Jolt.destroy(settings);
      registeredObstacles += 1;
    }

    // 3. Spawn dynamic interactive physics props around Harbourgate, Foundry Row & Copperwell Square
    const matCrateWood = new THREE.MeshStandardMaterial({ color: 0x7c5334, roughness: 0.78, metalness: 0.05 });
    const matIronBand = new THREE.MeshStandardMaterial({ color: 0x2f3742, roughness: 0.36, metalness: 0.82 });
    const matBarrelWood = new THREE.MeshStandardMaterial({ color: 0x5c3c24, roughness: 0.8, metalness: 0.04 });
    const matCanister = new THREE.MeshStandardMaterial({
      color: 0x2b3e4c,
      roughness: 0.28,
      metalness: 0.75,
    });
    const matAetherCore = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.25,
      roughness: 0.18,
    });
    this.disposables.push(matCrateWood, matIronBand, matBarrelWood, matCanister, matAetherCore);

    const placements: Array<{ x: number; z: number; kind: 'crate' | 'barrel' | 'canister'; stackY?: number }> = [
      { x: -6.2, z: 21.5, kind: 'crate' },
      { x: -6.1, z: 21.6, kind: 'crate', stackY: 0.78 },
      { x: -7.1, z: 22.2, kind: 'barrel' },
      { x: 6.4, z: 20.8, kind: 'canister' },
      { x: 7.2, z: 21.5, kind: 'barrel' },
      { x: -5.8, z: 11.2, kind: 'crate' },
      { x: 6.2, z: 10.6, kind: 'canister' },
      { x: 6.9, z: 11.4, kind: 'crate' },
      { x: -7.5, z: -3.5, kind: 'barrel' },
      { x: 7.8, z: -4.2, kind: 'crate' },
      { x: -34.0, z: 22.0, kind: 'canister' },
      { x: -35.2, z: 22.4, kind: 'barrel' },
      { x: 24.0, z: 8.5, kind: 'crate' },
      { x: 24.9, z: 8.9, kind: 'canister' },
    ];

    for (const p of placements) {
      const gy = (groundHeightAt ? groundHeightAt(p.x, p.z) : 0.16) + (p.stackY ?? 0);
      this.spawnDynamicProp(p.kind, p.x, gy, p.z, {
        matCrateWood,
        matIronBand,
        matBarrelWood,
        matCanister,
        matAetherCore,
      });
    }
  }

  private spawnDynamicProp(
    kind: 'crate' | 'barrel' | 'canister',
    x: number,
    groundY: number,
    z: number,
    mats: {
      matCrateWood: THREE.MeshStandardMaterial;
      matIronBand: THREE.MeshStandardMaterial;
      matBarrelWood: THREE.MeshStandardMaterial;
      matCanister: THREE.MeshStandardMaterial;
      matAetherCore: THREE.MeshStandardMaterial;
    }
  ): void {
    if (!this.Jolt || !this.bodyInterface) return;
    const Jolt = this.Jolt;
    const mesh = new THREE.Group();
    let shape: JoltShape;
    let halfH = 0.36;

    if (kind === 'crate') {
      halfH = 0.36;
      const boxGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72);
      const braceGeo = new THREE.BoxGeometry(0.75, 0.11, 0.75);
      this.disposables.push(boxGeo, braceGeo);
      const core = new THREE.Mesh(boxGeo, mats.matCrateWood);
      core.castShadow = true;
      core.receiveShadow = true;
      const bandTop = new THREE.Mesh(braceGeo, mats.matIronBand);
      bandTop.position.y = 0.24;
      const bandBot = new THREE.Mesh(braceGeo, mats.matIronBand);
      bandBot.position.y = -0.24;
      mesh.add(core, bandTop, bandBot);
      shape = new Jolt.BoxShape(new Jolt.Vec3(0.36, 0.36, 0.36), 0.03, undefined);
    } else if (kind === 'barrel') {
      halfH = 0.44;
      const cylGeo = new THREE.CylinderGeometry(0.31, 0.28, 0.88, 12);
      const hoopGeo = new THREE.CylinderGeometry(0.325, 0.325, 0.06, 12);
      this.disposables.push(cylGeo, hoopGeo);
      const bodyMesh = new THREE.Mesh(cylGeo, mats.matBarrelWood);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      const h1 = new THREE.Mesh(hoopGeo, mats.matIronBand);
      h1.position.y = 0.22;
      const h2 = new THREE.Mesh(hoopGeo, mats.matIronBand);
      h2.position.y = -0.22;
      mesh.add(bodyMesh, h1, h2);
      shape = new Jolt.CylinderShape(0.44, 0.31, 0.03, undefined);
    } else {
      halfH = 0.42;
      const bodyGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.84, 12);
      const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10);
      const capGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.09, 12);
      this.disposables.push(bodyGeo, coreGeo, capGeo);
      const shell = new THREE.Mesh(bodyGeo, mats.matCanister);
      shell.castShadow = true;
      const glow = new THREE.Mesh(coreGeo, mats.matAetherCore);
      const cap = new THREE.Mesh(capGeo, mats.matIronBand);
      cap.position.y = 0.39;
      mesh.add(shell, glow, cap);
      shape = new Jolt.CylinderShape(0.42, 0.26, 0.03, undefined);
    }

    const settings = new Jolt.BodyCreationSettings(
      shape,
      new Jolt.RVec3(x, groundY + halfH + 0.02, z),
      new Jolt.Quat(0, 0, 0, 1),
      Jolt.EMotionType_Dynamic,
      LAYER_MOVING
    );
    settings.mFriction = 0.6;
    settings.mRestitution = kind === 'canister' ? 0.38 : 0.22;
    settings.mLinearDamping = 0.08;
    settings.mAngularDamping = 0.12;

    const body = this.bodyInterface.CreateBody(settings);
    const bodyId = body.GetID();
    this.bodyInterface.AddBody(bodyId, Jolt.EActivation_Activate);
    Jolt.destroy(settings);

    mesh.position.set(x, groundY + halfH + 0.02, z);
    this.group.add(mesh);
    this.dynamicProps.push({ mesh, body, bodyId, halfExtentY: halfH, kind });
  }

  public applyRadialImpulse(origin: THREE.Vector3, radius: number, strength: number): number {
    if (!this.initialized || !this.bodyInterface || !this.tempImpulseVec) return 0;
    let affected = 0;
    for (const prop of this.dynamicProps) {
      const p = prop.body.GetPosition();
      const dx = p.GetX() - origin.x;
      const dy = p.GetY() - (origin.y + 0.35);
      const dz = p.GetZ() - origin.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > radius) continue;

      const falloff = 1 - dist / Math.max(0.01, radius);
      const invD = dist > 0.02 ? 1 / dist : 0;
      const nx = dist > 0.02 ? dx * invD : 0;
      const nz = dist > 0.02 ? dz * invD : 1;
      const mag = strength * (0.45 + 0.55 * falloff);

      this.tempImpulseVec.Set(nx * mag, mag * 0.52 + 28, nz * mag);
      this.bodyInterface.ActivateBody(prop.bodyId);
      this.bodyInterface.AddImpulse(prop.bodyId, this.tempImpulseVec);
      affected += 1;
    }
    return affected;
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.initialized || !this.joltInterface || !this.bodyInterface || !this.tempImpulseVec) return;

    const clampedDt = Math.min(dt, 1 / 30);
    const numSteps = clampedDt > 1 / 55 ? 2 : 1;

    // Gentle player bump impulse on dynamic crates/barrels when brushing close
    for (const prop of this.dynamicProps) {
      const p = prop.body.GetPosition();
      const dx = p.GetX() - playerPos.x;
      const dz = p.GetZ() - playerPos.z;
      const dy = Math.abs(p.GetY() - (playerPos.y + 0.6));
      const d2 = dx * dx + dz * dz;
      if (dy < 1.1 && d2 < 0.85 * 0.85 && d2 > 0.0004) {
        const d = Math.sqrt(d2);
        this.tempImpulseVec.Set((dx / d) * 18, 4.5, (dz / d) * 18);
        this.bodyInterface.ActivateBody(prop.bodyId);
        this.bodyInterface.AddImpulse(prop.bodyId, this.tempImpulseVec);
      }
    }

    this.joltInterface.Step(clampedDt, numSteps);

    for (const prop of this.dynamicProps) {
      const p = prop.body.GetPosition();
      const r = prop.body.GetRotation();
      prop.mesh.position.set(p.GetX(), p.GetY(), p.GetZ());
      prop.mesh.quaternion.set(r.GetX(), r.GetY(), r.GetZ(), r.GetW());
    }
  }

  public clearBodies(): void {
    if (this.bodyInterface) {
      for (const id of this.dynamicProps) {
        this.bodyInterface.RemoveBody(id.bodyId);
        this.bodyInterface.DestroyBody(id.bodyId);
      }
      for (const id of this.staticBodyIds) {
        this.bodyInterface.RemoveBody(id);
        this.bodyInterface.DestroyBody(id);
      }
    }
    for (const prop of this.dynamicProps) {
      this.group.remove(prop.mesh);
    }
    this.dynamicProps.length = 0;
    this.staticBodyIds.length = 0;
  }

  public dispose(): void {
    this.disposed = true;
    this.clearBodies();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    if (this.Jolt && this.tempImpulseVec) this.Jolt.destroy(this.tempImpulseVec);
    if (this.Jolt && this.tempPosVec) this.Jolt.destroy(this.tempPosVec);
    if (this.Jolt && this.joltInterface) this.Jolt.destroy(this.joltInterface);
    this.tempImpulseVec = null;
    this.tempPosVec = null;
    this.joltInterface = null;
    this.bodyInterface = null;
    this.initialized = false;
  }
}
