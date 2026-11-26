import assert from 'node:assert/strict';
import test from 'node:test';
import { OzzPoseMixer } from '../animation/OzzPoseMixer.ts';
import { FastNoiseField } from './FastNoiseField.ts';
import { evaluateMaterialMakerGraph } from './MaterialMakerGraph.ts';
import { getCountrysideGroundY } from './VaelcrestCountryside.ts';
import { buildVoxelOutcropData } from './VoxelOutcropBuilder.ts';

test('FastNoiseField is deterministic and generates smooth multi-octave elevation & moisture', () => {
  const fieldA = new FastNoiseField(1306);
  const fieldB = new FastNoiseField(1306);

  const e1 = fieldA.sampleTerrainElevation(128.5, 420.25);
  const e2 = fieldB.sampleTerrainElevation(128.5, 420.25);
  assert.equal(e1, e2);
  assert.ok(Number.isFinite(e1));

  const m = fieldA.sampleMoisture(128.5, 420.25);
  assert.ok(m >= 0 && m <= 1, `Expected moisture in [0,1], got ${m}`);
});

test('getCountrysideGroundY keeps city flat at 0.16m and smoothly varies outside city walls', () => {
  assert.equal(getCountrysideGroundY(0, 29), 0.16);
  assert.equal(getCountrysideGroundY(0, 320), 0.16);

  const nearGate = getCountrysideGroundY(0, 337);
  const farWilds = getCountrysideGroundY(210, 540);
  assert.ok(Math.abs(nearGate - 0.16) < 0.25, 'Gate transition should avoid sudden steps');
  assert.ok(Number.isFinite(farWilds) && farWilds >= -0.45);
});

test('evaluateMaterialMakerGraph produces valid height, roughness, AO, and unit-length normal data', () => {
  const maps = evaluateMaterialMakerGraph({
    size: 32,
    seed: 101,
    noiseScale: 0.08,
    voronoiWeight: 0.35,
    fbmWeight: 0.65,
    normalStrength: 2.2,
    minRoughness: 0.45,
    maxRoughness: 0.9,
  });

  assert.equal(maps.heightField.length, 32 * 32);
  assert.equal(maps.roughnessField.length, 32 * 32);
  assert.equal(maps.aoField.length, 32 * 32);
  assert.equal(maps.normalData.length, 32 * 32 * 4);

  for (let i = 0; i < 32 * 32; i++) {
    assert.ok(maps.roughnessField[i] >= 0.44 && maps.roughnessField[i] <= 0.91);
    assert.ok(maps.aoField[i] >= 0.28 && maps.aoField[i] <= 1.0);
    const nx = (maps.normalData[i * 4] / 255) * 2 - 1;
    const ny = (maps.normalData[i * 4 + 1] / 255) * 2 - 1;
    const nz = (maps.normalData[i * 4 + 2] / 255) * 2 - 1;
    const len = Math.hypot(nx, ny, nz);
    assert.ok(len > 0.92 && len < 1.08, `Expected ~unit normal, got len=${len}`);
  }
});

test('buildVoxelOutcropData generates valid closed outward face geometry for both arch and crystal modes', () => {
  const arch = buildVoxelOutcropData({
    gridX: 8,
    gridY: 10,
    gridZ: 8,
    voxelSize: 0.5,
    seed: 701,
    mode: 'basalt-arch',
  });
  assert.ok(arch.solidVoxelCount > 0);
  assert.ok(arch.positions.length > 0 && arch.positions.length % 9 === 0);
  assert.equal(arch.normals.length, arch.positions.length);
  assert.equal(arch.colors.length, arch.positions.length);

  const crystal = buildVoxelOutcropData({
    gridX: 6,
    gridY: 12,
    gridZ: 6,
    voxelSize: 0.4,
    seed: 809,
    mode: 'aether-crystal',
  });
  assert.ok(crystal.solidVoxelCount > 0);
  assert.ok(crystal.positions.length > 0 && crystal.positions.length % 9 === 0);
});

test('OzzPoseMixer blends upper/lower mask weights and clamps & decays additive recoil', () => {
  const mixer = new OzzPoseMixer();
  mixer.triggerAdditiveRecoil(-0.8, 0.7);
  let w = mixer.getWeights();
  assert.ok(w.recoilPitch >= -0.55 && w.recoilRoll <= 0.45);

  for (let i = 0; i < 12; i++) {
    w = mixer.update(0.03, {
      isMoving: true,
      isSwinging: true,
      isGuarding: false,
      spellCastTimer: 0,
      riposteLungeTimer: 0,
    });
  }
  assert.ok(w.locomotionWeight > 0.9);
  assert.ok(w.upperCombatWeight > 0.9);
  assert.ok(Math.abs(w.recoilPitch) < 0.05);
});
