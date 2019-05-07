import {
    Vector3,
    MeshBasicMaterial,
    SphereBufferGeometry,
    Mesh,
    Object3D,
    Scene,
    Matrix4,
    Box2,
    Vector2,
    Box3,
    Layers,
    BoxBufferGeometry,
    MeshStandardMaterial,
    BufferGeometry,
    BufferAttribute,
    Material,
    Geometry,
    ConeGeometry,
    DoubleSide,
    MeshToonMaterial,
    AmbientLight,
    DirectionalLight,
    Math as ThreeMath,
    DirectionalLightHelper,
    Euler,
    SpriteMaterial,
    Sprite,
    Texture,
    PlaneBufferGeometry,
    Camera,
    WebGLRenderer,
} from 'three';
import { flatMap } from 'lodash';
import {
    calculateNumericalTagValue,
    FileCalculationContext,
    File,
    FileLabelAnchor,
} from '@casual-simulation/aux-common';
import { getOptionalValue } from '../SharedUtils';
import { HtmlMixer } from 'threex-htmlmixer';

/**
 * Create copy of material that most meshes in Aux Builder/Player use.
 */
export function baseAuxMeshMaterial() {
    return new MeshToonMaterial({
        color: 0x00ff00,
        reflectivity: 0.0,
        shininess: 2,
    });
}

/**
 * Create copy of ambient light that is common to all aux scenes.
 */
export function baseAuxAmbientLight() {
    return new AmbientLight(0x222222);
}

/**
 * Create copy of directional light that is common to all aux scenes.
 */
export function baseAuxDirectionalLight() {
    let dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.position.set(0.25, 3.0, 2.4);
    // let helper = new DirectionalLightHelper(dirLight);
    // dirLight.add(helper);
    return dirLight;
}

export function createSphere(
    position: Vector3,
    color: number,
    size: number = 0.1
) {
    const geometry = new SphereBufferGeometry(size, 16, 14);
    let material = baseAuxMeshMaterial();

    const sphere = new Mesh(geometry, material.clone());
    sphere.position.copy(position);
    return sphere;
}

export function createSprite(): Sprite {
    let material = new SpriteMaterial({
        color: 0x00ff00,
        transparent: true,
    });

    let sprite = new Sprite(material);
    return sprite;
}

export function createUserCone(radius?: number, height?: number): Mesh {
    radius = getOptionalValue(radius, 0.5);
    height = getOptionalValue(height, 0.7);
    const geometry = new ConeGeometry(radius, height, 4, 1, true);
    let material = baseAuxMeshMaterial();
    material.color.set(0x00d000);
    material.side = DoubleSide;
    material.flatShading = true;
    material.transparent = true;
    material.opacity = 0.4;
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
}

export function createCube(size: number): Mesh {
    const geometry = new BoxBufferGeometry(size, size, size);
    let material = baseAuxMeshMaterial();

    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
}

export function createPlane(size: number): Mesh {
    const geometry = new PlaneBufferGeometry(size, size);
    let material = baseAuxMeshMaterial();

    const plane = new Mesh(geometry, material);
    plane.castShadow = false;
    plane.receiveShadow = false;
    return plane;
}

export function createCubeStrokeGeometry(): BufferGeometry {
    const geo = new BufferGeometry();

    let verticies: number[][] = [
        [-0.5, -0.5, -0.5], // left  bottom back  - 0
        [0.5, -0.5, -0.5], // right bottom back  - 1
        [-0.5, 0.5, -0.5], // left  top    back  - 2
        [0.5, 0.5, -0.5], // right top    back  - 3
        [-0.5, -0.5, 0.5], // left  bottom front - 4
        [0.5, -0.5, 0.5], // right bottom front - 5
        [-0.5, 0.5, 0.5], // left  top    front - 6
        [0.5, 0.5, 0.5], // right top    front - 7
    ];

    const indicies = [
        0,
        1,
        0,
        2,
        0,
        4,

        4,
        5,
        4,
        6,

        5,
        7,
        5,
        1,

        1,
        3,

        2,
        3,
        2,
        6,

        3,
        7,

        6,
        7,
    ];
    const lines: number[] = flatMap(indicies, i => verticies[i]);
    const array = new Float32Array(lines);
    geo.addAttribute('position', new BufferAttribute(array, 3));

    return geo;
}

/**
 * Set the parent of the object3d.
 * @param object3d the object to re-parent.
 * @param parent the object to parent to.
 * @param scene the scene that these objects exist in.
 */
export function setParent(object3d: Object3D, parent: Object3D, scene: Scene) {
    if (!object3d) return;
    if (!scene)
        throw new Error('utils.setParent needs a valid scene parameter.');

    // Detach
    if (object3d.parent && object3d.parent !== scene) {
        object3d.applyMatrix(object3d.parent.matrixWorld);
        object3d.parent.remove(object3d);
        scene.add(object3d);
    }

    // Attach
    if (parent) {
        object3d.applyMatrix(new Matrix4().getInverse(parent.matrixWorld));
        scene.remove(object3d);
        parent.add(object3d);
    }

    object3d.updateMatrixWorld(true);
}

/**
 * Find the scene object that the given object is parented to.
 * Will return null if no parent scene is found.
 * @param object3d The object to find the parent scene for.
 */
export function findParentScene(object3d: Object3D): Scene {
    if (!object3d) {
        return null;
    }

    if (object3d instanceof Scene) {
        return object3d;
    } else {
        return findParentScene(object3d.parent);
    }
}

/**
 * Convert the Box3 object to a box2 object. Basically discards the z components of the Box3's min and max.
 * @param box3 The Box3 to convert to a Box2.
 */
export function convertToBox2(box3: Box3): Box2 {
    return new Box2(
        new Vector2(box3.min.x, box3.min.y),
        new Vector2(box3.max.x, box3.max.y)
    );
}

/**
 * Set the layer number that the given object 3d is on (and optionally all of its children too).
 * @param obj The root object 3d to change the layer.
 * @param layer The layer to set the object 3d to.
 * @param children Should change all children of given object 3d as well?
 */
export function setLayer(obj: Object3D, layer: number, children?: boolean) {
    obj.layers.set(layer);
    if (children) {
        obj.traverse(child => {
            child.layers.set(layer);
        });
    }
}

/**
 * Set the layer mask of the given object 3d (and optionally all of its children too).
 * @param obj The root object 3d to change the layer.
 * @param layerMask The layer mask to set the object 3d to.
 * @param children Should change all children of given object 3d as well?
 */
export function setLayerMask(
    obj: Object3D,
    layerMask: number,
    children?: boolean
) {
    obj.layers.mask = layerMask;
    if (children) {
        obj.traverse(child => {
            child.layers.mask = layerMask;
        });
    }
}

/**
 * Debug print out all 32 layers for this object and wether or not it belongs to them.
 * @param obj The object to print out layers for.
 */
export function debugLayersToString(obj: Object3D): string {
    if (!obj) return;

    let output: string = '\n';
    for (let i = 0; i < 32; i++) {
        let l = new Layers();
        l.set(i);
        output += '[' + i + ']  ' + obj.layers.test(l) + '\n';
    }

    return output;
}

/**
 * Calculates the scale.x, scale.y, and scale.z values from the given object.
 * @param context The calculation context.
 * @param obj The object.
 * @param multiplier The value that scale values should be multiplied by.
 * @param defaultScale The default value.
 * @param prefix The optional prefix for the tags. Defaults to `aux.`
 */
export function calculateScale(
    context: FileCalculationContext,
    obj: File,
    multiplier: number = 1,
    defaultScale: number = 1,
    prefix: string = 'aux.'
): Vector3 {
    const scaleX = calculateNumericalTagValue(
        context,
        obj,
        `${prefix}scale.x`,
        defaultScale
    );
    const scaleY = calculateNumericalTagValue(
        context,
        obj,
        `${prefix}scale.y`,
        defaultScale
    );
    const scaleZ = calculateNumericalTagValue(
        context,
        obj,
        `${prefix}scale.z`,
        defaultScale
    );
    const uniformScale = calculateNumericalTagValue(
        context,
        obj,
        `${prefix}scale`,
        1
    );

    return new Vector3(
        scaleX * multiplier * uniformScale,
        scaleZ * multiplier * uniformScale,
        scaleY * multiplier * uniformScale
    );
}

/**
 * Determines whether the given color means transparent.
 * @param color The color to check.
 */
export function isTransparent(color: string): boolean {
    return color === 'transparent' || color === 'clear';
}

/**
 * Disposes the given material(s).
 * @param material The material(s) to dispose.
 */
export function disposeMaterial(material: Material | Material[]) {
    if (!material) return;
    if (Array.isArray(material)) {
        material.forEach(m => m.dispose());
    } else {
        material.dispose();
    }
}

/**
 * Releases any unmanaged resources used by the given mesh.
 * @param mesh The mesh to dispose.
 * @param disposeGeometry Whether to dispose the mesh's geometry. Default true.
 * @param disposeMat Whether to dispose the mesh's material(s). Default true.
 */
export function disposeMesh(
    mesh: {
        geometry: Geometry | BufferGeometry;
        material: Material | Material[];
    },
    disposeGeometry: boolean = true,
    disposeMat: boolean = true
) {
    if (!mesh) return;
    if (disposeGeometry) {
        mesh.geometry.dispose();
    }
    if (disposeMat) {
        disposeMaterial(mesh.material);
    }
}

export function disposeObject3D(
    object3d: Object3D,
    disposeGeometry: boolean = true,
    disposeMaterial: boolean = true
) {
    if (!object3d) return;

    if (disposeGeometry) {
        let geometry = (<any>object3d).geometry;
        if (geometry) {
            geometry.dispose();
        }
    }

    if (disposeMaterial) {
        let material = (<any>object3d).material;
        if (material) {
            if (Array.isArray(material)) {
                for (let i = 0; i < material.length; i++) {
                    material[i].dispose();
                }
            } else {
                material.dispose();
            }
        }
    }
}

/**
 * Calculates the position and rotation that the given object should be placed at for the given anchor and position.
 * @param bounds The bounds to anchor to.
 * @param position The position to anchor to.
 * @param obj The object to anchor.
 * @param boundingBox The bounding box of the object to anchor.
 * @param defaultScale The default scale of the object.
 * @param extraSpacing The extra spacing to use.
 */
export function calculateAnchorPosition(
    bounds: Box3,
    position: FileLabelAnchor,
    obj: Object3D,
    boundingBox: Box3,
    defaultScale: number,
    extraSpacing: number
): [Vector3, Euler] {
    let myMax = boundingBox.max.clone();
    let myMin = boundingBox.min.clone();

    // // Position the mesh some distance above the given object's bounding box.
    let targetSize = new Vector3();
    bounds.getSize(targetSize);
    let targetCenter = new Vector3();
    bounds.getCenter(targetCenter);

    let paddingScalar = obj.scale.x / defaultScale;

    if (position === 'floating') {
        let bottomCenter = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = obj.position.clone().sub(bottomCenter);
        let pos = new Vector3(
            targetCenter.x,
            targetCenter.y + targetSize.y * 0.5 + extraSpacing * paddingScalar,
            targetCenter.z
        );
        pos.add(posOffset);
        return [pos, new Euler(ThreeMath.degToRad(90), 0, 0)];
    } else if (position === 'top') {
        let center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = obj.position.clone().sub(center);
        let pos = new Vector3(
            targetCenter.x,
            targetCenter.y + targetSize.y * 0.5,
            targetCenter.z
        );
        pos.add(posOffset);

        return [pos, new Euler(ThreeMath.degToRad(0), 0, 0)];
    } else if (position === 'front') {
        let center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = obj.position.clone().sub(center);
        let pos = new Vector3(
            targetCenter.x,
            targetCenter.y,
            targetCenter.z + targetSize.z * 0.5
        );
        pos.add(posOffset);

        return [pos, new Euler(ThreeMath.degToRad(90), 0, 0)];
    } else if (position === 'back') {
        let center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = obj.position.clone().sub(center);
        let pos = new Vector3(
            targetCenter.x,
            targetCenter.y,
            targetCenter.z - targetSize.z * 0.5
        );
        pos.add(posOffset);

        return [
            pos,
            new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(180), 0),
        ];
    } else if (position === 'left') {
        let center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = obj.position.clone().sub(center);
        let pos = new Vector3(
            targetCenter.x - targetSize.x * 0.5,
            targetCenter.y,
            targetCenter.z
        );
        pos.add(posOffset);

        return [
            pos,
            new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(90), 0),
        ];
    } else if (position === 'right') {
        let center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = obj.position.clone().sub(center);
        let pos = new Vector3(
            targetCenter.x + targetSize.x * 0.5,
            targetCenter.y,
            targetCenter.z
        );
        pos.add(posOffset);

        return [
            pos,
            new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(-90), 0),
        ];
    }

    return [targetCenter, new Euler()];
}

export function createHtmlMixerContext(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera
): HtmlMixer.Context {
    let mixerContext = new HtmlMixer.Context(renderer, scene, camera);
    mixerContext.rendererCss.setSize(window.innerWidth, window.innerHeight);

    // Handle window resize for mixer context.
    window.addEventListener(
        'resize',
        () => {
            mixerContext.rendererCss.setSize(
                window.innerWidth,
                window.innerHeight
            );
        },
        false
    );

    //
    // Configure mixer context and dom attachment.
    //

    // Setup rendererCss
    var rendererCss = mixerContext.rendererCss;
    // Setup rendererWebgl
    var rendererWebgl = mixerContext.rendererWebgl;

    var css3dElement = rendererCss.domElement;
    // css3dElement.style.position = 'absolute';
    // css3dElement.style.top = '0px';
    // css3dElement.style.width = '100%';
    // css3dElement.style.height = '100%';
    // document.body.appendChild(css3dElement);

    var webglCanvas = rendererWebgl.domElement;
    // webglCanvas.style.position = 'absolute';
    // webglCanvas.style.top = '0px';
    // webglCanvas.style.width = '100%';
    // webglCanvas.style.height = '100%';
    // webglCanvas.style.pointerEvents = 'none';
    // css3dElement.appendChild(webglCanvas);

    console.log('[SceneUtils] created html mixer context:', mixerContext);

    return mixerContext;
}
