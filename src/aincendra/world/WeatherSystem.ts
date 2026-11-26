import * as THREE from 'three';
import type { WeatherState } from '../core/types';

interface WeatherPreset {
  zenith: THREE.Color;
  horizon: THREE.Color;
  fogDensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  exposure: number;
  envIntensity: number;
  cloudCover: number;
  sunGlow: number;
  rainOpacity: number;
}

export interface WeatherLightingTargets {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
}

const WEATHER_ORDER: WeatherState[] = ['clear', 'overcast', 'rainy'];
const STATE_HOLD_SECONDS: Record<WeatherState, number> = {
  clear: 24,
  overcast: 18,
  rainy: 22,
};

const WEATHER_PRESETS: Record<WeatherState, WeatherPreset> = {
  clear: {
    zenith: new THREE.Color(0x4786bf),
    horizon: new THREE.Color(0xa6c7de),
    fogDensity: 0.00068,
    sunColor: new THREE.Color(0xfff3d8),
    sunIntensity: 2.08,
    hemiSky: new THREE.Color(0xe4eff8),
    hemiGround: new THREE.Color(0x454c54),
    hemiIntensity: 0.96,
    rimColor: new THREE.Color(0x88b4d8),
    rimIntensity: 0.46,
    exposure: 1.12,
    envIntensity: 1.0,
    cloudCover: 0.08,
    sunGlow: 1.0,
    rainOpacity: 0.0,
  },
  overcast: {
    zenith: new THREE.Color(0x5b6978),
    horizon: new THREE.Color(0x87939e),
    fogDensity: 0.00145,
    sunColor: new THREE.Color(0xd7dee6),
    sunIntensity: 0.82,
    hemiSky: new THREE.Color(0xb4c1ce),
    hemiGround: new THREE.Color(0x363b42),
    hemiIntensity: 0.78,
    rimColor: new THREE.Color(0x7c8b9c),
    rimIntensity: 0.30,
    exposure: 0.98,
    envIntensity: 0.72,
    cloudCover: 0.76,
    sunGlow: 0.14,
    rainOpacity: 0.0,
  },
  rainy: {
    zenith: new THREE.Color(0x2d3947),
    horizon: new THREE.Color(0x556270),
    fogDensity: 0.0024,
    sunColor: new THREE.Color(0xa2b3c4),
    sunIntensity: 0.42,
    hemiSky: new THREE.Color(0x7c8ea1),
    hemiGround: new THREE.Color(0x242a32),
    hemiIntensity: 0.58,
    rimColor: new THREE.Color(0x5e7388),
    rimIntensity: 0.24,
    exposure: 0.88,
    envIntensity: 0.50,
    cloudCover: 0.96,
    sunGlow: 0.0,
    rainOpacity: 0.44,
  },
};

const RAIN_COUNT = 850;
const RAIN_BOX_W = 46;
const RAIN_BOX_H = 22;
const RAIN_BOX_D = 46;

/**
 * Procedural Dynamic Weather System for AincendraEngine:
 * - Cycles smoothly between Clear -> Overcast -> Rainy -> Clear
 * - Updates procedural Sky Dome shader (zenith, horizon, cloud deck, sun disc), Scene FogExp2,
 *   Sun/Hemisphere/Rim light colors & intensities, renderer exposure, and single-draw-call rain streaks.
 */
export class WeatherSystem {
  public readonly group = new THREE.Group();

  private currentState: WeatherState = 'clear';
  private autoCycle = true;
  private cycleTimer = STATE_HOLD_SECONDS.clear;
  private elapsed = 0;

  // Sky Dome
  private readonly skyGeo: THREE.SphereGeometry;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly skyMesh: THREE.Mesh;

  // Rain LineSegments (single draw call, zero per-frame allocations)
  private readonly rainGeo: THREE.BufferGeometry;
  private readonly rainMat: THREE.LineBasicMaterial;
  private readonly rainLines: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  private readonly rainBaseOffsets: Float32Array;
  private readonly rainSpeeds: Float32Array;

  // Smoothly damped state values
  private readonly curZenith = new THREE.Color().copy(WEATHER_PRESETS.clear.zenith);
  private readonly curHorizon = new THREE.Color().copy(WEATHER_PRESETS.clear.horizon);
  private curFogDensity = WEATHER_PRESETS.clear.fogDensity;
  private curCloudCover = WEATHER_PRESETS.clear.cloudCover;
  private curSunGlow = WEATHER_PRESETS.clear.sunGlow;
  private curRainOpacity = WEATHER_PRESETS.clear.rainOpacity;

  constructor() {
    this.group.name = 'Elarion_Dynamic_Weather';

    // 1. Procedural Gradient Skybox Dome
    this.skyGeo = new THREE.SphereGeometry(1800, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: this.curZenith },
        uHorizon: { value: this.curHorizon },
        uSunDir: { value: new THREE.Vector3(28, 42, 22).normalize() },
        uCloudCover: { value: this.curCloudCover },
        uSunGlow: { value: this.curSunGlow },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform float uCloudCover;
        uniform float uSunGlow;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = clamp(dir.y, 0.0, 1.0);
          float horizonMix = pow(1.0 - elev, 1.65);
          vec3 sky = mix(uZenith, uHorizon, horizonMix);

          // Procedural drifting cloud layer overhead
          if (dir.y > 0.02) {
            vec2 cloudUv = dir.xz / (dir.y + 0.22) * 1.45 + vec2(uTime * 0.012, uTime * 0.006);
            float n1 = valueNoise(cloudUv * 1.4);
            float n2 = valueNoise(cloudUv * 3.1 + vec2(4.2, 1.7));
            float cloudPattern = n1 * 0.65 + n2 * 0.35;
            float cloudMask = smoothstep(0.68 - uCloudCover * 0.56, 0.92 - uCloudCover * 0.32, cloudPattern);
            float horizonFade = smoothstep(0.02, 0.24, dir.y);
            vec3 cloudTint = mix(vec3(0.95, 0.97, 1.0), uHorizon * 0.88, uCloudCover * 0.72);
            sky = mix(sky, cloudTint, cloudMask * horizonFade * (0.28 + uCloudCover * 0.62));
          }

          // Sun disc & warm atmospheric halo (fades during overcast/rain)
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float halo = pow(sunDot, 12.0) * 0.28 * uSunGlow;
          float disc = smoothstep(0.9965, 0.9992, sunDot) * 0.95 * uSunGlow;
          sky += vec3(1.0, 0.92, 0.76) * (halo + disc);

          // Below-horizon sea blend matches fog color
          if (dir.y < 0.0) {
            sky = mix(uHorizon, uHorizon * 0.85, clamp(-dir.y * 2.5, 0.0, 1.0));
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });

    this.skyMesh = new THREE.Mesh(this.skyGeo, this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -10;
    this.group.add(this.skyMesh);

    // 2. Single-Draw-Call Rain Streaks around player
    this.rainPositions = new Float32Array(RAIN_COUNT * 6);
    this.rainBaseOffsets = new Float32Array(RAIN_COUNT * 3);
    this.rainSpeeds = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * RAIN_BOX_W;
      const ry = Math.random() * RAIN_BOX_H;
      const rz = (Math.random() - 0.5) * RAIN_BOX_D;
      this.rainBaseOffsets[i * 3] = rx;
      this.rainBaseOffsets[i * 3 + 1] = ry;
      this.rainBaseOffsets[i * 3 + 2] = rz;
      this.rainSpeeds[i] = 17.5 + Math.random() * 6.5;

      const idx = i * 6;
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;
      this.rainPositions[idx + 3] = rx - 0.09;
      this.rainPositions[idx + 4] = ry - 0.62;
      this.rainPositions[idx + 5] = rz - 0.05;
    }

    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xc8d9ea,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.group.add(this.rainLines);
  }

  public get state(): WeatherState {
    return this.currentState;
  }

  public get isAutoCycling(): boolean {
    return this.autoCycle;
  }

  public setWeatherMode(mode: WeatherState | 'auto'): void {
    if (mode === 'auto') {
      this.autoCycle = true;
      this.cycleTimer = STATE_HOLD_SECONDS[this.currentState];
      return;
    }
    this.autoCycle = false;
    this.currentState = mode;
  }

  public cycleNext(): void {
    const idx = WEATHER_ORDER.indexOf(this.currentState);
    this.currentState = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.cycleTimer = STATE_HOLD_SECONDS[this.currentState];
  }

  public update(
    dt: number,
    playerPosition: THREE.Vector3,
    targets: WeatherLightingTargets
  ): boolean {
    const clampedDt = Math.min(dt, 0.05);
    this.elapsed += clampedDt;

    let stateChanged = false;
    if (this.autoCycle) {
      this.cycleTimer -= clampedDt;
      if (this.cycleTimer <= 0) {
        this.cycleNext();
        stateChanged = true;
      }
    }

    const preset = WEATHER_PRESETS[this.currentState];
    const colorAlpha = 1 - Math.exp(-0.72 * clampedDt);
    const scalarLambda = 0.85;

    // 1. Interpolate skybox & fog
    this.curZenith.lerp(preset.zenith, colorAlpha);
    this.curHorizon.lerp(preset.horizon, colorAlpha);
    this.curFogDensity = THREE.MathUtils.damp(this.curFogDensity, preset.fogDensity, scalarLambda, clampedDt);
    this.curCloudCover = THREE.MathUtils.damp(this.curCloudCover, preset.cloudCover, scalarLambda, clampedDt);
    this.curSunGlow = THREE.MathUtils.damp(this.curSunGlow, preset.sunGlow, scalarLambda, clampedDt);
    this.curRainOpacity = THREE.MathUtils.damp(this.curRainOpacity, preset.rainOpacity, 1.35, clampedDt);

    this.skyMat.uniforms.uCloudCover.value = this.curCloudCover;
    this.skyMat.uniforms.uSunGlow.value = this.curSunGlow;
    this.skyMat.uniforms.uTime.value = this.elapsed;

    // Keep sky dome centered on player XZ so boundaries never clip
    this.skyMesh.position.set(playerPosition.x, 0, playerPosition.z);

    if (targets.scene.background instanceof THREE.Color) {
      targets.scene.background.copy(this.curHorizon);
    }
    if (targets.scene.fog instanceof THREE.FogExp2) {
      targets.scene.fog.color.copy(this.curHorizon);
      targets.scene.fog.density = this.curFogDensity;
    }

    // 2. Interpolate Sun, Hemisphere, Rim lights & Renderer exposure
    targets.sunLight.color.lerp(preset.sunColor, colorAlpha);
    targets.sunLight.intensity = THREE.MathUtils.damp(
      targets.sunLight.intensity,
      preset.sunIntensity,
      scalarLambda,
      clampedDt
    );

    targets.hemiLight.color.lerp(preset.hemiSky, colorAlpha);
    targets.hemiLight.groundColor.lerp(preset.hemiGround, colorAlpha);
    targets.hemiLight.intensity = THREE.MathUtils.damp(
      targets.hemiLight.intensity,
      preset.hemiIntensity,
      scalarLambda,
      clampedDt
    );

    targets.rimLight.color.lerp(preset.rimColor, colorAlpha);
    targets.rimLight.intensity = THREE.MathUtils.damp(
      targets.rimLight.intensity,
      preset.rimIntensity,
      scalarLambda,
      clampedDt
    );

    targets.renderer.toneMappingExposure = THREE.MathUtils.damp(
      targets.renderer.toneMappingExposure,
      preset.exposure,
      scalarLambda,
      clampedDt
    );
    targets.scene.environmentIntensity = THREE.MathUtils.damp(
      targets.scene.environmentIntensity,
      preset.envIntensity,
      scalarLambda,
      clampedDt
    );

    // 3. Update Rain Volume around player
    this.rainMat.opacity = this.curRainOpacity;
    if (this.curRainOpacity > 0.015) {
      this.rainLines.visible = true;
      const baseX = playerPosition.x;
      const baseY = playerPosition.y - 1.5;
      const baseZ = playerPosition.z;

      for (let i = 0; i < RAIN_COUNT; i++) {
        const bIdx = i * 3;
        let ry = this.rainBaseOffsets[bIdx + 1] - this.rainSpeeds[i] * clampedDt;
        if (ry < 0) {
          ry += RAIN_BOX_H;
        }
        this.rainBaseOffsets[bIdx + 1] = ry;

        const rx = baseX + this.rainBaseOffsets[bIdx];
        const worldY = baseY + ry;
        const rz = baseZ + this.rainBaseOffsets[bIdx + 2];

        const pIdx = i * 6;
        this.rainPositions[pIdx] = rx;
        this.rainPositions[pIdx + 1] = worldY;
        this.rainPositions[pIdx + 2] = rz;
        this.rainPositions[pIdx + 3] = rx - 0.11;
        this.rainPositions[pIdx + 4] = worldY - 0.68;
        this.rainPositions[pIdx + 5] = rz - 0.06;
      }

      const posAttr = this.rainGeo.getAttribute('position') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    return stateChanged;
  }

  public dispose(): void {
    this.skyGeo.dispose();
    this.skyMat.dispose();
    this.rainGeo.dispose();
    this.rainMat.dispose();
  }
}
