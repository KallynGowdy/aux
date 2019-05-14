import {
    AuxFile,
    calculateFileValue,
    AsyncCalculationContext,
    TagUpdatedEvent,
    isFileInContext,
    getContextPosition,
    getFilePosition,
    getFileIndex,
    fileContextSortOrder,
    hasValue,
    isSimulation,
    getFileChannel,
} from '@casual-simulation/aux-common';
import { remove, sortBy } from 'lodash';
import { getOptionalValue } from '../shared/SharedUtils';
import { PlayerSimulation3D } from './scene/PlayerSimulation3D';
import { Subject, Observable } from 'rxjs';

/**
 * Defines an interface for an item that is in a user's menu.
 */
export default interface SimulationItem {
    file: AuxFile;
    simulation: PlayerSimulation3D;
    simulationToLoad: string;
    context: string;
}

/**
 * SimulationContext is a helper class for managing the set of simulations that a user has loaded.
 */
export class SimulationContext {
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
     * The files in this contexts mapped into simulation items.
     * Files are ordered in ascending order based on their index in the context.
     */
    items: SimulationItem[] = [];

    /**
     * Gets an observable that resolves whenever this simulation's items are updated.
     */
    get itemsUpdated(): Observable<void> {
        return this._itemsUpdated;
    }

    private _itemsUpdated: Subject<void>;
    private _itemsDirty: boolean;

    constructor(simulation: PlayerSimulation3D, context: string) {
        if (context == null || context == undefined) {
            throw new Error('Menu context cannot be null or undefined.');
        }
        this.simulation = simulation;
        this.context = context;
        this.files = [];
        this._itemsUpdated = new Subject<void>();
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    async fileAdded(file: AuxFile, calc: AsyncCalculationContext) {
        const isInContext = !!this.files.find(f => f.id == file.id);
        const shouldBeInContext =
            (await calc.isFileInContext(file, this.context)) &&
            (await calc.isSimulation(file));

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
        const shouldBeInContext =
            (await calc.isFileInContext(file, this.context)) &&
            (await calc.isSimulation(file));

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

    async frameUpdate(calc: AsyncCalculationContext) {
        if (this._itemsDirty) {
            await this._resortItems(calc);
            this._itemsDirty = false;
        }
    }

    dispose(): void {
        this._itemsUpdated.unsubscribe();
    }

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

    private async _resortItems(calc: AsyncCalculationContext) {
        let mapped = new Array<any>(this.files.length);
        for (let i = 0; i < this.files.length; i++) {
            const f = this.files[i];
            mapped[i] = {
                file: f,
                simulation: this.simulation,
                simulationToLoad: await calc.getFileChannel(f),
                context: this.context,
                sortOrder: await calc.fileContextSortOrder(f, this.context),
            };
        }
        this.items = sortBy(mapped, f => f.sortOrder);

        this._itemsUpdated.next();
    }
}
