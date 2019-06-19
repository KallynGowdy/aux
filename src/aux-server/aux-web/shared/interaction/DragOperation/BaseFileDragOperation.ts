import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Vector2 } from 'three';
import {
    File,
    fileUpdated,
    PartialFile,
    FileEvent,
    updateFile,
    FileCalculationContext,
    objectsAtContextGridPosition,
    isFileStackable,
    getFileIndex,
    isDiff,
    getDiffUpdate,
    fileRemoved,
    COMBINE_ACTION_NAME,
    isMergeable,
    DRAG_OUT_OF_CONTEXT_ACTION_NAME,
    DROP_IN_CONTEXT_ACTION_NAME,
    DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME,
    DROP_ANY_IN_CONTEXT_ACTION_NAME,
    DIFF_ACTION_NAME,
} from '@casual-simulation/aux-common';

import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { differenceBy, maxBy } from 'lodash';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';

/**
 * Shared class for both FileDragOperation and NewFileDragOperation.
 */
export abstract class BaseFileDragOperation implements IOperation {
    protected _simulation3D: Simulation3D;
    protected _interaction: BaseInteractionManager;
    protected _files: File[];
    protected _file: File;
    protected _finished: boolean;
    protected _lastScreenPos: Vector2;
    protected _lastVRControllerPose: Pose;
    protected _combine: boolean;
    protected _merge: boolean;
    protected _other: File;
    protected _context: string;
    protected _previousContext: string;
    protected _originalContext: string;
    protected _vrController: VRController3D;

    private _inContext: boolean;

    protected get game() {
        return this._simulation3D.game;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    /**
     * Create a new drag rules.
     * @param simulation3D The simulation.
     * @param interaction The interaction manager.
     * @param files The files to drag.
     * @param context The context that the files are currently in.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        files: File[],
        context: string,
        vrController: VRController3D | null
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._setFiles(files);
        this._originalContext = this._context = context;
        this._previousContext = null;
        this._inContext = true;
        this._vrController = vrController;

        if (this._vrController) {
            this._lastVRControllerPose = this._vrController.worldPose.clone();
        } else {
            this._lastScreenPos = this._simulation3D.game
                .getInput()
                .getMouseScreenPos();
        }
    }

    update(calc: FileCalculationContext): void {
        if (this._finished) return;

        const buttonHeld: boolean = this._vrController
            ? this._vrController.getPrimaryButtonHeld()
            : this.game.getInput().getMouseButtonHeld(0);

        if (buttonHeld) {
            let shouldUpdateDrag: boolean;

            if (this._vrController) {
                const curPose = this._vrController.worldPose.clone();
                shouldUpdateDrag = !curPose.equals(this._lastVRControllerPose);
                this._lastVRControllerPose = curPose;
            } else {
                const curScreenPos = this.game.getInput().getMouseScreenPos();
                shouldUpdateDrag = !curScreenPos.equals(this._lastScreenPos);
                this._lastScreenPos = curScreenPos;
            }

            if (shouldUpdateDrag) {
                this._onDrag(calc);
            }
        } else {
            this._onDragReleased(calc);

            // This drag operation is finished.
            this._finished = true;
        }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {
        this._disposeCore();
        this.game.setGridsVisible(false);
        this._files = null;
        this._file = null;
    }

    protected _disposeCore() {
        // Combine files.
        if (this._merge && this._other) {
            const calc = this.simulation.helper.createContext();
            const update = getDiffUpdate(calc, this._file);

            const result = this.simulation.helper.actions([
                {
                    eventName: DIFF_ACTION_NAME,
                    files: [this._other],
                    arg: {
                        diffs: update.tags,
                    },
                },
            ]);
            const file = this._file;
            this.simulation.helper
                .transaction(
                    fileUpdated(this._other.id, update),
                    fileRemoved(this._file.id),
                    ...result
                )
                .then(() => {
                    if (file) {
                        this.simulation.recent.addFileDiff(file, true);
                    }
                });
        } else if (this._combine && this._other) {
            this.simulation.helper.action(COMBINE_ACTION_NAME, [
                this._file,
                this._other,
            ]);
        } else if (isDiff(null, this._file)) {
            const id = this._file.id;
            this.simulation.helper
                .transaction(
                    fileUpdated(this._file.id, {
                        tags: {
                            'aux.mergeBall': null,
                            'aux.mergeBall.tags': null,
                        },
                    })
                )
                .then(() => {
                    const file = this.simulation.helper.filesState[id];
                    if (file) {
                        this.simulation.recent.addFileDiff(file, true);
                    }
                });
        }
    }

    protected _setFiles(files: File[]) {
        this._files = files;
        if (this._files.length == 1) {
            this._file = this._files[0];
        }
    }

    protected _updateFilesPositions(
        files: File[],
        gridPosition: Vector2,
        index: number
    ) {
        if (!this._context) {
            return;
        }
        this._inContext = true;

        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: true,
                    [`${this._context}.x`]: gridPosition.x,
                    [`${this._context}.y`]: gridPosition.y,
                    [`${this._context}.index`]: index + i,
                },
            };
            if (this._previousContext) {
                tags.tags[this._previousContext] = null;
            }
            events.push(this._updateFile(files[i], tags));
        }

        this.simulation.helper.transaction(...events);
    }

    protected _updateFileContexts(files: File[], inContext: boolean) {
        this._inContext = inContext;
        if (!this._context) {
            return;
        }
        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: inContext,
                },
            };
            events.push(this._updateFile(files[i], tags));
        }

        this.simulation.helper.transaction(...events);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        this.simulation.recent.addFileDiff(file);
        // TODO: Ensure the VM processes the file updates
        // updateFile(file, this.simulation.helper.userFile.id, data, () =>
        //     this.simulation.helper.createContext()
        // );
        return fileUpdated(file.id, data);
    }

    /**
     * Calculates whether the given file should be stacked onto another file or if
     * it should be combined with another file.
     * @param calc The file calculation context.
     * @param context The context.
     * @param gridPosition The grid position that the file is being dragged to.
     * @param file The file that is being dragged.
     */
    protected _calculateFileDragStackPosition(
        calc: FileCalculationContext,
        context: string,
        gridPosition: Vector2,
        ...files: File[]
    ) {
        const objs = differenceBy(
            objectsAtContextGridPosition(calc, context, gridPosition),
            files,
            f => f.id
        );

        const canMerge =
            objs.length >= 1 &&
            files.length === 1 &&
            isDiff(calc, files[0]) &&
            isMergeable(calc, files[0]) &&
            isMergeable(calc, objs[0]);

        const canCombine =
            this._allowCombine() &&
            !canMerge &&
            objs.length === 1 &&
            files.length === 1 &&
            this._interaction.canCombineFiles(calc, files[0], objs[0]);

        // Can stack if we're dragging more than one file,
        // or (if the single file we're dragging is stackable and
        // the stack we're dragging onto is stackable)
        const canStack =
            files.length !== 1 ||
            (isFileStackable(calc, files[0]) &&
                (objs.length === 0 || isFileStackable(calc, objs[0])));

        const index = this._nextAvailableObjectIndex(
            calc,
            context,
            gridPosition,
            files,
            objs
        );

        return {
            combine: canCombine,
            merge: canMerge,
            stackable: canStack,
            other: canCombine ? objs[0] : canMerge ? objs[0] : null,
            index: index,
        };
    }

    /**
     * Calculates the next available index that an object can be placed at on the given workspace at the
     * given grid position.
     * @param context The context.
     * @param gridPosition The grid position that the next available index should be found for.
     * @param files The files that we're trying to find the next index for.
     * @param objs The objects at the same grid position.
     */
    protected _nextAvailableObjectIndex(
        calc: FileCalculationContext,
        context: string,
        gridPosition: Vector2,
        files: File[],
        objs: File[]
    ): number {
        const except = differenceBy(objs, files, f =>
            f instanceof AuxFile3D ? f.file.id : f.id
        );

        const indexes = except.map(o => ({
            object: o,
            index: getFileIndex(calc, o, context),
        }));

        // TODO: Improve to handle other scenarios like:
        // - Reordering objects
        // - Filling in gaps that can be made by moving files from the center of the list
        const maxIndex = maxBy(indexes, i => i.index);
        let nextIndex = 0;
        if (maxIndex) {
            nextIndex = maxIndex.index + 1;
        }

        return nextIndex;
    }

    protected _onDragReleased(calc: FileCalculationContext): void {
        if (this._context !== this._originalContext) {
            let events: FileEvent[] = [];
            if (this._originalContext) {
                // trigger drag out of context
                let result = this.simulation.helper.actions([
                    {
                        eventName: DRAG_OUT_OF_CONTEXT_ACTION_NAME,
                        files: this._files,
                        arg: this._originalContext,
                    },
                    {
                        eventName: DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME,
                        files: null,
                        arg: {
                            context: this._originalContext,
                            files: this._files,
                        },
                    },
                ]);

                events.push(...result);
            }

            if (this._inContext) {
                // Trigger drag into context
                let result = this.simulation.helper.actions([
                    {
                        eventName: DROP_IN_CONTEXT_ACTION_NAME,
                        files: this._files,
                        arg: this._context,
                    },
                    {
                        eventName: DROP_ANY_IN_CONTEXT_ACTION_NAME,
                        files: null,
                        arg: {
                            context: this._context,
                            files: this._files,
                        },
                    },
                ]);

                events.push(...result);
            }

            this.simulation.helper.transaction(...events);
        }
    }

    //
    // Abstractions
    //

    // A checked function to verify that the stacks can combine
    protected _allowCombine(): boolean {
        return true;
    }

    protected abstract _onDrag(calc: FileCalculationContext): void;
}
