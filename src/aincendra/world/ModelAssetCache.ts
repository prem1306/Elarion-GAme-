import * as THREE from 'three';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export type LocalModelKey =
  | 'alchemy_bench'
  | 'ancestral_shrine'
  | 'anvil'
  | 'blacksmith_forge'
  | 'crystal_wyrm'
  | 'dark_sentinel'
  | 'furnace_golem'
  | 'ley_mage'
  | 'ley_portal'
  | 'spectral_stag'
  | 'treasure_chest';

const MODEL_PATHS: Record<LocalModelKey, string> = {
  alchemy_bench: '/assets/models/alchemy_bench.glb',
  ancestral_shrine: '/assets/models/ancestral_shrine.glb',
  anvil: '/assets/models/anvil.glb',
  blacksmith_forge: '/assets/models/blacksmith_forge.glb',
  crystal_wyrm: '/assets/models/crystal_wyrm.glb',
  dark_sentinel: '/assets/models/dark_sentinel.glb',
  furnace_golem: '/assets/models/furnace_golem.glb',
  ley_mage: '/assets/models/ley_mage.glb',
  ley_portal: '/assets/models/ley_portal.glb',
  spectral_stag: '/assets/models/spectral_stag.glb',
  treasure_chest: '/assets/models/treasure_chest.glb',
};

interface CachedGltfTemplate {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

/**
 * Loads locally hosted CC0 GLB models with meshoptimizer WASM decoding,
 * normalized bottom-center pivots, calibrated scale, and LOD simplification helpers.
 */
export class ModelAssetCache {
  private readonly loader: GLTFLoader;
  private readonly cache = new Map<LocalModelKey, Promise<CachedGltfTemplate | null>>();

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  public async simplifyGeometryWithMeshopt(
    source: THREE.BufferGeometry,
    targetRatio = 0.45,
    targetError = 0.02
  ): Promise<THREE.BufferGeometry> {
    await MeshoptSimplifier.ready;
    const posAttr = source.getAttribute('position');
    const indexAttr = source.getIndex();
    if (!posAttr || !indexAttr || indexAttr.count < 60) {
      return source.clone();
    }
    const srcIndices =
      indexAttr.array instanceof Uint32Array
        ? indexAttr.array
        : new Uint32Array(indexAttr.array);
    const positions =
      posAttr.array instanceof Float32Array
        ? posAttr.array
        : new Float32Array(posAttr.array);
    const targetCount = Math.max(12, Math.floor((srcIndices.length * targetRatio) / 3) * 3);
    const [lodIndices] = MeshoptSimplifier.simplify(
      srcIndices,
      positions,
      posAttr.itemSize,
      targetCount,
      targetError
    );
    const lodGeo = source.clone();
    lodGeo.setIndex(new THREE.BufferAttribute(lodIndices, 1));
    lodGeo.computeVertexNormals();
    return lodGeo;
  }

  public loadNormalizedModel(
    key: LocalModelKey,
    targetHeight: number,
    options?: { castShadow?: boolean; receiveShadow?: boolean }
  ): Promise<{ group: THREE.Group; animations: THREE.AnimationClip[] } | null> {
    let basePromise = this.cache.get(key);
    if (!basePromise) {
      basePromise = new Promise<CachedGltfTemplate | null>((resolve) => {
        this.loader.load(
          MODEL_PATHS[key],
          (gltf) => {
            resolve({ scene: gltf.scene, animations: gltf.animations ?? [] });
          },
          undefined,
          () => {
            resolve(null);
          }
        );
      });
      this.cache.set(key, basePromise);
    }

    return basePromise.then((template) => {
      if (!template) return null;
      const clone = SkeletonUtils.clone(template.scene) as THREE.Group;
      clone.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(clone);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const safeH = Math.max(0.01, size.y);
      const scale = targetHeight / safeH;

      const wrapper = new THREE.Group();
      wrapper.name = `GLB_${key}`;

      clone.scale.multiplyScalar(scale);
      clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      const cast = options?.castShadow ?? true;
      const receive = options?.receiveShadow ?? true;
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = cast;
          mesh.receiveShadow = receive;
        }
      });

      wrapper.add(clone);
      return { group: wrapper, animations: template.animations };
    });
  }

  public mountIntoContainer(
    container: THREE.Group,
    key: LocalModelKey,
    targetHeight: number,
    fallbackGroup?: THREE.Object3D,
    onLoaded?: (model: THREE.Group, animations: THREE.AnimationClip[]) => void,
    options?: { castShadow?: boolean; receiveShadow?: boolean }
  ): void {
    this.loadNormalizedModel(key, targetHeight, options).then((loaded) => {
      if (!loaded) return;
      if (fallbackGroup) {
        fallbackGroup.visible = false;
      }
      container.add(loaded.group);
      onLoaded?.(loaded.group, loaded.animations);
    });
  }
}
