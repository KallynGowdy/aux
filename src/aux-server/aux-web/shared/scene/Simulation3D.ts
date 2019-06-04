import { Object3D, Texture, Color } from 'three';
import { ContextGroup3D } from './ContextGroup3D';
import { Simulation } from '../Simulation';
import {
    AuxObject,
    AuxFile,
    FileCalculationContext,
    hasValue,
} from '@casual-simulation/aux-common';
import { SubscriptionLike } from 'rxjs';
import { concatMap, tap, flatMap as rxFlatMap } from 'rxjs/operators';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { CameraRig } from './CameraRigFactory';
import { Game } from './Game';

/**
 * Defines a class that is able to render a simulation.
 */
export abstract class Simulation3D extends Object3D
    implements SubscriptionLike {
    protected _subs: SubscriptionLike[];

    /**
     * The game view.
     */
    protected _game: Game;

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
    simulation: Simulation;

    private _sceneBackground: Color | Texture = null;

    /**
     * Gets the game view that is for this simulation.
     */
    get game() {
        return this._game;
    }

    /**
     * Gets the background color for the simulation.
     */
    get backgroundColor(): Color | Texture {
        return this._sceneBackground;
    }

    /**
     * Creates a new Simulation3D object that can be used to render the given simulation.
     * @param game The game.
     * @param simulation The simulation to render.
     */
    constructor(game: Game, simulation: Simulation) {
        super();
        this._game = game;
        this.simulation = simulation;
        this.contexts = [];
        this._subs = [];
    }

    /**
     * Initializes the simulation 3D.
     */
    init() {
        // Subscriptions to file events.
        this._subs.push(
            this.simulation.watcher.filesDiscovered
                .pipe(
                    rxFlatMap(files => files),
                    concatMap(file => this._fileAdded(file))
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher.filesRemoved
                .pipe(
                    rxFlatMap(files => files),
                    tap(file => this._fileRemoved(file))
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher.filesUpdated
                .pipe(
                    rxFlatMap(files => files),
                    concatMap(file => this._fileUpdated(file, false))
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.helper.localEvents
                .pipe(
                    tap(e => {
                        if (e.name === 'tween_to') {
                            const foundFileIn3D = this.contexts.some(c =>
                                c.getFiles().some(f => f.file.id === e.fileId)
                            );
                            if (foundFileIn3D) {
                                this.game.tweenCameraToFile(
                                    this.getMainCameraRig(),
                                    e.fileId,
                                    e.zoomValue
                                );
                            }
                        }
                    })
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher
                .fileChanged(this.simulation.helper.globalsFile)
                .pipe(
                    tap(file => {
                        // Scene background color.
                        let sceneBackgroundColor = file.tags['aux.scene.color'];
                        this._sceneBackground = hasValue(sceneBackgroundColor)
                            ? new Color(sceneBackgroundColor)
                            : null;
                    })
                )
                .subscribe()
        );
    }

    frameUpdate() {
        const calc = this.simulation.helper.createContext();
        this._frameUpdateCore(calc);
    }

    /**
     * Gets the camera that is used as the primary rendering camera for this simulation.
     */
    abstract getMainCameraRig(): CameraRig;

    protected _frameUpdateCore(calc: FileCalculationContext) {
        this.contexts.forEach(context => {
            context.frameUpdate(calc);
        });
    }

    protected async _fileAdded(file: AuxObject): Promise<void> {
        let calc = this.simulation.helper.createContext();
        let context = this._createContext(calc, file);
        if (context) {
            this.contexts.push(context);
            this.add(context);
        }

        await this._fileAddedCore(calc, file);
        await this._fileUpdated(file, true);

        this.onFileAdded.invoke(file);
    }

    protected async _fileAddedCore(
        calc: FileCalculationContext,
        file: AuxObject
    ): Promise<void> {
        await Promise.all(this.contexts.map(c => c.fileAdded(file, calc)));
    }

    protected async _fileRemoved(id: string): Promise<void> {
        const calc = this.simulation.helper.createContext();
        this._fileRemovedCore(calc, id);

        this.onFileRemoved.invoke(null);
    }

    protected _fileRemovedCore(calc: FileCalculationContext, id: string) {
        let removedIndex: number = -1;
        this.contexts.forEach((context, index) => {
            context.fileRemoved(id, calc);
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
        const calc = this.simulation.helper.createContext();
        let { shouldRemove } = this._shouldRemoveUpdatedFile(
            calc,
            file,
            initialUpdate
        );

        await this._fileUpdatedCore(calc, file);

        this.onFileUpdated.invoke(file);

        if (shouldRemove) {
            this._fileRemoved(file.id);
        }
    }

    protected async _fileUpdatedCore(
        calc: FileCalculationContext,
        file: AuxObject
    ) {
        await Promise.all(
            this.contexts.map(c => c.fileUpdated(file, [], calc))
        );
    }

    protected _shouldRemoveUpdatedFile(
        calc: FileCalculationContext,
        file: AuxObject,
        initialUpdate: boolean
    ): { shouldRemove: boolean } {
        return {
            shouldRemove: false,
        };
    }

    unsubscribe(): void {
        this._subs.forEach(s => s.unsubscribe());
        this.remove(...this.children);
        this.contexts.splice(0, this.contexts.length);
        this.closed = true;
        this._subs = [];
    }

    /**
     * Creates a new context group for the given file.
     * @param file The file to create the context group for.
     */
    protected abstract _createContext(
        calc: FileCalculationContext,
        file: AuxObject
    ): ContextGroup3D;
}
