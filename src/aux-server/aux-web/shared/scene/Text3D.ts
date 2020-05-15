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
} from 'three';

import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import createBMFont, {
    TextGeometry,
    TextGeometryOptions,
} from 'three-bmfont-text';
import { calculateAnchorPosition, buildSRGBColor } from './SceneUtils';
import {
    BotLabelAnchor,
    BotLabelAlignment,
} from '@casual-simulation/aux-common';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';
import merge from 'lodash/merge';
import { TinySDF } from '../public/tiny-sdf';

var sdfShader = require('three-bmfont-text/shaders/sdf');

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

    public static readonly defaultWidth: number = 200;
    public static readonly extraSpace: number = 0.001;
    public static readonly floatingExtraSpace: number = 0.3;
    public static readonly defaultScale: number = 0.01;

    public currentWidth: number = 200;

    // The text geometry created with 'three-bmfont-text'
    // To change text, run textGeometry.update and include the proper options.
    private _geometry: TextGeometry;

    // The text mesh that is holding onto the text geometry that gets rendered by three.
    private _mesh: Mesh;

    // the text that was last set on this text3d.
    private _unprocessedText: string;

    // The bounding box for the text 3d in world space.
    private _boundingBox: Box3;

    // The anchor position for the text 3d.
    private _anchor: BotLabelAnchor = 'top';

    // The anchor position for the text 3d.

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
    constructor(width?: number, font?: Text3DFont) {
        super();

        if (!font)
            font = { dataPath: robotoFont, texturePath: robotoTexturePath };

        if (!Text3D.FontTextures[font.texturePath]) {
            // Load font texture and store it for other 3d texts to use.
            Text3D.FontTextures[font.texturePath] = new TextureLoader().load(
                font.texturePath
            );
        }

        var texture = Text3D.FontTextures[font.texturePath];

        // Modify filtering of texture for optimal SDF rendering.
        // This effectively disables the use of any mip maps, allowing the SDF shader to continue
        // to draw the text when view from a long distance. Otherwise, the SDF shader tends to 'fizzle'
        // out when the text is viewed from long distances.
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;

        if (width === undefined || width < Text3D.defaultWidth) {
            width = Text3D.defaultWidth;
        }

        this.currentWidth = width;

        this._geometry = createBMFont({
            font: font.dataPath,
            text: '',
            flipY: true,
            align: 'center',
            width: width,
        });

        var material = new RawShaderMaterial(
            sdfShader({
                map: texture,
                side: DoubleSide,
                transparent: true,
                // depthTest: false,
                // depthWrite: false,
                color: buildSRGBColor(0, 0, 0),
            })
        );

        this._mesh = new Mesh(this._geometry, material);
        this.add(this._mesh);
        this.setScale(Text3D.defaultScale);

        // Rotate the text mesh so that it is upright when rendered.
        this._mesh.rotateX(ThreeMath.degToRad(180));
        this._mesh.position.set(0, 0, 0);

        this.updateBoundingBox();
    }

    /**
     * Sets the position of the text based on the size of the given bounding box.
     */
    public setPositionForBounds(bounds: Box3) {
        if (!bounds || bounds.isEmpty()) {
            return;
        }

        this.updateBoundingBox();

        const thisLocalBounds = this._boundingBox.clone();
        const worldToLocal = new Matrix4();
        worldToLocal.getInverse(this.parent.matrixWorld);
        thisLocalBounds.applyMatrix4(worldToLocal);

        const targetLocalBounds = bounds.clone();
        targetLocalBounds.applyMatrix4(worldToLocal);

        const [pos, rotation] = calculateAnchorPosition(
            targetLocalBounds,
            this._anchor,
            this,
            thisLocalBounds,
            Text3D.defaultScale,
            this._anchor === 'floating'
                ? Text3D.floatingExtraSpace
                : Text3D.extraSpace
        );

        const worldPos = pos.clone();
        this.parent.localToWorld(worldPos);

        this.position.copy(pos);
        this._mesh.rotation.copy(
            new Euler(
                rotation.x + ThreeMath.degToRad(90),
                rotation.y,
                rotation.z
            )
        );

        this.updateBoundingBox();
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
        this._geometry.computeBoundingBox();
        let box = this._geometry.boundingBox.clone();
        box.min.z = -1;
        box.max.z = 1;

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
        if (this._unprocessedText === text) return;

        this._unprocessedText = text;

        if (text) {
            if (text.toString().includes('guest_')) {
                text = 'Guest';
            }

            // Text has value, enable the mesh and update the geometry.
            this.visible = true;
            this._geometry.update(<any>(<Partial<TextGeometryOptions>>{
                text: text.toString(),
                align: alignment || 'center',
            }));
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
        var material = <RawShaderMaterial>this._mesh.material;
        material.uniforms.color.value = color;
    }

    /**
     * Set the options for the text geometry used by this text 3d.
     * @param opt The options to set on the text geometry.
     */
    public setOptions(opt: TextGeometryOptions) {
        this._geometry.update(opt);
        this._unprocessedText = opt.text;

        if (opt.text) {
            // Text has value, enable the mesh.
            this.visible = true;
            this.updateBoundingBox();
        } else {
            // Disable the text's rendering.
            this.visible = false;
        }
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
    }

    public dispose(): void {}
}

/**
 * An interface that holds information about a font in the BM font format.
 *
 * See:
 * https://github.com/Jam3/load-bmfont/blob/master/json-spec.md
 * http://www.angelcode.com/products/bmfont/doc/file_format.html
 */
export interface BMFontGlyphData {
    pages: string[];
    chars: BMFontGlyph[];
    info: BMFontInfo;
    common: BMFontCommon;
}

/**
 * Describes one character in the font.
 */
export interface BMFontGlyph {
    /**
     * The ID of the character.
     */
    id: number;

    /**
     * The left position of the character in the texture page.
     */
    x: number;

    /**
     * The top position of the character in the texture page.
     */
    y: number;

    /**
     * The width of the character in the texture.
     */
    width: number;

    /**
     * The height of the character in the texture.
     */
    height: number;

    /**
     * How much the current position should be offset when copying the image from the texture to the screen.
     */
    xoffset: number;

    /**
     * How much the current position should be offset when copying the image from the texture to the screen.
     */
    yoffset: number;

    /**
     * How much the current position should be advanced after drawing the character.
     */
    xadvance: number;

    /**
     * The texture page where the character image is found.
     */
    page: number;

    /**
     * The texture channel where the character image is found. (1 = blue, 2 = gree, 4 = red, 8 = alpha, 15 = all channels)
     */
    chnl: number;
}

/**
 * Holds information about a
 */
export interface BMFontInfo {
    /**
     * The name of the font.
     */
    face: string;

    /**
     * The size of the font.
     */
    size: number;

    /**
     * Whether the font is bold.
     */
    bold: number;

    /**
     * Whether the font is italic.
     */
    italic: number;

    /**
     * The OEM charset used (when not Unicode).
     */
    charset: string;

    /**
     * Whether the font is unicode.
     */
    unicode: number;

    /**
     * The font height stretch in percentage. 100 means no stretch.
     */
    stretchH: number;

    /**
     * Whether font smothing was turned on.
     */
    smooth: number;

    /**
     * The supersampling level used. 1 means no supersampling.
     */
    aa: number;

    /**
     * The padding for each character. (up, right, down, left)
     */
    padding: [number, number, number, number];

    /**
     * The outline thickness for the characters. (up/down, left/right)
     */
    spacing: [number, number];
}

/**
 * Holds information common to all characters.
 */
export interface BMFontCommon {
    /**
     * The distance in pixels between each line of text.
     */
    lineHeight: number;

    /**
     * The number of pixels from the absolute top of the line to the base of the characters.
     */
    base: number;

    /**
     * The width of the texture, normally used to scale the X position of the character image.
     */
    scaleW: number;

    /**
     * The height of the texture, normally used to scale the Y position of the character image.
     */
    scaleH: number;

    /**
     * The number of texture pages included in the font.
     */
    pages: number;

    /**
     * Set to 1 if the monochrome characters have been packed into each of the texture channels.
     */
    packed: number;
}

if (typeof window !== 'undefined') {
    let tinysdf = new TinySDF();
    let canvas: HTMLCanvasElement = null;
    let ctx: CanvasRenderingContext2D = null;
    let x = 0;
    let y = 0;
    let bufferSize = 2048;
    merge(window, {
        aux: {
            sdf: {
                configure,
                draw,
                exit,
            },
        },
    });

    function configure(opts: {
        fontSize: number;
        buffer: number;
        radius: number;
        cutoff: number;
        fontFamily: string;
        fontWeight: string;
    }) {
        tinysdf = new TinySDF(
            opts.fontSize,
            opts.buffer,
            opts.radius,
            opts.cutoff,
            opts.fontFamily,
            opts.fontWeight
        );
        exit();
    }

    function draw(text: string) {
        init();

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const output = tinysdf.draw(char);

            let imageData = ctx.createImageData(tinysdf.size, tinysdf.size);
            let data = imageData.data;
            for (var b = 0; b < output.length; b++) {
                data[4 * b + 0] = output[b];
                data[4 * b + 1] = output[b];
                data[4 * b + 2] = output[b];
                data[4 * b + 3] = output[b];
            }

            ctx.putImageData(imageData, x, y);
            if (x + tinysdf.size > bufferSize) {
                y += tinysdf.size;
                x = 0;
            } else {
                x += tinysdf.size;
            }
        }
    }

    function exit() {
        if (!canvas) {
            return;
        }

        canvas.parentNode.removeChild(canvas);
        canvas = null;
        ctx = null;
        x = 0;
        y = 0;
    }

    function init() {
        if (canvas) {
            return;
        }

        canvas = document.createElement('canvas');
        canvas.width = canvas.height = 2048;
        canvas.style.position = 'absolute';
        canvas.style.zIndex = '10000';
        canvas.style.backgroundColor = 'rgba(0,0,0,.35)';
        document.body.insertBefore(canvas, document.body.firstChild);

        ctx = canvas.getContext('2d');

        return canvas;
    }
}
