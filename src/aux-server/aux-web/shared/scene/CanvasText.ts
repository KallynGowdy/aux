import {
    Texture,
    CanvasTexture,
    Mesh,
    Geometry,
    Material,
    MeshBasicMaterial,
    PlaneBufferGeometry,
} from 'three';

/**
 * A class that is able to render some text using a canvas.
 * Designed to be
 */
export class CanvasText {
    /**
     * The texture that this text renders to.
     */
    texture: Texture;
    geometry: PlaneBufferGeometry;
    mesh: Mesh;
    material: Material;

    width: number = 100;
    height: number = 100;

    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', {
            // alpha: true
        });
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this._updateContext();

        // this.texture = new CanvasTexture(this.canvas);
        this.material = new MeshBasicMaterial({
            // map: this.texture
        });
        this.geometry = new PlaneBufferGeometry();
        this.mesh = new Mesh(this.geometry, this.material);
    }

    /**
     * Renders the given text to the texture represented by this canvas.
     * @param text The text.
     */
    setText(text: string): void {
        const metrics = this.ctx.measureText(text);

        // The actual width can be different than the metrics.width property
        // due to italics or overhanging.
        this.width =
            Math.abs(metrics.actualBoundingBoxLeft) +
            Math.abs(metrics.actualBoundingBoxRight);

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        // Must update the context because changing
        // the width/height will reset it.
        this._updateContext();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillText(text, 0, 0);

        this.geometry = new PlaneBufferGeometry(this.width, this.height);
        this.mesh.geometry = this.geometry;

        // this.texture.needsUpdate = true;
    }

    private _updateContext() {
        this.ctx.font = 'normal 24px sans-serif';
        this.ctx.textBaseline = 'top';
        this.ctx.fillStyle = 'black';
    }
}
