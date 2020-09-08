import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    calculateNumericalTagValue,
    BotCalculationContext,
    Bot,
    calculateGridScale,
    objectsAtDimensionGridPosition,
    getBotPosition,
    getBotRotation,
    getDimensionScale,
    getDimensionGridHeight,
    cacheFunction,
    calculateBooleanTagValue,
    isBotStackable,
    getBotOrientationMode,
    getBotAnchorPoint,
    BotAnchorPoint,
    BotOrientationMode,
    getBotIndex,
    getBotScale,
    getAnchorPointOffset,
    LocalActions,
    RemoteCausalRepoPartitionImpl,
    Easing,
    EaseMode,
    hasValue,
} from '@casual-simulation/aux-common';
import {
    Vector3,
    Quaternion,
    Euler,
    Vector2,
    Object3D,
    MathUtils as ThreeMath,
    Matrix4,
} from 'three';
import { calculateGridTileLocalCenter } from '../grid/Grid';
import { realPosToGridPos, Axial, posToKey } from '../hex';
import { BuilderGroup3D } from '../BuilderGroup3D';
import { calculateScale, objectForwardRay } from '../SceneUtils';
import { Game } from '../Game';
import TWEEN, { Tween } from '@tweenjs/tween.js';

/**
 * Defines an interface that contains possible options for DimensionPositionDecorator objects.
 */
export interface DimensionPositionDecoratorOptions {
    /**
     * Whether to linear interpolate between positions.
     */
    lerp?: boolean;
}

/**
 * Defines a AuxBot3D decorator that moves the bot to its position inside a dimension.
 */
export class DimensionPositionDecorator extends AuxBot3DDecoratorBase {
    private _lerp: boolean;
    private _atPosition: boolean;
    private _atRotation: boolean;
    private _lastPos: { x: number; y: number; z: number };
    private _lastSortOrder: number;
    private _nextPos: Vector3;
    private _nextRot: { x: number; y: number; z: number };
    private _lastHeight: number;
    private _orientationMode: BotOrientationMode;
    private _rotationObj: Object3D;
    private _game: Game;
    private _tween: any;

    constructor(
        bot3D: AuxBot3D,
        game: Game,
        options: DimensionPositionDecoratorOptions = {}
    ) {
        super(bot3D);
        this._game = game;
        this._lerp = !!options.lerp;
    }

    botUpdated(calc: BotCalculationContext): void {
        if (!!this._tween) {
            return;
        }
        const nextOrientationMode = getBotOrientationMode(calc, this.bot3D.bot);
        const anchorPointOffset = getAnchorPointOffset(calc, this.bot3D.bot);
        const gridScale = this.bot3D.gridScale;

        this._orientationMode = nextOrientationMode;
        this._rotationObj = this.bot3D.container;

        // Update the offset for the display container
        // so that it rotates around the specified
        // point
        this.bot3D.display.position.set(
            anchorPointOffset.x,
            anchorPointOffset.z,
            anchorPointOffset.y
        );

        const userDimension = this.bot3D.dimension;
        if (userDimension) {
            const currentGridPos = getBotPosition(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension
            );
            const currentHeight = calculateVerticalHeight(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension,
                gridScale
            );
            const currentSortOrder = getBotIndex(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension
            );
            this._nextPos = calculateObjectPositionInGrid(
                calc,
                this.bot3D,
                gridScale
            );

            if (
                this._positionUpdated(currentGridPos, currentSortOrder) ||
                this._heightUpdated(currentHeight)
            ) {
                let ids = [] as string[];
                if (this._lastPos) {
                    const objectsAtLastPosition = objectsAtDimensionGridPosition(
                        calc,
                        this.bot3D.dimension,
                        this._lastPos
                    );
                    ids.push(...objectsAtLastPosition.map(b => b.id));
                }
                if (currentGridPos) {
                    const objectsAtCurrentPosition = objectsAtDimensionGridPosition(
                        calc,
                        this.bot3D.dimension,
                        currentGridPos
                    );
                    ids.push(...objectsAtCurrentPosition.map(b => b.id));
                }

                this.bot3D.dimensionGroup.simulation3D.ensureUpdate(ids);
            }
            this._lastPos = currentGridPos;
            this._lastSortOrder = currentSortOrder;
            this._lastHeight = currentHeight;
            this._nextRot = getBotRotation(
                calc,
                this.bot3D.bot,
                this.bot3D.dimension
            );

            this._atPosition = false;
            this._atRotation = false;
            if (!this._lerp) {
                this.bot3D.position.copy(this._nextPos);

                if (this._orientationMode === 'absolute') {
                    this._rotationObj.rotation.set(
                        this._nextRot.x,
                        this._nextRot.z,
                        this._nextRot.y
                    );
                }
            }
        }
    }

    botRemoved(calc: BotCalculationContext): void {
        if (this._lastPos) {
            const objectsAtPosition = objectsAtDimensionGridPosition(
                calc,
                this.bot3D.dimension,
                this._lastPos
            );
            this.bot3D.dimensionGroup.simulation3D.ensureUpdate(
                objectsAtPosition.map(f => f.id)
            );
        }
    }

    private _heightUpdated(currentHeight: number): boolean {
        return Math.abs(this._lastHeight - currentHeight) > 0.01;
    }

    private _positionUpdated(
        currentGridPos: {
            x: number;
            y: number;
            z: number;
        },
        currentSortOrder: number
    ): boolean {
        return (
            !this._lastPos ||
            (currentGridPos.x !== this._lastPos.x ||
                currentGridPos.y !== this._lastPos.y ||
                currentGridPos.z !== this._lastPos.z) ||
            this._lastSortOrder !== currentSortOrder
        );
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._lerp && this._nextPos && this._nextRot) {
            if (!this._atPosition) {
                this.bot3D.position.lerp(this._nextPos, 0.1);
                const distance = this.bot3D.position.distanceTo(this._nextPos);
                this._atPosition = distance < 0.01;
            }

            if (!this._atRotation) {
                const euler = new Euler(
                    this._nextRot.x,
                    this._nextRot.z,
                    this._nextRot.y,
                    'XYZ'
                );
                const q = new Quaternion().setFromEuler(euler);
                this._rotationObj.quaternion.slerp(q, 0.1);

                const angle = this._rotationObj.quaternion.angleTo(q);
                this._atRotation = angle < 0.1;
            }

            if (!this._atPosition || !this._atRotation) {
                this.bot3D.updateMatrixWorld(true);
            }
        } else {
            let update = false;
            if (
                ['billboard', 'billboardTop', 'billboardFront'].indexOf(
                    this._orientationMode
                ) >= 0
            ) {
                const cameraRig = this.bot3D.dimensionGroup.simulation3D.getMainCameraRig();
                const cameraWorld = new Vector3();
                cameraWorld.setFromMatrixPosition(
                    cameraRig.mainCamera.matrixWorld
                );

                if (this._game && !!this._game.xrSession) {
                    this._rotationObj.up = new Vector3(0, 1, 0);
                } else {
                    const cameraRotation = new Quaternion().setFromRotationMatrix(
                        cameraRig.mainCamera.matrixWorld
                    );
                    const cameraUp = new Vector3(0, 1, 0);
                    cameraUp.applyQuaternion(cameraRotation);

                    this._rotationObj.up = cameraUp;
                }

                this._rotationObj.lookAt(cameraWorld);

                if (this._orientationMode !== 'billboardFront') {
                    // Rotate the object 90 degrees around its X axis
                    // so that the top of the bot is facing the camera.
                    const rotationOffset = new Quaternion().setFromAxisAngle(
                        new Vector3(1, 0, 0),
                        ThreeMath.degToRad(90)
                    );
                    this._rotationObj.quaternion.multiply(rotationOffset);
                }

                update = true;
                if (this._orientationMode === 'billboardTop') {
                    const euler = new Euler().setFromQuaternion(
                        this._rotationObj.quaternion,
                        'YXZ'
                    );
                    euler.x = ThreeMath.degToRad(90);
                    euler.z = 0;
                    this._rotationObj.setRotationFromEuler(euler);
                } else if (this._orientationMode === 'billboardFront') {
                    const euler = new Euler().setFromQuaternion(
                        this._rotationObj.quaternion,
                        'YXZ'
                    );
                    euler.x = 0;
                    euler.z = 0;
                    this._rotationObj.setRotationFromEuler(euler);
                }
            }

            if (update) {
                this.bot3D.updateMatrixWorld(true);
            }
        }
    }

    localEvent(event: LocalActions, calc: BotCalculationContext) {
        if (event.type === 'local_tween') {
            const currentTime = this._game.getTime().timeSinceStart * 1000;
            if (event.tweenType === 'position') {
                const gridScale = this.bot3D.gridScale;
                let targetPosition = {} as any;
                if (hasValue(event.position.x)) {
                    targetPosition.x = event.position.x * gridScale;
                }
                if (hasValue(event.position.y)) {
                    targetPosition.z = event.position.y * -gridScale;
                }
                if (hasValue(event.position.z)) {
                    targetPosition.y = event.position.z * gridScale;
                }
                const easing = getEasing(event.easing);
                this._tween = new TWEEN.Tween<any>(this.bot3D.position)
                    .to(<any>targetPosition)
                    .easing(easing)
                    .duration(event.duration * 1000)
                    .onUpdate(() => this.bot3D.updateMatrixWorld())
                    .onComplete(() => (this._tween = null))
                    .start(currentTime);
            } else if (event.tweenType === 'rotation') {
                let targetRotation = {} as any;
                if (hasValue(event.rotation.x)) {
                    targetRotation.x = event.rotation.x;
                }
                if (hasValue(event.rotation.y)) {
                    targetRotation.z = event.rotation.y;
                }
                if (hasValue(event.rotation.z)) {
                    targetRotation.y = event.rotation.z;
                }
                const easing = getEasing(event.easing);
                this._tween = new TWEEN.Tween<any>(
                    this.bot3D.container.rotation
                )
                    .to(<any>targetRotation)
                    .easing(easing)
                    .duration(event.duration * 1000)
                    .onUpdate(() => this.bot3D.updateMatrixWorld())
                    .onComplete(() => (this._tween = null))
                    .start(currentTime);
            }
        }
    }

    dispose(): void {}
}

function getEasing(easing: Easing): any {
    switch (easing.type) {
        case 'linear':
        default:
            return TWEEN.Easing.Linear.None;
        case 'circular':
            return resolveEaseType(easing.mode, TWEEN.Easing.Circular);
        case 'cubic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Cubic);
        case 'exponential':
            return resolveEaseType(easing.mode, TWEEN.Easing.Exponential);
        case 'elastic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Elastic);
        case 'quadratic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quadratic);
        case 'quartic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quartic);
        case 'quintic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quintic);
        case 'sinusoidal':
            return resolveEaseType(easing.mode, TWEEN.Easing.Sinusoidal);
    }
}

function resolveEaseType(
    mode: EaseMode,
    val: (typeof TWEEN.Easing.Circular) | typeof TWEEN.Easing.Linear
): any {
    if ('None' in val) {
        return val.None;
    } else {
        switch (mode) {
            case 'in':
                return val.In;
            case 'out':
                return val.Out;
            case 'inout':
            default:
                return val.InOut;
        }
    }
}

/**
 * Calculates the position of the given bot.
 * @param context The bot calculation context to use to calculate forumula values.
 * @param bot The bot to calculate position for.
 * @param gridScale The scale of the grid.
 */
export function calculateObjectPositionInGrid(
    context: BotCalculationContext,
    bot: AuxBot3D,
    gridScale: number
): Vector3 {
    let position = getBotPosition(context, bot.bot, bot.dimension);
    let localPosition = calculateGridTileLocalCenter(
        position.x,
        position.y,
        position.z,
        gridScale
    );

    let totalScales = 0;

    if (!isBotStackable(context, bot.bot)) {
        totalScales = 0;
    } else {
        const objectsAtPosition = objectsAtDimensionGridPosition(
            context,
            bot.dimension,
            position
        );

        // Offset local position using index of bot.
        for (let obj of objectsAtPosition) {
            if (obj.id === bot.bot.id) {
                break;
            }

            if (isBotStackable(context, obj)) {
                totalScales += calculateVerticalHeight(
                    context,
                    obj,
                    bot.dimension,
                    gridScale
                );
            }
        }
    }

    const indexOffset = new Vector3(0, totalScales, 0);

    localPosition.add(indexOffset);

    if (bot.dimensionGroup instanceof BuilderGroup3D) {
        // Offset local position with hex grid height.
        let hexScale = getDimensionScale(context, bot.dimensionGroup.bot);
        let axial = realPosToGridPos(
            new Vector2(localPosition.x, localPosition.z),
            hexScale
        );
        let key = posToKey(axial);
        let height = getDimensionGridHeight(
            context,
            bot.dimensionGroup.bot,
            '0:0'
        );
        localPosition.add(new Vector3(0, height, 0));
    }

    return localPosition;
}

/**
 * Calculates the total vertical height of the given bot.
 * @param calc The calculation context to use.
 * @param bot The bot to use.
 * @param dimension The dimension that the bot's height should be evalulated in.
 * @param gridScale The scale of the grid.
 */
export function calculateVerticalHeight(
    calc: BotCalculationContext,
    bot: Bot,
    dimension: string,
    gridScale: number
) {
    return cacheFunction(
        calc,
        'calculateVerticalHeight',
        () => {
            const height = calculateScale(calc, bot, gridScale).y;
            const offset = calculateNumericalTagValue(
                calc,
                bot,
                `${dimension}Z`,
                0
            );

            return height + offset * gridScale;
        },
        bot.id,
        dimension,
        gridScale
    );
}
