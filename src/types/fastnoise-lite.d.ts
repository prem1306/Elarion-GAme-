declare module 'fastnoise-lite' {
  export interface Vector2 {
    x: number;
    y: number;
  }

  export interface Vector3 {
    x: number;
    y: number;
    z: number;
  }

  export default class FastNoiseLite {
    static NoiseType: {
      OpenSimplex2: string;
      OpenSimplex2S: string;
      Cellular: string;
      Perlin: string;
      ValueCubic: string;
      Value: string;
    };

    static FractalType: {
      None: string;
      FBm: string;
      Ridged: string;
      PingPong: string;
      DomainWarpProgressive: string;
      DomainWarpIndependent: string;
    };

    static CellularDistanceFunction: {
      Euclidean: string;
      EuclideanSq: string;
      Manhattan: string;
      Hybrid: string;
    };

    static CellularReturnType: {
      CellValue: string;
      Distance: string;
      Distance2: string;
      Distance2Add: string;
      Distance2Sub: string;
      Distance2Mul: string;
      Distance2Div: string;
    };

    static DomainWarpType: {
      OpenSimplex2: string;
      OpenSimplex2Reduced: string;
      BasicGrid: string;
    };

    constructor(seed?: number);
    SetSeed(seed: number): void;
    SetFrequency(frequency: number): void;
    SetNoiseType(noiseType: string): void;
    SetFractalType(fractalType: string): void;
    SetFractalOctaves(octaves: number): void;
    SetFractalLacunarity(lacunarity: number): void;
    SetFractalGain(gain: number): void;
    SetCellularDistanceFunction(fn: string): void;
    SetCellularReturnType(ret: string): void;
    SetDomainWarpType(warpType: string): void;
    SetDomainWarpAmp(amp: number): void;
    GetNoise(x: number, y: number, z?: number): number;
    DomainWrap(coord: Vector2 | Vector3): void;
  }
}
