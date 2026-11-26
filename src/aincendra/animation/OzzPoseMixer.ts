export interface OzzPoseLayerWeights {
  locomotionWeight: number;
  upperCombatWeight: number;
  guardWeight: number;
  spellCastWeight: number;
  recoilPitch: number;
  recoilRoll: number;
}

export interface OzzPoseInputs {
  isMoving: boolean;
  isSwinging: boolean;
  isGuarding: boolean;
  spellCastTimer: number;
  riposteLungeTimer: number;
}

/**
 * Ozz-Animation-inspired dual-layer procedural skeletal pose blender:
 * Smoothly isolates lower-body stride kinematics from upper-body guard/swing/spell
 * masks and accumulates additive impact recoil without frame pops.
 */
export class OzzPoseMixer {
  private readonly weights: OzzPoseLayerWeights = {
    locomotionWeight: 0,
    upperCombatWeight: 0,
    guardWeight: 0,
    spellCastWeight: 0,
    recoilPitch: 0,
    recoilRoll: 0,
  };

  public triggerAdditiveRecoil(pitchRad: number, rollRad = 0): void {
    this.weights.recoilPitch = Math.max(-0.55, Math.min(0.55, this.weights.recoilPitch + pitchRad));
    this.weights.recoilRoll = Math.max(-0.45, Math.min(0.45, this.weights.recoilRoll + rollRad));
  }

  public update(dt: number, inputs: OzzPoseInputs): OzzPoseLayerWeights {
    const k = 1 - Math.exp(-16 * Math.min(dt, 0.05));
    const decay = Math.exp(-12 * Math.min(dt, 0.05));

    const targetLocomotion = inputs.isMoving ? 1 : 0;
    const targetCombat = inputs.isSwinging || inputs.riposteLungeTimer > 0 ? 1 : 0;
    const targetGuard = inputs.isGuarding ? 1 : 0;
    const targetSpell = inputs.spellCastTimer > 0 ? 1 : 0;

    this.weights.locomotionWeight += (targetLocomotion - this.weights.locomotionWeight) * k;
    this.weights.upperCombatWeight += (targetCombat - this.weights.upperCombatWeight) * k;
    this.weights.guardWeight += (targetGuard - this.weights.guardWeight) * k;
    this.weights.spellCastWeight += (targetSpell - this.weights.spellCastWeight) * k;

    this.weights.recoilPitch *= decay;
    this.weights.recoilRoll *= decay;

    return this.weights;
  }

  public getWeights(): Readonly<OzzPoseLayerWeights> {
    return this.weights;
  }
}
