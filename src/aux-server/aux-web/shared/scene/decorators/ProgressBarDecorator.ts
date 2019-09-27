import { AuxBot3DDecorator } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateNumericalTagValue,
    calculateBotValue,
    getBotShape,
    FileShape,
    FileLabelAnchor,
    clamp,
    hasValue,
} from '@casual-simulation/aux-common';
import {
    Mesh,
    MeshStandardMaterial,
    Color,
    Group,
    Vector3,
    MeshToonMaterial,
    Euler,
    Math as ThreeMath,
} from 'three';
import { isTransparent, disposeMesh, createPlane } from '../SceneUtils';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';

export class ProgressBarDecorator extends AuxBot3DDecorator
    implements IMeshDecorator {
    container: Group;
    mesh: Mesh;
    meshBackground: Mesh;

    progressValue: number;
    progressBarHeight = 0.2;
    color: any;
    bgColor: any;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    private _anchor: FileLabelAnchor = 'top';
    private _targetMeshDecorator: IMeshDecorator;

    constructor(file3D: AuxBot3D, targetMeshDecorator: IMeshDecorator) {
        super(file3D);
        this._targetMeshDecorator = targetMeshDecorator;

        this._handleTargetMeshUpdated = this._handleTargetMeshUpdated.bind(
            this
        );

        this._targetMeshDecorator.onMeshUpdated.addListener(
            this._handleTargetMeshUpdated
        );
    }

    botUpdated(calc: BotCalculationContext): void {
        let barTagValue = calculateNumericalTagValue(
            calc,
            this.file3D.bot,
            'aux.progressBar',
            null
        );

        if (barTagValue === null || barTagValue === undefined) {
            if (this.mesh) {
                this.dispose();
            }
            return;
        }

        barTagValue = clamp(barTagValue, 0, 1);

        if (this.progressValue !== barTagValue) {
            this.progressValue = barTagValue;

            if (!this.mesh) {
                this._rebuildBarMeshes();
            }

            this._updateFill();
        }

        // Flag that detected if the color values have changed.
        let colorsChanged = false;

        let colorTagValue: any;
        if (hasValue(this.file3D.bot.tags['aux.progressBar.color'])) {
            colorTagValue = calculateBotValue(
                calc,
                this.file3D.bot,
                'aux.progressBar.color'
            );

            if (this.color != colorTagValue) {
                this.color = colorTagValue;
                colorsChanged = true;
            }
        }

        let bgColorTagValue: any;
        if (hasValue(this.file3D.bot.tags['aux.progressBar.backgroundColor'])) {
            bgColorTagValue = calculateBotValue(
                calc,
                this.file3D.bot,
                'aux.progressBar.backgroundColor'
            );

            if (this.bgColor != bgColorTagValue) {
                this.bgColor = bgColorTagValue;
                colorsChanged = true;
            }
        }

        if (colorsChanged) {
            this._updateColor();
        }
    }

    frameUpdate(calc: BotCalculationContext): void {}

    dispose(): void {
        this._destroyMeshes();

        if (this.container) {
            this.file3D.display.remove(this.container);
        }
        this.container = null;

        this.progressValue = undefined;
        this.color = undefined;
        this.bgColor = undefined;
    }

    private _updateColor() {
        //
        // Progress bar color
        //
        const shapeMat = <MeshStandardMaterial | MeshToonMaterial>(
            this.mesh.material
        );
        if (this.color) {
            shapeMat.visible = !isTransparent(this.color);
            if (shapeMat.visible) {
                shapeMat.color = new Color(this.color);
            }
        } else {
            shapeMat.visible = true;
            shapeMat.color = new Color(0x000000);
        }

        //
        // Progress bar background color
        //
        const shapeMatBackground = <MeshStandardMaterial | MeshToonMaterial>(
            this.meshBackground.material
        );

        if (this.bgColor) {
            shapeMatBackground.visible = !isTransparent(this.bgColor);
            if (shapeMatBackground.visible) {
                shapeMatBackground.color = new Color(this.bgColor);
            }
        } else {
            shapeMatBackground.visible = true;
            shapeMatBackground.color = new Color(0xffffff);
        }
    }

    private _updateFill() {
        // width, height. unused depth
        this.mesh.scale.set(this.progressValue, this.progressBarHeight, 1);
        this.mesh.position.set((-1 + this.progressValue) / 2, 0, 0.001);

        this.meshBackground.scale.set(1, this.progressBarHeight, 1);
    }

    private _rebuildBarMeshes() {
        if (this.mesh) {
            this._destroyMeshes();
        }

        // Container
        this.container = new Group();

        // , , less goes right
        this.container.position.set(0, 1.2, 0);

        this.file3D.display.add(this.container);

        this.meshBackground = createPlane(1);
        this.container.add(this.meshBackground);

        // Sprite Mesh if a sprite mesh is actually a plane geometrically
        this.mesh = createPlane(1);
        this.container.add(this.mesh);

        const [pos, rotation] = this.calculateProgressAnchorPosition();

        this.container.position.copy(pos);
        this.container.rotation.copy(rotation);

        this.onMeshUpdated.invoke(this);
    }

    private _destroyMeshes(): void {
        if (this.mesh) {
            this.container.remove(this.mesh);
            disposeMesh(this.mesh);
        }
        if (this.meshBackground) {
            this.container.remove(this.meshBackground);
            disposeMesh(this.meshBackground);
        }

        this.mesh = null;
        this.meshBackground = null;
    }

    private _handleTargetMeshUpdated(meshDecorator: IMeshDecorator): void {
        this._rebuildBarMeshes();
        this._updateColor();
        this._updateFill();
    }

    private calculateProgressAnchorPosition(): [Vector3, Euler] {
        // // Position the mesh some distance above the given object's bounding box.
        let targetSize = new Vector3(1, 1, 1);
        let targetCenter = new Vector3(0, 0.5, 0);

        const positionMultiplier = 0.6;

        if (this.file3D.bot && this.file3D.bot.tags['aux.progressBar.anchor']) {
            // TODO: Support formulas
            this._anchor = <FileLabelAnchor>(
                this.file3D.bot.tags['aux.progressBar.anchor']
            );
        }

        if (this._anchor === 'floating') {
            //let posOffset = this.container.position.clone().sub(bottomCenter);
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y + targetSize.y * positionMultiplier + 0.1,
                targetCenter.z
            );

            return [pos, new Euler(0, ThreeMath.degToRad(0), 0)];
        } else if (this._anchor === 'front') {
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y,
                targetCenter.z + targetSize.z * positionMultiplier
            );

            return [pos, new Euler(ThreeMath.degToRad(0), 0, 0)];
        } else if (this._anchor === 'back') {
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y,
                targetCenter.z - targetSize.z * positionMultiplier
            );

            return [pos, new Euler(0, ThreeMath.degToRad(180), 0)];
        } else if (this._anchor === 'left') {
            let pos = new Vector3(
                targetCenter.x + targetSize.x * positionMultiplier,
                targetCenter.y,
                targetCenter.z
            );

            return [pos, new Euler(0, ThreeMath.degToRad(90), 0)];
        } else if (this._anchor === 'right') {
            let pos = new Vector3(
                targetCenter.x - targetSize.x * positionMultiplier,
                targetCenter.y,
                targetCenter.z
            );

            return [pos, new Euler(0, ThreeMath.degToRad(-90), 0)];
        } else {
            // default to top
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y + targetSize.y * positionMultiplier + 0.1,
                targetCenter.z
            );

            return [pos, new Euler(0, ThreeMath.degToRad(0), 0)];
        }
    }
}
