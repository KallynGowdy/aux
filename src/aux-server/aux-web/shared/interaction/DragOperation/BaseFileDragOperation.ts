import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Vector2 } from 'three';
import {
    File,
    fileUpdated,
    PartialFile,
    FileEvent,
    updateFile,
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
    action,
    calculateActionEvents,
    DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME,
    DROP_ANY_IN_CONTEXT_ACTION_NAME,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';

import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { differenceBy, maxBy } from 'lodash';
import { Simulation3D } from 'aux-web/shared/scene/Simulation3D';

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
    protected _combine: boolean;
    protected _merge: boolean;
    protected _other: File;
    protected _context: string;
    protected _previousContext: string;
    protected _originalContext: string;

    private _inContext: boolean;

    protected get gameView() {
        return this._simulation3D.gameView;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    /**
     * Create a new drag rules.
     * @param simulation The simulation.
     * @param interaction The interaction manager.
     * @param files The files to drag.
     * @param context The context that the files are currently in.
     */
    constructor(
        simulation: Simulation3D,
        interaction: BaseInteractionManager,
        files: File[],
        context: string
    ) {
        this._simulation3D = simulation;
        this._interaction = interaction;
        this._setFiles(files);
        this._lastScreenPos = this._simulation3D.gameView
            .getInput()
            .getMouseScreenPos();
        this._originalContext = this._context = context;
        this._previousContext = null;
        this._inContext = true;
    }

    async update(): Promise<void> {
        if (this._finished) return;

        if (this.gameView.getInput().getMouseButtonHeld(0)) {
            const curScreenPos = this.gameView.getInput().getMouseScreenPos();

            if (!curScreenPos.equals(this._lastScreenPos)) {
                await this._onDrag();

                this._lastScreenPos = curScreenPos;
            }
        } else {
            // This drag operation is finished.
            await this._onDragReleased();
            this._finished = true;
        }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {
        this._disposeCore();
        this.gameView.setGridsVisible(false);
        this._files = null;
        this._file = null;
    }

    protected _disposeCore() {
        // Combine files.
        if (this._merge && this._other) {
            const update = getDiffUpdate(this._file);
            this.simulation.transaction(
                fileUpdated(this._other.id, update),
                fileRemoved(this._file.id)
            );
        } else if (this._combine && this._other) {
            this.simulation.action(COMBINE_ACTION_NAME, [
                this._file,
                this._other,
            ]);
        } else if (isDiff(this._file)) {
            this.simulation.transaction(
                fileUpdated(this._file.id, {
                    tags: {
                        'aux._diff': null,
                        'aux._diffTags': null,
                    },
                })
            );
        }
    }

    protected _setFiles(files: File[]) {
        this._files = files;
        if (this._files.length == 1) {
            this._file = this._files[0];
        }
    }

    protected async _updateFilesPositions(
        files: File[],
        gridPosition: Vector2,
        index: number
    ) {
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
            events.push(await this._updateFile(files[i], tags));
        }

        await this.simulation.transaction(...events);
    }

    protected async _updateFileContexts(files: File[], inContext: boolean) {
        this._inContext = inContext;
        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: inContext,
                },
            };
            events.push(await this._updateFile(files[i], tags));
        }

        await this.simulation.transaction(...events);
    }

    protected _updateFile(file: File, data: PartialFile): Promise<FileEvent> {
        this.simulation.addFileDiff(file);
        return this.simulation.updateFileEvent(file, data);
    }

    /**
     * Calculates whether the given file should be stacked onto another file or if
     * it should be combined with another file.
     * @param calc The file calculation context.
     * @param context The context.
     * @param gridPosition The grid position that the file is being dragged to.
     * @param file The file that is being dragged.
     */
    protected async _calculateFileDragStackPosition(
        context: string,
        gridPosition: Vector2,
        ...files: File[]
    ) {
        const objs = differenceBy(
            await this.simulation.objectsAtContextGridPosition(
                context,
                gridPosition
            ),
            files,
            f => f.id
        );
        const canMerge =
            objs.length >= 1 &&
            files.length === 1 &&
            isDiff(files[0]) &&
            (await this.simulation.isMergeable(files[0])) &&
            (await this.simulation.isMergeable(objs[0]));

        const canCombine =
            this._allowCombine() &&
            !canMerge &&
            objs.length === 1 &&
            files.length === 1 &&
            (await this._interaction.canCombineFiles(
                this.simulation,
                files[0],
                objs[0]
            ));
        // Can stack if we're dragging more than one file,
        // or (if the single file we're dragging is stackable and
        // the stack we're dragging onto is stackable)
        const canStack =
            files.length !== 1 ||
            ((await this.simulation.isFileStackable(files[0])) &&
                (objs.length === 0 ||
                    (await this.simulation.isFileStackable(objs[0]))));
        const index = await this._nextAvailableObjectIndex(
            this.simulation,
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
    protected async _nextAvailableObjectIndex(
        calc: AsyncCalculationContext,
        context: string,
        gridPosition: Vector2,
        files: File[],
        objs: File[]
    ): Promise<number> {
        const except = differenceBy(objs, files, f =>
            f instanceof AuxFile3D ? f.file.id : f.id
        );

        let indexes = new Array<any>(except.length);
        for (let i = 0; i < except.length; i++) {
            const o = except[i];
            indexes[i] = {
                object: o,
                index: await calc.getFileIndex(o, context),
            };
        }

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

    protected async _onDragReleased(): Promise<void> {
        if (this._context !== this._originalContext) {
            let events: FileEvent[] = [];
            if (this._originalContext) {
                // trigger drag out of context
                let result = await this.simulation.actionEvents(
                    DRAG_OUT_OF_CONTEXT_ACTION_NAME,
                    this._files,
                    this._originalContext
                );
                events.push(...result.events);

                result = await this.simulation.actionEvents(
                    DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME,
                    null,
                    {
                        context: this._originalContext,
                        files: this._files,
                    }
                );
                events.push(...result.events);
            }

            if (this._inContext) {
                // Trigger drag into context
                let result = await this.simulation.actionEvents(
                    DROP_IN_CONTEXT_ACTION_NAME,
                    this._files,
                    this._context
                );
                events.push(...result.events);

                result = await this.simulation.actionEvents(
                    DROP_ANY_IN_CONTEXT_ACTION_NAME,
                    null,
                    {
                        context: this._context,
                        files: this._files,
                    }
                );
                events.push(...result.events);
            }

            await this.simulation.transaction(...events);
        }
    }

    //
    // Abstractions
    //

    // A checked function to verify that the stacks can combine
    protected _allowCombine(): boolean {
        return true;
    }

    protected abstract _onDrag(): Promise<void>;
}
