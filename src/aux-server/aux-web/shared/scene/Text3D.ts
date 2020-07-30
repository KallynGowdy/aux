import {
    MathUtils as ThreeMath,
    Mesh,
    Object3D,
    DoubleSide,
    Color,
    TextureLoader,
    Texture,
    Vector3,
    Box3,
    RawShaderMaterial,
    LinearFilter,
    Euler,
    Matrix4,
    Quaternion,
} from 'three';

import {
    BotLabelAnchor,
    BotLabelAlignment,
} from '@casual-simulation/aux-common';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';
import { Text as TextMesh } from 'troika-three-text';
import Roboto from '../public/fonts/Roboto/roboto-v18-latin-regular.woff';

export interface Text3DFont {
    /**
     * The path to the json data for the font.
     */
    dataPath: string;

    /**
     * The path the to texture for the font.
     */
    texturePath: string;
}

export class Text3D extends Object3D {
    // Map of loaded font textures.
    public static FontTextures: {
        [texturePath: string]: Texture;
    } = {};

    public static readonly extraSpace: number = 0.001;
    public static readonly floatingExtraSpace: number = 0.4;

    /**
     * Number chosen by expirementation to place 5-6 characters on a bot.
     */
    public static readonly defaultFontSize: number = 0.325;
    public static readonly defaultWidth: number = Text3D.defaultFontSize * 6;

    public static readonly defaultScale: number = 1;

    public currentWidth: number = 200;

    // The TextMesh that this object wraps.
    private _mesh: TextMesh;

    // the text that was last set on this text3d.
    private _unprocessedText: string;

    // The bounding box for the text 3d in world space.
    private _boundingBox: Box3;

    // The anchor position for the text 3d.
    private _anchor: BotLabelAnchor = 'top';

    private _renderedThisFrame: boolean = false;

    // The anchor position for the text 3d.

    /**
     * Gets whether this Text3D has been rendered since the last time this property was checked.
     */
    renderedThisFrame() {
        const rendered = this._renderedThisFrame;
        this._renderedThisFrame = false;
        return rendered;
    }

    /**
     * the text that was last set on this text3d.
     */
    get unprocessedText(): string {
        return this._unprocessedText;
    }

    /**
     * The bounding box of this text 3d. This bounding box is in world space.
     */
    get boundingBox(): Box3 {
        return this._boundingBox && this.visible
            ? this._boundingBox.clone()
            : new Box3();
    }

    /**
     * Create text 3d.
     * @param font what font to use for the text3d.
     */
    constructor(width?: number) {
        super();

        if (width === undefined || width < Text3D.defaultWidth) {
            width = Text3D.defaultWidth;
        }

        this.currentWidth = width;

        this._mesh = new TextMesh();

        this._mesh.text = '';
        this._mesh.textAlign = 'center';
        this._mesh.font = Roboto;
        this._mesh.fontSize = 0.325;
        this._mesh.maxWidth = width;
        this._mesh.anchorX = 'center';
        this._mesh.anchorY = 'middle';

        this.add(this._mesh);
        this.setScale(Text3D.defaultScale);

        this._mesh.position.set(0, 0, 0);

        this.updateBoundingBox();
    }

    /**
     * Sets the position of the text based on the size of the given bounding box.
     * @param obj The object that this text's position should be set for.
     * @param offset An arbitrary offset to apply to the text.
     */
    public setPositionForObject(obj: Object3D, objCenter: Vector3 = null) {
        this.updateBoundingBox();

        const tempPos = new Vector3();
        const tempRot = new Quaternion();
        const worldScale = new Vector3();
        obj.matrixWorld.decompose(tempPos, tempRot, worldScale);

        const center = objCenter ? obj.worldToLocal(objCenter.clone()) : null;
        if (center) {
            center.multiply(worldScale);
        }

        const [pos, rotation, anchor] = this._calculateAnchorPosition(
            worldScale,
            center
        );

        const worldPos = pos.clone();
        this.parent.localToWorld(worldPos);

        this.position.copy(pos);
        let changed = this._mesh.anchorX !== anchor;
        this._mesh.anchorX = anchor;
        this._mesh.rotation.copy(new Euler(rotation.x, rotation.y, rotation.z));

        if (changed) {
            this._mesh.sync(() => this._onSync());
        } else {
            this.updateBoundingBox();
        }
    }

    public setWorldPosition(worldPos: Vector3) {
        if (!worldPos) return;

        let myMin = this._boundingBox.min.clone();
        let myMax = this._boundingBox.max.clone();

        let bottomCenter = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = this.position.clone().sub(bottomCenter);

        this.position.set(worldPos.x, worldPos.y, worldPos.z);
        this.position.add(posOffset);

        this.updateBoundingBox();
    }

    /**
     * Update the bounding box for this text 3d.
     * This is normally run automatically after updating attributes of the text 3d.
     */
    public updateBoundingBox(): void {
        this.updateMatrixWorld(true);
        this._mesh.geometry.computeBoundingSphere();
        let box = new Box3();
        this._mesh.geometry.boundingSphere.getBoundingBox(box);
        // box.min.z = -1;
        // box.max.z = 1;

        // Apply the matrix to the bounding box.
        let matrix = this._mesh.matrixWorld;
        box.applyMatrix4(matrix);

        if (!this._boundingBox) {
            this._boundingBox = new Box3();
        }
        this._boundingBox.copy(box);
    }

    /**
     * Set the text to display with this 3d text.
     * @param text the text to display.
     * @param alignment The alignment to set.
     */
    public setText(text: string, alignment?: BotLabelAlignment) {
        // Ignore if the text is already set to provided value.
        if (
            this._unprocessedText === text &&
            this._mesh.textAlign === alignment
        )
            return;

        this._unprocessedText = text;

        if (text) {
            if (text.toString().includes('guest_')) {
                text = 'Guest';
            }

            // Text has value, enable the mesh and update the geometry.
            this.visible = true;
            this._mesh.text = text;
            this._mesh.textAlign = alignment;
            this._mesh.sync(() => this._onSync());
            this.updateBoundingBox();
        } else {
            // Disable the text's rendering.
            this.visible = false;
        }
    }

    /**
     * Set the text's color.
     * @param color The color value either in string or THREE.Color.
     */
    public setColor(color: Color) {
        this._mesh.color = color;
    }

    /**
     * Sets the text's font.
     * @param fontUrl The URL to the font file that should be used. Supports .otf and .woff.
     */
    public setFont(fontUrl: string) {
        this._mesh.font = fontUrl;
        this._mesh.sync(() => this._onSync());
    }

    /**
     * Set the scale of the text.
     * @param scale The scale of the text mesh. (default is 0.004)
     */
    public setScale(scale: number) {
        if (this.scale.x !== scale) {
            this.scale.setScalar(scale);
            this.updateBoundingBox();
        }
    }

    public setRotation(x?: number, y?: number, z?: number) {
        let nextRotation = new Euler().copy(this.rotation);
        if (!(x === null || typeof x === 'undefined')) {
            nextRotation.x = x * (Math.PI / 180);
        }
        if (!(y === null || typeof y === 'undefined')) {
            nextRotation.y = y * (Math.PI / 180);
        }
        if (!(z === null || typeof z === 'undefined')) {
            nextRotation.z = z * (Math.PI / 180);
        }

        this.rotation.copy(nextRotation);
        this.updateBoundingBox();
    }

    /**
     * Sets the anchor position that this text should use.
     * Requires updating the position by calling setPositionForBounds after changing the anchor.
     * @param anchor The anchor.
     */
    public setAnchor(anchor: BotLabelAnchor) {
        this._anchor = anchor;

        if (anchor === 'floating') {
            this._mesh.anchorY = 'bottom';
        } else {
            this._mesh.anchorY = 'middle';
        }

        this._mesh.sync(() => this._onSync());
    }

    public dispose(): void {
        this._mesh.dispose();
        this._mesh = null;
    }

    private _onSync() {
        if (!this._mesh) {
            return;
        }
        this.updateBoundingBox();
        this._renderedThisFrame = true;
    }

    private _calculateAnchorPosition(
        scale: Vector3,
        objCenter: Vector3
    ): [Vector3, Euler, 'left' | 'right' | 'center'] {
        // // Position the mesh some distance above the given object's bounding box.
        let targetSize = scale;
        let targetCenter = objCenter
            ? objCenter
            : new Vector3(0, targetSize.y * 0.5, 0);

        const positionMultiplier = 0.5;

        if (this._anchor === 'floating') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                1,
                new Vector3(
                    0,
                    targetCenter.y +
                        targetSize.y * positionMultiplier +
                        Text3D.floatingExtraSpace,
                    targetCenter.z
                )
            );

            return [pos, new Euler(0, ThreeMath.degToRad(0), 0), anchor];
        } else if (this._anchor === 'front') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                1,
                new Vector3(
                    0,
                    targetCenter.y,
                    targetCenter.z +
                        targetSize.z * positionMultiplier +
                        Text3D.extraSpace
                )
            );

            return [pos, new Euler(ThreeMath.degToRad(0), 0, 0), anchor];
        } else if (this._anchor === 'back') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                -1,
                new Vector3(
                    0,
                    targetCenter.y,
                    targetCenter.z -
                        targetSize.z * positionMultiplier -
                        Text3D.extraSpace
                )
            );

            return [pos, new Euler(0, ThreeMath.degToRad(180), 0), anchor];
        } else if (this._anchor === 'left') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'z',
                this._mesh.textAlign,
                -1,
                new Vector3(
                    targetCenter.x +
                        targetSize.x * positionMultiplier +
                        Text3D.extraSpace,
                    targetCenter.y,
                    0
                )
            );

            return [pos, new Euler(0, ThreeMath.degToRad(90), 0), anchor];
        } else if (this._anchor === 'right') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'z',
                this._mesh.textAlign,
                1,
                new Vector3(
                    targetCenter.x -
                        targetSize.x * positionMultiplier -
                        Text3D.extraSpace,
                    targetCenter.y,
                    0
                )
            );
            return [pos, new Euler(0, ThreeMath.degToRad(-90), 0), anchor];
        } else {
            // default to top
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                1,
                new Vector3(
                    0,
                    targetCenter.y +
                        targetSize.y * positionMultiplier +
                        Text3D.extraSpace,
                    targetCenter.z
                )
            );

            return [
                pos,
                new Euler(ThreeMath.degToRad(-90), ThreeMath.degToRad(0), 0),
                anchor,
            ];
        }
    }

    private _positionOffset(
        center: Vector3,
        size: Vector3,
        alignAxis: 'x' | 'y' | 'z',
        align: 'left' | 'right' | 'center' | 'justify',
        alignMultiplier: number,
        offset: Vector3
    ) {
        const half = 0.5;
        let final = offset.clone();
        let alignOffset = new Vector3(
            alignAxis === 'x'
                ? align === 'left'
                    ? center.x - size.x * half
                    : align === 'right'
                    ? center.x + size.x * half
                    : center.x
                : 0,
            alignAxis === 'y'
                ? align === 'left'
                    ? center.y - size.y * half
                    : align === 'right'
                    ? center.y + size.y * half
                    : center.y
                : 0,
            alignAxis === 'z'
                ? align === 'left'
                    ? center.z - size.z * half
                    : align === 'right'
                    ? center.z + size.z * half
                    : center.z
                : 0
        );
        alignOffset.multiplyScalar(alignMultiplier);
        let anchor: 'left' | 'right' | 'center';
        if (align === 'left') {
            anchor = 'left';
        } else if (align === 'right') {
            anchor = 'right';
        } else {
            anchor = 'center';
        }

        final.add(alignOffset);
        return [final, anchor] as const;
    }
}
