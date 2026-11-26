import * as THREE from 'three';

export interface RenderPassProfile {
  isSoftwareGl: boolean;
  pixelRatio: number;
  shadowsEnabled: boolean;
  exposure: number;
}

/**
 * The-Forge-inspired Declarative WebGL2 Render-Graph Orchestrator:
 * Configures renderer state, environment IBL, ACES Filmic tone-mapping curves,
 * and orders per-frame simulation, partition streaming, lighting, and present passes.
 */
export class ForgeRenderGraph {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly profile: RenderPassProfile;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    isSoftwareGl: boolean
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.profile = {
      isSoftwareGl,
      pixelRatio: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
      shadowsEnabled: !isSoftwareGl,
      exposure: 1.12,
    };

    this.applyRendererPipelineConfig();
  }

  private applyRendererPipelineConfig(): void {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.profile.exposure;
    this.renderer.setPixelRatio(this.profile.pixelRatio);
    this.renderer.shadowMap.enabled = this.profile.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.sortObjects = true;
  }

  public getProfile(): Readonly<RenderPassProfile> {
    return this.profile;
  }

  public executeFrame(
    onPreRenderPasses?: () => void,
    onPostRenderPasses?: () => void
  ): void {
    onPreRenderPasses?.();
    this.renderer.render(this.scene, this.camera);
    onPostRenderPasses?.();
  }
}
