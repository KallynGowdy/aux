import {
    AuxFile,
    calculateFileValue,
    TagUpdatedEvent,
    isFileInContext,
    getContextPosition,
    getFilePosition,
    getFileIndex,
    fileContextSortOrder,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';
import { remove, sortBy } from 'lodash';
import { getOptionalValue } from '../shared/SharedUtils';
import { PlayerSimulation3D } from './scene/PlayerSimulation3D';

/**
 * Defines an interface for an item that is in a user's menu.
 */
export interface MenuItem {
    file: AuxFile;
    simulation: PlayerSimulation3D;
    context: string;
}

/**
 * MenuContext is a helper class to assist with managing the user's menu context.
 */
export class MenuContext {
    /**
     * The simulation that the context is for.
     */
    simulation: PlayerSimulation3D;

    /**
     * The context that this object represents.
     */
    context: string = null;

    /**
     * All the files that are in this context.
     */
    files: AuxFile[] = [];

    /**
     * The files in this contexts mapped into menu items.
     * Files are ordered in ascending order based on their index in the context.
     */
    items: MenuItem[] = [];

    private _itemsDirty: boolean;

    constructor(simulation: PlayerSimulation3D, context: string) {
        if (context == null || context == undefined) {
            throw new Error('Menu context cannot be null or undefined.');
        }
        this.simulation = simulation;
        this.context = context;
        this.files = [];
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    async fileAdded(file: AuxFile, calc: AsyncCalculationContext) {
        const isInContext = !!this.files.find(f => f.id == file.id);
        const shouldBeInContext = isFileInContext(calc, file, this.context);

        if (!isInContext && shouldBeInContext) {
            this._addFile(file, calc);
        }
    }

    /**
     * Notifies this context that the given file was updated.
     * @param file The file.
     * @param updates The changes made to the file.
     * @param calc The calculation context that should be used.
     */
    async fileUpdated(
        file: AuxFile,
        updates: TagUpdatedEvent[],
        calc: AsyncCalculationContext
    ) {
        const isInContext = !!this.files.find(f => f.id == file.id);
        const shouldBeInContext = isFileInContext(calc, file, this.context);

        if (!isInContext && shouldBeInContext) {
            this._addFile(file, calc);
        } else if (isInContext && !shouldBeInContext) {
            this._removeFile(file.id);
        } else if (isInContext && shouldBeInContext) {
            this._updateFile(file, updates, calc);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The ID of the file that was removed.
     * @param calc The calculation context.
     */
    fileRemoved(id: string, calc: AsyncCalculationContext) {
        this._removeFile(id);
    }

    frameUpdate(calc: AsyncCalculationContext): void {
        if (this._itemsDirty) {
            this._resortItems(calc);
            this._itemsDirty = false;
        }
    }

    dispose(): void {}

    private _addFile(file: AuxFile, calc: AsyncCalculationContext) {
        this.files.push(file);
        this._itemsDirty = true;
    }

    private _removeFile(id: string) {
        remove(this.files, f => f.id === id);
        this._itemsDirty = true;
    }

    private _updateFile(
        file: AuxFile,
        updates: TagUpdatedEvent[],
        calc: AsyncCalculationContext
    ) {
        let fileIndex = this.files.findIndex(f => f.id == file.id);
        if (fileIndex >= 0) {
            this.files[fileIndex] = file;
            this._itemsDirty = true;
        }
    }

    private _resortItems(calc: AsyncCalculationContext): void {
        this.items = sortBy(this.files, f =>
            fileContextSortOrder(calc, f, this.context)
        ).map(f => {
            return {
                file: f,
                simulation: this.simulation,
                context: this.context,
            };
        });
    }
}
