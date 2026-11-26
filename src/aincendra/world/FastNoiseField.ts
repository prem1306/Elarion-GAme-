import FastNoiseLite from 'fastnoise-lite';

/**
 * Deterministic multi-layer Auburn FastNoiseLite field generator
 * (OpenSimplex2 base terrain, Ridged foothills, Cellular Voronoi mineral veins,
 * and Domain Warp for natural biome & voxel density variation).
 */
export class FastNoiseField {
  private readonly terrainBase: FastNoiseLite;
  private readonly terrainRidge: FastNoiseLite;
  private readonly biomeWarpX: FastNoiseLite;
  private readonly biomeWarpZ: FastNoiseLite;
  private readonly detailCellular: FastNoiseLite;
  private readonly voxelDensity: FastNoiseLite;

  constructor(seed = 1306) {
    this.terrainBase = new FastNoiseLite(seed);
    this.terrainBase.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
    this.terrainBase.SetFractalType(FastNoiseLite.FractalType.FBm);
    this.terrainBase.SetFractalOctaves(4);
    this.terrainBase.SetFractalLacunarity(2.05);
    this.terrainBase.SetFractalGain(0.48);
    this.terrainBase.SetFrequency(0.0065);

    this.terrainRidge = new FastNoiseLite(seed + 101);
    this.terrainRidge.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S);
    this.terrainRidge.SetFractalType(FastNoiseLite.FractalType.Ridged);
    this.terrainRidge.SetFractalOctaves(3);
    this.terrainRidge.SetFrequency(0.0042);

    this.biomeWarpX = new FastNoiseLite(seed + 211);
    this.biomeWarpX.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
    this.biomeWarpX.SetFrequency(0.008);

    this.biomeWarpZ = new FastNoiseLite(seed + 257);
    this.biomeWarpZ.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
    this.biomeWarpZ.SetFrequency(0.008);

    this.detailCellular = new FastNoiseLite(seed + 307);
    this.detailCellular.SetNoiseType(FastNoiseLite.NoiseType.Cellular);
    this.detailCellular.SetCellularDistanceFunction(FastNoiseLite.CellularDistanceFunction.EuclideanSq);
    this.detailCellular.SetCellularReturnType(FastNoiseLite.CellularReturnType.Distance2Div);
    this.detailCellular.SetFrequency(0.06);

    this.voxelDensity = new FastNoiseLite(seed + 409);
    this.voxelDensity.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
    this.voxelDensity.SetFractalType(FastNoiseLite.FractalType.FBm);
    this.voxelDensity.SetFractalOctaves(3);
    this.voxelDensity.SetFrequency(0.28);
  }

  public sampleTerrainElevation(x: number, z: number): number {
    const wx = x + this.biomeWarpX.GetNoise(x, z) * 26.0;
    const wz = z + this.biomeWarpZ.GetNoise(x + 31.7, z - 19.3) * 26.0;
    const fbm = this.terrainBase.GetNoise(wx, wz); // -1..1
    const ridge = Math.max(0, this.terrainRidge.GetNoise(wx * 0.85, wz * 0.85)); // 0..1
    return fbm * 4.4 + ridge * ridge * 8.5;
  }

  public sampleMoisture(x: number, z: number): number {
    const n = this.terrainBase.GetNoise(x * 0.45 + 120, z * 0.45 - 80);
    return (n + 1) * 0.5;
  }

  public sampleCellular(x: number, y: number): number {
    return this.detailCellular.GetNoise(x, y);
  }

  public sampleVoxelDensity3D(x: number, y: number, z: number): number {
    return this.voxelDensity.GetNoise(x, y, z);
  }
}

export const SHARED_FAST_NOISE = new FastNoiseField(1306);
