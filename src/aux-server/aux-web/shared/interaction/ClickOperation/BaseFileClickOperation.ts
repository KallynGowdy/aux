import { Input, InputType, MouseButtonId } from '../../../shared/scene/Input';
import { Vector2, Vector3, Intersection } from 'three';
import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import {
    UserMode,
    File,
    FileCalculationContext,
    AuxFile,
    isFileMovable,
    getFileDragMode,
} from '@casual-simulation/aux-common';
import { BaseFileDragOperation } from '../DragOperation/BaseFileDragOperation';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { IGameView } from '../../../shared/IGameView';
import { Simulation3D } from '../../scene/Simulation3D';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export abstract class BaseFileClickOperation implements IOperation {
    public static readonly DragThreshold: number = 0.03;

    protected _simulation3D: Simulation3D;
    protected _interaction: BaseInteractionManager;
    protected _file: File;
    protected _file3D: AuxFile3D | ContextGroup3D | null;
    protected _finished: boolean;
    protected _triedDragging: boolean;

    protected _startScreenPos: Vector2;
    protected _dragOperation: BaseFileDragOperation;

    protected heldTime: number;
    protected isMobile: boolean;

    protected get gameView() {
        return this._simulation3D.gameView;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    constructor(
        simulation: Simulation3D,
        interaction: BaseInteractionManager,
        file: File,
        file3D: AuxFile3D | ContextGroup3D | null
    ) {
        this._simulation3D = simulation;
        this._interaction = interaction;
        this._file = file;
        this._file3D = file3D;

        // Store the screen position of the input when the click occured.
        this._startScreenPos = this.gameView.getInput().getMouseScreenPos();

        this.isMobile = this.gameView.getInput().getTouchCount() > 0;
        this.heldTime = 0;
    }

    public async update(): Promise<void> {
        if (this._finished) return;

        // Update drag operation if one is active.
        if (this._dragOperation) {
            if (this._dragOperation.isFinished()) {
                this._dragOperation.dispose();
                this._dragOperation = null;
            } else {
                await this._dragOperation.update();
            }
        }

        // If using touch, need to make sure we are only ever using one finger at a time.
        // If a second finger is detected then we cancel this click operation.
        if (this.gameView.getInput().currentInputType === InputType.Touch) {
            if (this.gameView.getInput().getTouchCount() >= 2) {
                this._finished = true;
                return;
            }
        }

        if (this.gameView.getInput().getMouseButtonHeld(0)) {
            this.heldTime++;
            if (!this._dragOperation) {
                const curScreenPos = this.gameView
                    .getInput()
                    .getMouseScreenPos();
                const distance = curScreenPos.distanceTo(this._startScreenPos);

                if (distance >= BaseFileClickOperation.DragThreshold) {
                    // Attempt to start dragging now that we've crossed the threshold.
                    this._triedDragging = true;

                    //returns true (can drag) if either aux.movable or aux.pickupable are true
                    if (await this._canDragFile(this._file)) {
                        this._dragOperation = await this._createDragOperation();
                    } else {
                        // Finish the click operation because we tried dragging but could not
                        // actually drag anything.
                        this._finished = true;
                    }
                }
            }
        } else {
            if (!this._dragOperation && !this._triedDragging) {
                // If not mobile, allow click no matter how long you've held on file, if mobile stop click if held too long
                if (!this.isMobile || this.heldTime < 30) {
                    await this._performClick();
                }
            }

            // Button has been released. This click operation is finished.
            this._finished = true;
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {
        // Make sure to dispose of drag rules if they exist.
        if (this._dragOperation) {
            this._dragOperation.dispose();
            this._dragOperation = null;
        }
    }

    protected async _canDragFile(file: File): Promise<boolean> {
        // TODO: Fix
        return true;
        // return isFileMovable(calc, file);
    }

    protected abstract _performClick(): Promise<void>;
    protected abstract _createDragOperation(): Promise<BaseFileDragOperation>;
}
