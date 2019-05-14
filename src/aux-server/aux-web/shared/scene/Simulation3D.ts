import { Object3D } from 'three';
import { ContextGroup3D } from './ContextGroup3D';
import { Simulation } from '../Simulation';
import {
    AuxObject,
    AuxFile,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';
import { SubscriptionLike } from 'rxjs';
import { IGameView } from '../IGameView';
import { concatMap, tap, flatMap as rxFlatMap } from 'rxjs/operators';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { AsyncSimulation } from '../AsyncSimulation';

/**
 * Defines a class that is able to render a simulation.
 */
export abstract class Simulation3D extends Object3D
    implements SubscriptionLike {
    protected _subs: SubscriptionLike[];

    /**
     * The game view.
     */
    protected _gameView: IGameView;

    closed: boolean;
    onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();

    /**
     * The list of contexts that are being rendered in the simulation.
     */
    contexts: ContextGroup3D[];

    /**
     * The simulation that this object is rendering.
     */
    simulation: AsyncSimulation;

    /**
     * Gets the game view that is for this simulation.
     */
    get gameView() {
        return this._gameView;
    }

    /**
     * Creates a new Simulation3D object that can be used to render the given simulation.
     * @param gameView The game view.
     * @param simulation The simulation to render.
     */
    constructor(gameView: IGameView, simulation: AsyncSimulation) {
        super();
        this._gameView = gameView;
        this.simulation = simulation;
        this.contexts = [];
        this._subs = [];
    }

    /**
     * Initializes the simulation 3D.
     */
    async init(): Promise<void> {
        // Subscriptions to file events.
        this._subs.push(
            this.simulation.filesDiscovered
                .pipe(
                    rxFlatMap(files => files),
                    concatMap(file => this._fileAdded(file))
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.filesRemoved
                .pipe(
                    rxFlatMap(files => files),
                    tap(file => this._fileRemoved(file))
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.filesUpdated
                .pipe(
                    rxFlatMap(files => files),
                    concatMap(file => this._fileUpdated(file, false))
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.localEvents
                .pipe(
                    tap(e => {
                        if (e.name === 'tween_to') {
                            this._gameView.tweenCameraToFile(
                                e.fileId,
                                e.zoomValue
                            );
                        }
                    })
                )
                .subscribe()
        );
    }

    frameUpdate() {
        // TOOD: Fix
        // const calc = this.simulation.helper.createContext();
        // this._frameUpdateCore(calc);
    }

    protected _frameUpdateCore(calc: AsyncCalculationContext) {
        this.contexts.forEach(context => {
            context.frameUpdate(calc);
        });
    }

    protected async _fileAdded(file: AuxObject): Promise<void> {
        let context = await this._createContext(this.simulation, file);
        if (context) {
            this.contexts.push(context);
            this.add(context);
        }
        await this._fileAddedCore(this.simulation, file);
        await this._fileUpdated(file, true);
        this.onFileAdded.invoke(file);
    }

    protected async _fileAddedCore(
        calc: AsyncCalculationContext,
        file: AuxObject
    ): Promise<void> {
        await Promise.all(this.contexts.map(c => c.fileAdded(calc, file)));
    }

    protected async _fileRemoved(id: string): Promise<void> {
        this._fileRemovedCore(this.simulation, id);
        this.onFileRemoved.invoke(null);
    }

    protected _fileRemovedCore(calc: AsyncCalculationContext, id: string) {
        let removedIndex: number = -1;
        this.contexts.forEach((context, index) => {
            context.fileRemoved(calc, id);
            if (context.file.id === id) {
                removedIndex = index;
            }
        });

        if (removedIndex >= 0) {
            const context = this.contexts[removedIndex];
            this._removeContext(context, removedIndex);
        }
    }

    protected _removeContext(context: ContextGroup3D, removedIndex: number) {
        context.dispose();
        this.remove(context);
        this.contexts.splice(removedIndex, 1);
    }

    protected async _fileUpdated(
        file: AuxObject,
        initialUpdate: boolean
    ): Promise<void> {
        let { shouldRemove } = await this._shouldRemoveUpdatedFile(
            this.simulation,
            file,
            initialUpdate
        );
        await this._fileUpdatedCore(this.simulation, file);
        this.onFileUpdated.invoke(file);
        if (shouldRemove) {
            this._fileRemoved(file.id);
        }
    }

    protected async _fileUpdatedCore(
        calc: AsyncCalculationContext,
        file: AuxObject
    ) {
        await Promise.all(
            this.contexts.map(c => c.fileUpdated(calc, file, []))
        );
    }

    protected async _shouldRemoveUpdatedFile(
        calc: AsyncCalculationContext,
        file: AuxObject,
        initialUpdate: boolean
    ): Promise<{ shouldRemove: boolean }> {
        return {
            shouldRemove: false,
        };
    }

    unsubscribe(): void {
        this._subs.forEach(s => s.unsubscribe());
        this.closed = true;
        this._subs = [];
    }

    /**
     * Creates a new context group for the given file.
     * @param file The file to create the context group for.
     */
    protected abstract _createContext(
        calc: AsyncCalculationContext,
        file: AuxObject
    ): Promise<ContextGroup3D>;
}
