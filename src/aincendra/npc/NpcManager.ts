import * as THREE from 'three';
import type {
  NpcActionKind,
  NpcReactionKind,
  NpcSpawnSpec,
  PlayerEmoteKind,
} from '../core/types';

interface NpcInstance {
  spec: NpcSpawnSpec;
  actionKind: NpcActionKind;
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
  waypointIndex: number;
  waitTimer: number;
  animPhase: number;
  subActionIndex: number;
  subActionTimer: number;
  reactingToPlayer: boolean;
  explicitReaction: NpcReactionKind;
  explicitReactionTimer: number;
}

const SKIN_TONES = [0xd6b095, 0xc79878, 0xe0c1ab, 0x9e6f52, 0xb88667, 0x875a40];
const HAIR_TONES = [0x261f1b, 0x4b3526, 0x1a1715, 0x6e5135, 0x7b7874, 0x3b2619];
const TROUSER_TONES = [0x242931, 0x322b26, 0x283238, 0x38342e];

const ACTION_LABELS: Record<NpcActionKind, string> = {
  forge: 'Forging & Tempering',
  sweep: 'Sweeping Cobbles',
  haul: 'Hauling Cargo Crate',
  clipboard: 'Checking Ledger',
  browse: 'Browsing Stalls',
  converse: 'In Conversation',
  announce: 'Calling Out News',
  watch: 'Standing Watch',
  patrol: 'Patrolling District',
  idle: 'Taking in the Air',
};

/**
 * Upgraded Realistic Humanoid NPC & Heavy Infantry Manager:
 * - Sculpted multi-part human anatomy (cheekbones, nasal bridge + tip, sclera/iris/pupil eyes,
 *   mouth contour, pelvis hip bridge, thumb + sculpted hand, lapels, tapered legs)
 * - Heavy Infantry full-plate armour kit (steel cuirass, segmented pauldrons, crested visored helm,
 *   Vaelcrest tower shield, & mana-halberd)
 * - Interactive NPC reaction choreography (salute, wave, nod, laugh, point, bow) + player emote responses
 */
export class NpcManager {
  public readonly group = new THREE.Group();
  private readonly npcs: NpcInstance[] = [];
  private readonly sharedGeos: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private readonly trouserMaterials: THREE.MeshStandardMaterial[];
  private readonly matBoots: THREE.MeshStandardMaterial;
  private readonly matLeatherStrap: THREE.MeshStandardMaterial;
  private readonly matBrass: THREE.MeshStandardMaterial;
  private readonly matWhiteShirt: THREE.MeshStandardMaterial;
  private readonly matWoodProp: THREE.MeshStandardMaterial;
  private readonly matIronProp: THREE.MeshStandardMaterial;
  private readonly matSteelArmor: THREE.MeshStandardMaterial;
  private readonly matParchmentProp: THREE.MeshStandardMaterial;
  private readonly matManaProp: THREE.MeshStandardMaterial;
  private readonly matSclera: THREE.MeshStandardMaterial;
  private readonly matIris: THREE.MeshStandardMaterial;
  private readonly matPupil: THREE.MeshStandardMaterial;
  private readonly matLips: THREE.MeshStandardMaterial;
  private readonly skinMaterials: THREE.MeshStandardMaterial[];
  private readonly hairMaterials: THREE.MeshStandardMaterial[];

  // Anatomical Limb & Pelvis Geometries
  private readonly pelvisGeo: THREE.BufferGeometry;
  private readonly thighGeo: THREE.BufferGeometry;
  private readonly calfGeo: THREE.BufferGeometry;
  private readonly bootCuffGeo: THREE.BufferGeometry;
  private readonly bootSoleGeo: THREE.BufferGeometry;
  private readonly upperArmGeo: THREE.BufferGeometry;
  private readonly forearmGeo: THREE.BufferGeometry;
  private readonly wristCuffGeo: THREE.BufferGeometry;
  private readonly palmGeo: THREE.BufferGeometry;
  private readonly thumbGeo: THREE.BufferGeometry;

  // Tailored Garment & Armour Geometries
  private readonly torsoGeo: THREE.BufferGeometry;
  private readonly coatHemGeo: THREE.BufferGeometry;
  private readonly lapelGeo: THREE.BufferGeometry;
  private readonly collarGeo: THREE.BufferGeometry;
  private readonly beltGeo: THREE.BufferGeometry;
  private readonly buckleGeo: THREE.BufferGeometry;
  private readonly shoulderGeo: THREE.BufferGeometry;
  private readonly sashGeo: THREE.BufferGeometry;
  private readonly cuirassGeo: THREE.BufferGeometry;
  private readonly pauldronPlateGeo: THREE.BufferGeometry;
  private readonly towerShieldGeo: THREE.BufferGeometry;
  private readonly halberdBladeGeo: THREE.BufferGeometry;

  // Sculpted Realistic Head & Headwear Geometries
  private readonly neckGeo: THREE.BufferGeometry;
  private readonly craniumGeo: THREE.BufferGeometry;
  private readonly cheekGeo: THREE.BufferGeometry;
  private readonly jawGeo: THREE.BufferGeometry;
  private readonly noseBridgeGeo: THREE.BufferGeometry;
  private readonly noseTipGeo: THREE.BufferGeometry;
  private readonly browGeo: THREE.BufferGeometry;
  private readonly mouthGeo: THREE.BufferGeometry;
  private readonly earGeo: THREE.BufferGeometry;
  private readonly eyeScleraGeo: THREE.BufferGeometry;
  private readonly eyeIrisGeo: THREE.BufferGeometry;
  private readonly eyePupilGeo: THREE.BufferGeometry;
  private readonly hairCapGeo: THREE.BufferGeometry;
  private readonly hairBunGeo: THREE.BufferGeometry;
  private readonly beardGeo: THREE.BufferGeometry;
  private readonly helmDomeGeo: THREE.BufferGeometry;
  private readonly helmBrimGeo: THREE.BufferGeometry;
  private readonly helmVisorGeo: THREE.BufferGeometry;
  private readonly helmCrestGeo: THREE.BufferGeometry;
  private readonly scholarCapGeo: THREE.BufferGeometry;
  private readonly goggleGeo: THREE.BufferGeometry;
  private readonly brimHatGeo: THREE.BufferGeometry;

  // Held Prop Geometries
  private readonly staffPoleGeo: THREE.CylinderGeometry;
  private readonly staffTipGeo: THREE.OctahedronGeometry;
  private readonly hammerHandleGeo: THREE.CylinderGeometry;
  private readonly hammerHeadGeo: THREE.BoxGeometry;
  private readonly ledgerGeo: THREE.BoxGeometry;
  private readonly cratePropGeo: THREE.BoxGeometry;
  private readonly broomHeadGeo: THREE.BoxGeometry;

  constructor() {
    this.group.name = 'Elarion_District_NPCs';

    this.trouserMaterials = TROUSER_TONES.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.04 })
    );
    this.matBoots = new THREE.MeshStandardMaterial({ color: 0x332218, roughness: 0.58, metalness: 0.14 });
    this.matLeatherStrap = new THREE.MeshStandardMaterial({ color: 0x4b3121, roughness: 0.68, metalness: 0.08 });
    this.matBrass = new THREE.MeshStandardMaterial({ color: 0xc9964c, roughness: 0.28, metalness: 0.86 });
    this.matWhiteShirt = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.82, metalness: 0.02 });
    this.matWoodProp = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.78, metalness: 0.04 });
    this.matIronProp = new THREE.MeshStandardMaterial({ color: 0x323840, roughness: 0.38, metalness: 0.84 });
    this.matSteelArmor = new THREE.MeshStandardMaterial({ color: 0x8793a0, roughness: 0.26, metalness: 0.88 });
    this.matParchmentProp = new THREE.MeshStandardMaterial({ color: 0xe6dac0, roughness: 0.9, metalness: 0.0 });
    this.matManaProp = new THREE.MeshStandardMaterial({
      color: 0x8be0f0,
      emissive: 0x5ab8cc,
      emissiveIntensity: 1.25,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.matSclera = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.36 });
    this.matIris = new THREE.MeshStandardMaterial({ color: 0x2c3c47, roughness: 0.28, metalness: 0.05 });
    this.matPupil = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.2 });
    this.matLips = new THREE.MeshStandardMaterial({ color: 0xae7263, roughness: 0.65 });

    this.skinMaterials = SKIN_TONES.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.56, metalness: 0.02 })
    );
    this.hairMaterials = HAIR_TONES.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0.05 })
    );

    this.materials.push(
      ...this.trouserMaterials,
      this.matBoots,
      this.matLeatherStrap,
      this.matBrass,
      this.matWhiteShirt,
      this.matWoodProp,
      this.matIronProp,
      this.matSteelArmor,
      this.matParchmentProp,
      this.matManaProp,
      this.matSclera,
      this.matIris,
      this.matPupil,
      this.matLips,
      ...this.skinMaterials,
      ...this.hairMaterials
    );

    // Tapered Anatomical Pelvis & Limbs
    this.pelvisGeo = new THREE.CapsuleGeometry(0.125, 0.15, 4, 8);
    this.pelvisGeo.rotateZ(Math.PI / 2);
    this.pelvisGeo.scale(1.0, 0.82, 0.72);
    this.thighGeo = new THREE.CylinderGeometry(0.088, 0.066, 0.36, 10);
    this.calfGeo = new THREE.CylinderGeometry(0.066, 0.048, 0.32, 10);
    this.bootCuffGeo = new THREE.CylinderGeometry(0.064, 0.058, 0.14, 10);
    this.bootSoleGeo = new THREE.CapsuleGeometry(0.054, 0.12, 4, 8);

    this.upperArmGeo = new THREE.CylinderGeometry(0.062, 0.050, 0.26, 10);
    this.forearmGeo = new THREE.CylinderGeometry(0.050, 0.038, 0.24, 10);
    this.wristCuffGeo = new THREE.CylinderGeometry(0.048, 0.046, 0.045, 9);
    this.palmGeo = new THREE.BoxGeometry(0.038, 0.076, 0.052);
    this.thumbGeo = new THREE.CapsuleGeometry(0.012, 0.028, 3, 5);

    // Tailored Torso + Layered Coat Hem + Lapels + Heavy Infantry Armour Kit
    const torsoProfile = [
      new THREE.Vector2(0.01, 0.72),
      new THREE.Vector2(0.20, 0.72),
      new THREE.Vector2(0.165, 0.88),
      new THREE.Vector2(0.21, 1.18),
      new THREE.Vector2(0.225, 1.32),
      new THREE.Vector2(0.105, 1.38),
      new THREE.Vector2(0.01, 1.38),
    ];
    this.torsoGeo = new THREE.LatheGeometry(torsoProfile, 14);
    this.torsoGeo.scale(1.08, 1.0, 0.68);

    this.coatHemGeo = new THREE.CylinderGeometry(0.185, 0.24, 0.26, 14, 1, false);
    this.coatHemGeo.scale(1.06, 1.0, 0.72);
    this.lapelGeo = new THREE.BoxGeometry(0.048, 0.30, 0.028);
    this.collarGeo = new THREE.TorusGeometry(0.088, 0.024, 6, 12);
    this.beltGeo = new THREE.CylinderGeometry(0.178, 0.185, 0.068, 14);
    this.beltGeo.scale(1.08, 1.0, 0.72);
    this.buckleGeo = new THREE.BoxGeometry(0.075, 0.065, 0.032);
    this.shoulderGeo = new THREE.CylinderGeometry(0.135, 0.27, 0.20, 12);
    this.shoulderGeo.scale(1.08, 1.0, 0.74);
    this.sashGeo = new THREE.BoxGeometry(0.09, 0.56, 0.28);

    this.cuirassGeo = new THREE.CylinderGeometry(0.228, 0.195, 0.44, 12);
    this.cuirassGeo.scale(1.12, 1.0, 0.76);
    this.pauldronPlateGeo = new THREE.SphereGeometry(0.115, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
    this.towerShieldGeo = new THREE.BoxGeometry(0.055, 0.88, 0.44);
    this.halberdBladeGeo = new THREE.BoxGeometry(0.025, 0.38, 0.22);

    // Sculpted Realistic Human Head & Facial Features
    this.neckGeo = new THREE.CylinderGeometry(0.054, 0.066, 0.12, 10);
    this.craniumGeo = new THREE.SphereGeometry(0.116, 14, 12);
    this.craniumGeo.scale(0.88, 1.04, 0.98);
    this.cheekGeo = new THREE.SphereGeometry(0.046, 7, 7);
    this.jawGeo = new THREE.CylinderGeometry(0.084, 0.056, 0.095, 10);
    this.jawGeo.scale(0.86, 1.0, 0.94);
    this.noseBridgeGeo = new THREE.BoxGeometry(0.022, 0.042, 0.030);
    this.noseTipGeo = new THREE.SphereGeometry(0.015, 6, 6);
    this.browGeo = new THREE.BoxGeometry(0.10, 0.018, 0.034);
    this.mouthGeo = new THREE.BoxGeometry(0.038, 0.011, 0.016);
    this.earGeo = new THREE.SphereGeometry(0.022, 6, 6);
    this.earGeo.scale(0.42, 1.25, 0.85);
    this.eyeScleraGeo = new THREE.SphereGeometry(0.015, 6, 6);
    this.eyeIrisGeo = new THREE.SphereGeometry(0.009, 6, 6);
    this.eyePupilGeo = new THREE.SphereGeometry(0.005, 5, 5);

    this.hairCapGeo = new THREE.SphereGeometry(0.123, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
    this.hairCapGeo.scale(0.91, 1.05, 1.01);
    this.hairBunGeo = new THREE.SphereGeometry(0.05, 8, 8);
    this.beardGeo = new THREE.ConeGeometry(0.072, 0.11, 8);
    this.beardGeo.scale(0.88, 1.0, 0.84);

    this.helmDomeGeo = new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
    this.helmBrimGeo = new THREE.CylinderGeometry(0.155, 0.168, 0.028, 14);
    this.helmVisorGeo = new THREE.CylinderGeometry(0.134, 0.128, 0.10, 12, 1, false, -1.1, 2.2);
    this.helmCrestGeo = new THREE.BoxGeometry(0.034, 0.075, 0.2);
    this.scholarCapGeo = new THREE.BoxGeometry(0.24, 0.025, 0.24);
    this.goggleGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10);
    this.brimHatGeo = new THREE.CylinderGeometry(0.185, 0.195, 0.024, 14);

    // Held Role Props
    this.staffPoleGeo = new THREE.CylinderGeometry(0.022, 0.026, 1.72, 8);
    this.staffTipGeo = new THREE.OctahedronGeometry(0.065, 0);
    this.hammerHandleGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.44, 8);
    this.hammerHeadGeo = new THREE.BoxGeometry(0.075, 0.085, 0.17);
    this.ledgerGeo = new THREE.BoxGeometry(0.23, 0.03, 0.29);
    this.cratePropGeo = new THREE.BoxGeometry(0.34, 0.26, 0.34);
    this.broomHeadGeo = new THREE.BoxGeometry(0.25, 0.11, 0.075);

    this.sharedGeos.push(
      this.pelvisGeo,
      this.thighGeo,
      this.calfGeo,
      this.bootCuffGeo,
      this.bootSoleGeo,
      this.upperArmGeo,
      this.forearmGeo,
      this.wristCuffGeo,
      this.palmGeo,
      this.thumbGeo,
      this.torsoGeo,
      this.coatHemGeo,
      this.lapelGeo,
      this.collarGeo,
      this.beltGeo,
      this.buckleGeo,
      this.shoulderGeo,
      this.sashGeo,
      this.cuirassGeo,
      this.pauldronPlateGeo,
      this.towerShieldGeo,
      this.halberdBladeGeo,
      this.neckGeo,
      this.craniumGeo,
      this.cheekGeo,
      this.jawGeo,
      this.noseBridgeGeo,
      this.noseTipGeo,
      this.browGeo,
      this.mouthGeo,
      this.earGeo,
      this.eyeScleraGeo,
      this.eyeIrisGeo,
      this.eyePupilGeo,
      this.hairCapGeo,
      this.hairBunGeo,
      this.beardGeo,
      this.helmDomeGeo,
      this.helmBrimGeo,
      this.helmVisorGeo,
      this.helmCrestGeo,
      this.scholarCapGeo,
      this.goggleGeo,
      this.brimHatGeo,
      this.staffPoleGeo,
      this.staffTipGeo,
      this.hammerHandleGeo,
      this.hammerHeadGeo,
      this.ledgerGeo,
      this.cratePropGeo,
      this.broomHeadGeo
    );
  }

  public get count(): number {
    return this.npcs.length;
  }

  public getNpcPosition(id: string, out: THREE.Vector3): boolean {
    for (const npc of this.npcs) {
      if (npc.spec.id === id) {
        out.copy(npc.position);
        return true;
      }
    }
    return false;
  }

  public getNpcActionLabel(id: string): string | null {
    for (const npc of this.npcs) {
      if (npc.spec.id === id) {
        return ACTION_LABELS[npc.actionKind] ?? null;
      }
    }
    return null;
  }

  public triggerNpcReaction(npcId: string, reaction: NpcReactionKind, duration = 2.4): void {
    if (reaction === 'none') return;
    for (const npc of this.npcs) {
      if (npc.spec.id === npcId) {
        npc.explicitReaction = reaction;
        npc.explicitReactionTimer = duration;
        return;
      }
    }
  }

  public notifyPlayerEmote(playerPosition: THREE.Vector3, emote: PlayerEmoteKind): void {
    if (emote === 'none' || emote === 'sit') return;
    const reaction: NpcReactionKind = emote === 'salute' ? 'salute' : 'wave';
    for (const npc of this.npcs) {
      const dx = playerPosition.x - npc.position.x;
      const dz = playerPosition.z - npc.position.z;
      if (dx * dx + dz * dz < 7.8 * 7.8 && Math.abs(playerPosition.y - npc.position.y) < 2.2) {
        npc.explicitReaction =
          npc.spec.role === 'Heavy Infantry' || npc.spec.role === 'City Guard'
            ? 'salute'
            : reaction;
        npc.explicitReactionTimer = 2.4;
        npc.yaw = Math.atan2(dx, dz);
      }
    }
  }

  private inferActionKind(spec: NpcSpawnSpec): NpcActionKind {
    if (spec.actionKind) return spec.actionKind;
    if (spec.behavior === 'patrol') return 'patrol';
    if (spec.behavior === 'interact') return 'converse';
    if (spec.behavior === 'work') {
      if (spec.role === 'Engineer') return 'forge';
      if (spec.role === 'Customs Clerk' || spec.role === 'Harbourmaster' || spec.role === 'Scholar') {
        return 'clipboard';
      }
      return 'sweep';
    }
    if (spec.role === 'City Guard' || spec.role === 'Heavy Infantry') return 'watch';
    return 'idle';
  }

  public spawnFromSpecs(specs: NpcSpawnSpec[]): void {
    this.clear();

    specs.forEach((spec, idx) => {
      const actionKind = this.inferActionKind(spec);
      const isHeavy = spec.role === 'Heavy Infantry' || Boolean(spec.heavyArmor);
      const matSkin = this.skinMaterials[idx % this.skinMaterials.length];
      const matHair = this.hairMaterials[(idx * 3 + 1) % this.hairMaterials.length];
      const matTrousers = this.trouserMaterials[idx % this.trouserMaterials.length];

      const matTunic = new THREE.MeshStandardMaterial({
        color: spec.tunicColor,
        roughness: 0.76,
        metalness: 0.06,
      });
      const matAccent = new THREE.MeshStandardMaterial({
        color: spec.accentColor,
        roughness: 0.44,
        metalness: 0.36,
      });
      this.materials.push(matTunic, matAccent);

      const root = new THREE.Group();
      root.position.set(spec.position[0], spec.position[1], spec.position[2]);
      root.rotation.y = spec.facingYaw;

      const heightScale = isHeavy ? 1.08 : 0.96 + (idx % 5) * 0.022;
      root.scale.set(heightScale, heightScale, heightScale);

      // Pelvis Bridge
      const pelvis = new THREE.Mesh(this.pelvisGeo, matTrousers);
      pelvis.position.set(0, 0.76, 0);
      root.add(pelvis);

      // Two-Segment Articulated Legs
      const buildLeg = (xOff: number): { hip: THREE.Group; knee: THREE.Group } => {
        const hip = new THREE.Group();
        hip.position.set(xOff, 0.78, 0);

        const thigh = new THREE.Mesh(this.thighGeo, isHeavy ? this.matSteelArmor : matTrousers);
        thigh.position.y = -0.18;
        thigh.castShadow = true;

        const knee = new THREE.Group();
        knee.position.set(0, -0.36, 0);

        const calf = new THREE.Mesh(this.calfGeo, isHeavy ? this.matSteelArmor : matTrousers);
        calf.position.y = -0.15;
        calf.castShadow = true;

        const bootCuff = new THREE.Mesh(this.bootCuffGeo, isHeavy ? this.matIronProp : this.matBoots);
        bootCuff.position.y = -0.32;
        bootCuff.castShadow = true;

        const bootSole = new THREE.Mesh(this.bootSoleGeo, this.matBoots);
        bootSole.rotation.x = Math.PI / 2;
        bootSole.position.set(0, -0.38, 0.045);
        bootSole.castShadow = true;

        knee.add(calf, bootCuff, bootSole);
        hip.add(thigh, knee);
        return { hip, knee };
      };

      const lLegRig = buildLeg(-0.105);
      const rLegRig = buildLeg(0.105);

      // Tailored Torso, Coat Hem, Lapels, Collar, Belt & Armour Kit
      const torso = new THREE.Group();
      const bodyMesh = new THREE.Mesh(this.torsoGeo, matTunic);
      bodyMesh.castShadow = true;
      const coatHem = new THREE.Mesh(this.coatHemGeo, matTunic);
      coatHem.position.y = 0.72;
      coatHem.castShadow = true;
      const collar = new THREE.Mesh(this.collarGeo, this.matWhiteShirt);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 1.36, 0.01);
      const beltMesh = new THREE.Mesh(this.beltGeo, this.matLeatherStrap);
      beltMesh.position.y = 0.85;
      const buckle = new THREE.Mesh(this.buckleGeo, this.matBrass);
      buckle.position.set(0, 0.85, 0.135);
      torso.add(bodyMesh, coatHem, collar, beltMesh, buckle);

      if (isHeavy) {
        const cuirass = new THREE.Mesh(this.cuirassGeo, this.matSteelArmor);
        cuirass.position.y = 1.12;
        cuirass.castShadow = true;
        const mantle = new THREE.Mesh(this.shoulderGeo, matAccent);
        mantle.position.y = 1.29;
        torso.add(cuirass, mantle);
      } else {
        for (const sx of [-1, 1]) {
          const lapel = new THREE.Mesh(this.lapelGeo, matAccent);
          lapel.position.set(sx * 0.056, 1.19, 0.125);
          lapel.rotation.z = sx * 0.16;
          torso.add(lapel);
        }
        if (spec.role === 'City Guard' || spec.role === 'Harbourmaster' || spec.role === 'Scholar') {
          const mantle = new THREE.Mesh(this.shoulderGeo, matAccent);
          mantle.position.y = 1.27;
          torso.add(mantle);
        } else if (spec.role === 'Merchant' || spec.role === 'Resident') {
          const sash = new THREE.Mesh(this.sashGeo, matAccent);
          sash.position.set(0.02, 1.07, 0);
          sash.rotation.z = 0.42;
          torso.add(sash);
        }
      }

      // Two-Segment Articulated Arms with Sculpted Palm & Thumb
      const buildArm = (xOff: number, sideSign: number): { shoulder: THREE.Group; elbow: THREE.Group } => {
        const shoulder = new THREE.Group();
        shoulder.position.set(xOff, 1.30, 0);

        if (isHeavy) {
          const pauldron = new THREE.Mesh(this.pauldronPlateGeo, this.matSteelArmor);
          pauldron.position.set(0, 0.02, 0);
          pauldron.castShadow = true;
          shoulder.add(pauldron);
        }

        const upperArm = new THREE.Mesh(this.upperArmGeo, isHeavy ? this.matSteelArmor : matTunic);
        upperArm.position.y = -0.13;
        upperArm.castShadow = true;

        const elbow = new THREE.Group();
        elbow.position.set(0, -0.25, 0);

        const forearm = new THREE.Mesh(this.forearmGeo, isHeavy ? this.matSteelArmor : matTunic);
        forearm.position.y = -0.12;
        forearm.castShadow = true;

        const cuff = new THREE.Mesh(this.wristCuffGeo, isHeavy ? this.matBrass : this.matWhiteShirt);
        cuff.position.y = -0.22;

        const palm = new THREE.Mesh(this.palmGeo, isHeavy ? this.matIronProp : matSkin);
        palm.position.set(0, -0.27, 0.008);

        const thumb = new THREE.Mesh(this.thumbGeo, isHeavy ? this.matIronProp : matSkin);
        thumb.position.set(-sideSign * 0.022, -0.25, 0.024);
        thumb.rotation.x = 0.45;

        elbow.add(forearm, cuff, palm, thumb);
        shoulder.add(upperArm, elbow);
        return { shoulder, elbow };
      };

      const lArmRig = buildArm(isHeavy ? -0.285 : -0.26, -1);
      const rArmRig = buildArm(isHeavy ? 0.285 : 0.26, 1);

      // Held Role Props
      if (isHeavy) {
        const pole = new THREE.Mesh(this.staffPoleGeo, this.matWoodProp);
        pole.scale.set(1.15, 1.25, 1.15);
        pole.position.set(0.04, 0.14, 0.08);
        const blade = new THREE.Mesh(this.halberdBladeGeo, this.matSteelArmor);
        blade.position.set(0.04, 1.10, 0.14);
        const finial = new THREE.Mesh(this.staffTipGeo, this.matManaProp);
        finial.position.set(0.04, 1.28, 0.08);
        rArmRig.elbow.add(pole, blade, finial);

        const shield = new THREE.Mesh(this.towerShieldGeo, this.matSteelArmor);
        shield.position.set(-0.075, -0.16, 0.06);
        const shieldRim = new THREE.Mesh(this.towerShieldGeo, matAccent);
        shieldRim.scale.set(0.7, 0.72, 0.72);
        shieldRim.position.set(-0.095, -0.16, 0.06);
        lArmRig.elbow.add(shield, shieldRim);
      } else if (actionKind === 'forge') {
        const handle = new THREE.Mesh(this.hammerHandleGeo, this.matWoodProp);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, -0.28, 0.16);
        const headHammer = new THREE.Mesh(this.hammerHeadGeo, this.matIronProp);
        headHammer.position.set(0, -0.28, 0.36);
        rArmRig.elbow.add(handle, headHammer);
      } else if (actionKind === 'sweep') {
        const broomStick = new THREE.Mesh(this.staffPoleGeo, this.matWoodProp);
        broomStick.position.set(0, -0.45, 0.14);
        broomStick.rotation.x = 0.28;
        const brush = new THREE.Mesh(this.broomHeadGeo, matAccent);
        brush.position.set(0, -1.24, 0.38);
        rArmRig.elbow.add(broomStick, brush);
      } else if (actionKind === 'clipboard') {
        const board = new THREE.Mesh(this.ledgerGeo, this.matWoodProp);
        board.position.set(0.06, -0.26, 0.14);
        board.rotation.x = -0.35;
        const page = new THREE.Mesh(this.ledgerGeo, this.matParchmentProp);
        page.scale.set(0.84, 0.6, 0.84);
        page.position.set(0.06, -0.24, 0.14);
        page.rotation.x = -0.35;
        lArmRig.elbow.add(board, page);
      } else if (actionKind === 'watch') {
        const pole = new THREE.Mesh(this.staffPoleGeo, this.matIronProp);
        pole.position.set(0.04, 0.05, 0.08);
        const finial = new THREE.Mesh(this.staffTipGeo, this.matManaProp);
        finial.position.set(0.04, 0.92, 0.08);
        rArmRig.elbow.add(pole, finial);
      } else if (actionKind === 'haul') {
        const crate = new THREE.Mesh(this.cratePropGeo, this.matWoodProp);
        crate.position.set(0, 0.98, 0.34);
        crate.castShadow = true;
        torso.add(crate);
      }

      // Sculpted Realistic Human Head + Face + Ears + Cheekbones + Layered Eyes
      const neck = new THREE.Mesh(this.neckGeo, matSkin);
      neck.position.set(0, 1.42, 0.005);
      torso.add(neck);

      const head = new THREE.Group();
      head.position.set(0, 1.54, 0.012);

      const cranium = new THREE.Mesh(this.craniumGeo, matSkin);
      cranium.castShadow = true;
      const jaw = new THREE.Mesh(this.jawGeo, matSkin);
      jaw.position.set(0, -0.056, 0.016);

      const cheekL = new THREE.Mesh(this.cheekGeo, matSkin);
      cheekL.position.set(-0.042, -0.018, 0.068);
      const cheekR = new THREE.Mesh(this.cheekGeo, matSkin);
      cheekR.position.set(0.042, -0.018, 0.068);

      const noseBridge = new THREE.Mesh(this.noseBridgeGeo, matSkin);
      noseBridge.rotation.x = -0.18;
      noseBridge.position.set(0, -0.004, 0.104);
      const noseTip = new THREE.Mesh(this.noseTipGeo, matSkin);
      noseTip.position.set(0, -0.022, 0.118);

      const brow = new THREE.Mesh(this.browGeo, matHair);
      brow.position.set(0, 0.026, 0.102);

      const mouth = new THREE.Mesh(this.mouthGeo, this.matLips);
      mouth.position.set(0, -0.052, 0.095);

      const earL = new THREE.Mesh(this.earGeo, matSkin);
      earL.position.set(-0.102, -0.006, 0);
      const earR = new THREE.Mesh(this.earGeo, matSkin);
      earR.position.set(0.102, -0.006, 0);

      for (const ex of [-0.035, 0.035]) {
        const sclera = new THREE.Mesh(this.eyeScleraGeo, this.matSclera);
        sclera.position.set(ex, 0.006, 0.096);
        const iris = new THREE.Mesh(this.eyeIrisGeo, this.matIris);
        iris.position.set(ex, 0.006, 0.106);
        const pupil = new THREE.Mesh(this.eyePupilGeo, this.matPupil);
        pupil.position.set(ex, 0.006, 0.112);
        head.add(sclera, iris, pupil);
      }

      head.add(cranium, jaw, cheekL, cheekR, noseBridge, noseTip, brow, mouth, earL, earR);

      if (isHeavy) {
        const dome = new THREE.Mesh(this.helmDomeGeo, this.matSteelArmor);
        dome.position.set(0, 0.025, 0);
        const visor = new THREE.Mesh(this.helmVisorGeo, this.matIronProp);
        visor.position.set(0, 0.01, 0.015);
        const crest = new THREE.Mesh(this.helmCrestGeo, matAccent);
        crest.position.set(0, 0.15, -0.01);
        head.add(dome, visor, crest);
      } else if (spec.role === 'City Guard') {
        const dome = new THREE.Mesh(this.helmDomeGeo, this.matIronProp);
        dome.position.set(0, 0.025, 0);
        const brim = new THREE.Mesh(this.helmBrimGeo, this.matIronProp);
        brim.position.set(0, 0.03, 0);
        const crest = new THREE.Mesh(this.helmCrestGeo, matAccent);
        crest.position.set(0, 0.145, -0.01);
        head.add(dome, brim, crest);
      } else if (spec.role === 'Engineer') {
        const hair = new THREE.Mesh(this.hairCapGeo, matHair);
        hair.position.set(0, 0.02, -0.008);
        const capBrim = new THREE.Mesh(this.brimHatGeo, this.matLeatherStrap);
        capBrim.position.set(0, 0.075, 0.01);
        const gogL = new THREE.Mesh(this.goggleGeo, this.matBrass);
        gogL.rotation.x = Math.PI / 2;
        gogL.position.set(-0.042, 0.072, 0.11);
        const gogR = new THREE.Mesh(this.goggleGeo, this.matBrass);
        gogR.rotation.x = Math.PI / 2;
        gogR.position.set(0.042, 0.072, 0.11);
        head.add(hair, capBrim, gogL, gogR);
      } else if (spec.role === 'Scholar') {
        const hair = new THREE.Mesh(this.hairCapGeo, matHair);
        hair.position.set(0, 0.02, -0.008);
        const cap = new THREE.Mesh(this.scholarCapGeo, matTunic);
        cap.position.set(0, 0.128, -0.01);
        head.add(hair, cap);
      } else {
        const hair = new THREE.Mesh(this.hairCapGeo, matHair);
        hair.position.set(0, 0.022, -0.008);
        head.add(hair);
        if (idx % 3 === 1) {
          const bun = new THREE.Mesh(this.hairBunGeo, matHair);
          bun.position.set(0, 0.035, -0.125);
          head.add(bun);
        }
        if (spec.role === 'Merchant' || spec.role === 'Tavern Barkeep' || spec.role === 'Harbourmaster') {
          const hat = new THREE.Mesh(this.brimHatGeo, this.matLeatherStrap);
          hat.position.set(0, 0.088, 0);
          head.add(hat);
        }
      }

      if (!isHeavy && idx % 3 === 0 && spec.role !== 'Scholar') {
        const beard = new THREE.Mesh(this.beardGeo, matHair);
        beard.rotation.x = Math.PI;
        beard.position.set(0, -0.095, 0.055);
        head.add(beard);
      }

      torso.add(lArmRig.shoulder, rArmRig.shoulder, head);
      root.add(lLegRig.hip, rLegRig.hip, torso);
      this.group.add(root);

      this.npcs.push({
        spec,
        actionKind,
        root,
        leftLeg: lLegRig.hip,
        rightLeg: rLegRig.hip,
        leftKnee: lLegRig.knee,
        rightKnee: rLegRig.knee,
        leftArm: lArmRig.shoulder,
        rightArm: rArmRig.shoulder,
        leftElbow: lArmRig.elbow,
        rightElbow: rArmRig.elbow,
        head,
        torso,
        position: new THREE.Vector3(spec.position[0], spec.position[1], spec.position[2]),
        yaw: spec.facingYaw,
        waypointIndex: 0,
        waitTimer: (idx % 4) * 0.6,
        animPhase: idx * 1.17,
        subActionIndex: idx % 3,
        subActionTimer: 2.5 + (idx % 5) * 0.9,
        reactingToPlayer: false,
        explicitReaction: 'none',
        explicitReactionTimer: 0,
      });
    });
  }

  public update(dt: number, playerPosition: THREE.Vector3): void {
    const clampedDt = Math.min(dt, 0.05);

    for (const npc of this.npcs) {
      npc.animPhase += clampedDt;
      npc.subActionTimer -= clampedDt;
      if (npc.subActionTimer <= 0) {
        npc.subActionIndex = (npc.subActionIndex + 1) % 3;
        npc.subActionTimer = 3.2 + (Math.sin(npc.animPhase * 7.3) + 1) * 1.8;
      }

      if (npc.explicitReactionTimer > 0) {
        npc.explicitReactionTimer = Math.max(0, npc.explicitReactionTimer - clampedDt);
        if (npc.explicitReactionTimer === 0) {
          npc.explicitReaction = 'none';
        }
      }

      const dxP = playerPosition.x - npc.position.x;
      const dzP = playerPosition.z - npc.position.z;
      const distSqPlayer = dxP * dxP + dzP * dzP;
      const playerNear = distSqPlayer < 3.6 * 3.6 && Math.abs(playerPosition.y - npc.position.y) < 1.8;
      const playerVeryClose = distSqPlayer < 1.8 * 1.8 && Math.abs(playerPosition.y - npc.position.y) < 1.8;

      let moving = false;

      if (npc.explicitReactionTimer > 0) {
        npc.yaw = dampAngle(npc.yaw, Math.atan2(dxP, dzP), 7, clampedDt);
      } else if (npc.spec.waypoints && npc.spec.waypoints.length > 1) {
        if (playerVeryClose) {
          npc.reactingToPlayer = true;
          npc.yaw = dampAngle(npc.yaw, Math.atan2(dxP, dzP), 6, clampedDt);
        } else if (npc.waitTimer > 0) {
          npc.waitTimer -= clampedDt;
          if (playerNear) {
            npc.yaw = dampAngle(npc.yaw, Math.atan2(dxP, dzP), 5, clampedDt);
          }
        } else {
          npc.reactingToPlayer = false;
          const wp = npc.spec.waypoints[npc.waypointIndex];
          const wx = wp[0] - npc.position.x;
          const wz = wp[2] - npc.position.z;
          const dist = Math.hypot(wx, wz);

          if (dist < 0.25) {
            npc.waypointIndex = (npc.waypointIndex + 1) % npc.spec.waypoints.length;
            npc.waitTimer =
              npc.actionKind === 'browse' ? 3.4 + npc.subActionIndex * 0.9 : 1.8 + npc.subActionIndex * 0.6;
          } else {
            moving = true;
            const speed = npc.spec.moveSpeed ?? 1.6;
            const step = Math.min(dist, speed * clampedDt);
            npc.position.x += (wx / dist) * step;
            npc.position.z += (wz / dist) * step;
            npc.position.y = THREE.MathUtils.damp(npc.position.y, wp[1], 10, clampedDt);

            npc.yaw = dampAngle(npc.yaw, Math.atan2(wx, wz), 8, clampedDt);
          }
        }
      } else {
        if (playerNear) {
          npc.reactingToPlayer = true;
          npc.yaw = dampAngle(npc.yaw, Math.atan2(dxP, dzP), 5.5, clampedDt);
        } else {
          npc.reactingToPlayer = false;
          npc.yaw = dampAngle(npc.yaw, npc.spec.facingYaw, 4, clampedDt);
        }
      }

      npc.root.position.copy(npc.position);
      npc.root.rotation.y = npc.yaw;

      if (moving) {
        const cycle = npc.animPhase * 6.0;
        const swing = Math.sin(cycle) * 0.44;
        npc.leftLeg.rotation.x = swing;
        npc.rightLeg.rotation.x = -swing;
        npc.leftKnee.rotation.x = Math.max(0, -Math.sin(cycle + 0.5)) * 0.62;
        npc.rightKnee.rotation.x = Math.max(0, Math.sin(cycle + 0.5)) * 0.62;

        if (npc.actionKind === 'haul') {
          npc.leftArm.rotation.x = -0.62;
          npc.rightArm.rotation.x = -0.62;
          npc.leftElbow.rotation.x = -0.68;
          npc.rightElbow.rotation.x = -0.68;
          npc.torso.rotation.x = 0.08;
        } else {
          npc.leftArm.rotation.x = -swing * 0.62;
          npc.rightArm.rotation.x = swing * 0.62;
          npc.leftElbow.rotation.x = -0.22 - Math.max(0, swing) * 0.25;
          npc.rightElbow.rotation.x = -0.22 - Math.max(0, -swing) * 0.25;
          npc.torso.rotation.x = 0.03;
        }
        npc.rightArm.rotation.z = 0;
        npc.head.rotation.x = THREE.MathUtils.damp(npc.head.rotation.x, 0, 8, clampedDt);
        npc.head.rotation.y = THREE.MathUtils.damp(npc.head.rotation.y, 0, 8, clampedDt);
      } else {
        npc.leftLeg.rotation.x = THREE.MathUtils.damp(npc.leftLeg.rotation.x, 0, 10, clampedDt);
        npc.rightLeg.rotation.x = THREE.MathUtils.damp(npc.rightLeg.rotation.x, 0, 10, clampedDt);
        npc.leftKnee.rotation.x = THREE.MathUtils.damp(npc.leftKnee.rotation.x, 0, 10, clampedDt);
        npc.rightKnee.rotation.x = THREE.MathUtils.damp(npc.rightKnee.rotation.x, 0, 10, clampedDt);

        if (npc.explicitReaction !== 'none') {
          const r = npc.explicitReaction;
          if (r === 'salute') {
            npc.leftArm.rotation.x = THREE.MathUtils.damp(npc.leftArm.rotation.x, -1.52, 12, clampedDt);
            npc.leftElbow.rotation.x = THREE.MathUtils.damp(npc.leftElbow.rotation.x, -1.65, 12, clampedDt);
            npc.rightArm.rotation.x = THREE.MathUtils.damp(npc.rightArm.rotation.x, -0.28, 10, clampedDt);
            npc.torso.rotation.x = THREE.MathUtils.damp(npc.torso.rotation.x, 0.04, 10, clampedDt);
            npc.head.rotation.x = 0.05;
          } else if (r === 'wave') {
            npc.rightArm.rotation.x = -2.25;
            npc.rightArm.rotation.z = -0.45 + Math.sin(npc.animPhase * 9.0) * 0.3;
            npc.rightElbow.rotation.x = -0.55;
            npc.head.rotation.z = 0.08;
          } else if (r === 'bow') {
            npc.torso.rotation.x = THREE.MathUtils.damp(npc.torso.rotation.x, 0.34, 10, clampedDt);
            npc.head.rotation.x = 0.24;
            npc.rightArm.rotation.x = -0.4;
          } else if (r === 'laugh') {
            npc.torso.rotation.x = -0.06 + Math.sin(npc.animPhase * 12) * 0.06;
            npc.head.rotation.x = -0.18 + Math.sin(npc.animPhase * 14) * 0.1;
            npc.rightArm.rotation.x = -0.8 + Math.sin(npc.animPhase * 8) * 0.2;
          } else if (r === 'point') {
            npc.leftArm.rotation.x = THREE.MathUtils.damp(npc.leftArm.rotation.x, -1.45, 12, clampedDt);
            npc.leftElbow.rotation.x = THREE.MathUtils.damp(npc.leftElbow.rotation.x, -0.08, 12, clampedDt);
          } else {
            // nod
            npc.head.rotation.x = Math.sin(npc.animPhase * 7.5) * 0.18;
            npc.torso.rotation.x = THREE.MathUtils.damp(npc.torso.rotation.x, 0, 8, clampedDt);
          }
          continue;
        }

        npc.head.rotation.z = THREE.MathUtils.damp(npc.head.rotation.z, 0, 10, clampedDt);
        npc.torso.rotation.x = THREE.MathUtils.damp(npc.torso.rotation.x, 0, 8, clampedDt);

        if (npc.reactingToPlayer) {
          const greetWave = npc.subActionIndex === 0 ? Math.sin(npc.animPhase * 5.2) * 0.25 - 0.55 : -0.15;
          npc.rightArm.rotation.x = THREE.MathUtils.damp(npc.rightArm.rotation.x, greetWave, 7, clampedDt);
          npc.rightArm.rotation.z = THREE.MathUtils.damp(
            npc.rightArm.rotation.z,
            npc.subActionIndex === 0 ? -0.22 : 0,
            7,
            clampedDt
          );
          npc.rightElbow.rotation.x = THREE.MathUtils.damp(
            npc.rightElbow.rotation.x,
            npc.subActionIndex === 0 ? -0.65 : -0.2,
            7,
            clampedDt
          );
          npc.leftArm.rotation.x = THREE.MathUtils.damp(npc.leftArm.rotation.x, 0.05, 7, clampedDt);
          npc.leftElbow.rotation.x = THREE.MathUtils.damp(npc.leftElbow.rotation.x, -0.18, 7, clampedDt);
          npc.head.rotation.y = THREE.MathUtils.damp(npc.head.rotation.y, 0, 8, clampedDt);
          npc.head.rotation.x = Math.sin(npc.animPhase * 3.0) * 0.06;
        } else if (npc.actionKind === 'forge') {
          if (npc.subActionIndex !== 2) {
            const strike = Math.pow(Math.max(0, Math.sin(npc.animPhase * 4.4)), 2);
            npc.rightArm.rotation.x = -0.3 - strike * 0.95;
            npc.rightElbow.rotation.x = -0.45 - strike * 0.4;
            npc.leftArm.rotation.x = -0.38;
            npc.leftElbow.rotation.x = -0.35;
            npc.torso.rotation.x = 0.08 + strike * 0.1;
            npc.head.rotation.x = 0.16;
          } else {
            npc.rightArm.rotation.x = -0.45 + Math.sin(npc.animPhase * 1.8) * 0.08;
            npc.rightElbow.rotation.x = -0.45;
            npc.leftArm.rotation.x = -0.45;
            npc.leftElbow.rotation.x = -0.35;
            npc.head.rotation.y = Math.sin(npc.animPhase * 1.5) * 0.22;
          }
          npc.rightArm.rotation.z = 0;
        } else if (npc.actionKind === 'sweep') {
          if (npc.subActionIndex !== 2) {
            const sweep = Math.sin(npc.animPhase * 3.2) * 0.34;
            npc.rightArm.rotation.x = -0.38 + sweep * 0.35;
            npc.rightArm.rotation.z = sweep * 0.45;
            npc.rightElbow.rotation.x = -0.35;
            npc.leftArm.rotation.x = -0.35 - sweep * 0.2;
            npc.leftElbow.rotation.x = -0.32;
            npc.torso.rotation.x = 0.08;
            npc.head.rotation.x = 0.18;
          } else {
            npc.rightArm.rotation.x = -0.2;
            npc.rightArm.rotation.z = 0;
            npc.rightElbow.rotation.x = -0.25;
            npc.leftArm.rotation.x = 0.04;
            npc.leftElbow.rotation.x = -0.15;
            npc.head.rotation.y = Math.sin(npc.animPhase * 1.4) * 0.28;
            npc.head.rotation.x = 0;
          }
        } else if (npc.actionKind === 'clipboard') {
          npc.leftArm.rotation.x = -0.58;
          npc.leftElbow.rotation.x = -0.55;
          npc.rightArm.rotation.x = -0.48 + Math.sin(npc.animPhase * 4.0) * 0.12;
          npc.rightElbow.rotation.x = -0.48;
          npc.rightArm.rotation.z = 0.22;
          npc.head.rotation.x = npc.subActionIndex === 1 ? -0.05 : 0.22;
          npc.head.rotation.y = npc.subActionIndex === 1 ? Math.sin(npc.animPhase * 1.6) * 0.25 : 0;
        } else if (npc.actionKind === 'announce') {
          const armRaise =
            npc.subActionIndex === 0
              ? -1.25 + Math.sin(npc.animPhase * 4.5) * 0.18
              : -0.38 + Math.sin(npc.animPhase * 3.0) * 0.18;
          npc.rightArm.rotation.x = armRaise;
          npc.rightElbow.rotation.x = npc.subActionIndex === 0 ? -0.35 : -0.45;
          npc.rightArm.rotation.z = -0.18;
          npc.leftArm.rotation.x = -0.28 + Math.cos(npc.animPhase * 2.8) * 0.18;
          npc.leftElbow.rotation.x = -0.32;
          npc.head.rotation.y = Math.sin(npc.animPhase * 1.8) * 0.36;
          npc.head.rotation.x = -0.06;
        } else if (npc.actionKind === 'watch') {
          npc.rightArm.rotation.x = -0.32;
          npc.rightElbow.rotation.x = -0.55;
          npc.rightArm.rotation.z = 0;
          npc.leftArm.rotation.x = 0.04;
          npc.leftElbow.rotation.x = -0.16;
          npc.head.rotation.y = Math.sin(npc.animPhase * 0.85) * 0.38;
          npc.head.rotation.x = 0;
        } else if (npc.actionKind === 'converse' || npc.actionKind === 'browse') {
          npc.leftArm.rotation.x = -0.18 + Math.sin(npc.animPhase * 2.5) * 0.14;
          npc.leftElbow.rotation.x = -0.42;
          npc.rightArm.rotation.x = -0.22 - Math.sin(npc.animPhase * 2.5) * 0.16;
          npc.rightElbow.rotation.x = -0.48;
          npc.rightArm.rotation.z = npc.subActionIndex === 1 ? -0.15 : 0;
          npc.head.rotation.y = Math.sin(npc.animPhase * 1.4) * 0.22;
          npc.head.rotation.x = Math.sin(npc.animPhase * 2.8) * 0.08;
        } else if (npc.actionKind === 'haul') {
          npc.leftArm.rotation.x = -0.62;
          npc.rightArm.rotation.x = -0.62;
          npc.leftElbow.rotation.x = -0.68;
          npc.rightElbow.rotation.x = -0.68;
          npc.rightArm.rotation.z = 0;
          npc.head.rotation.y = Math.sin(npc.animPhase * 1.2) * 0.2;
        } else {
          const breath = Math.sin(npc.animPhase * 1.9) * 0.03;
          npc.leftArm.rotation.x = THREE.MathUtils.damp(npc.leftArm.rotation.x, breath, 8, clampedDt);
          npc.leftElbow.rotation.x = THREE.MathUtils.damp(npc.leftElbow.rotation.x, -0.16, 8, clampedDt);
          npc.rightArm.rotation.x = THREE.MathUtils.damp(
            npc.rightArm.rotation.x,
            npc.subActionIndex === 2 ? -0.28 : -breath,
            6,
            clampedDt
          );
          npc.rightElbow.rotation.x = THREE.MathUtils.damp(
            npc.rightElbow.rotation.x,
            npc.subActionIndex === 2 ? -0.48 : -0.16,
            6,
            clampedDt
          );
          npc.rightArm.rotation.z = 0;
          npc.head.rotation.y = Math.sin(npc.animPhase * 1.1) * 0.24;
          npc.head.rotation.x = Math.sin(npc.animPhase * 0.9) * 0.05;
        }
      }
    }
  }

  public clear(): void {
    for (const npc of this.npcs) {
      this.group.remove(npc.root);
    }
    this.npcs.length = 0;
  }

  public dispose(): void {
    this.clear();
    for (const g of this.sharedGeos) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}
