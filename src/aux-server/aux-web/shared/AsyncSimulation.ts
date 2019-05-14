import { Initable } from './Initable';
import {
    StoredCausalTree,
    Atom,
    Weave,
    SiteInfo,
} from '@casual-simulation/causal-trees';
import {
    AuxOp,
    FilesState,
    AuxObject,
    LocalEvents,
    SimulationIdParseSuccess,
    FileEvent,
    FileOp,
    AuxState,
    AuxFile,
} from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';

export interface AsyncSimulation extends Initable {
    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * Exports the stored causal tree from the simulation.
     */
    exportAux(): Promise<StoredCausalTree<AuxOp>>;

    /**
     * Adds the given file state to the simulation.
     * @param state The state to add.
     */
    addState(state: FilesState): Promise<void>;

    /**
     * Runs the given event on the given files.
     * @param eventName The name of the event to run.
     * @param files The files that should be searched for handlers for the event name.
     * @param arg The argument that should be passed to the event handlers.
     */
    action(eventName: string, files: File[], arg?: any): Promise<void>;

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    transaction(...events: FileEvent[]): Promise<void>;

    /**
     * Gets the simulation's user file.
     */
    getUserFile(): Promise<AuxObject>;

    /**
     * Gets the simulation's globals file.
     */
    globalsFile(): Promise<AuxFile>;

    /**
     * Gets the list of files that the current user has selected.
     */
    getSelectedFilesForUser(): Promise<AuxObject[]>;

    /**
     * Creates a new file for the current user that loads the simulation with the given ID.
     * @param id The ID of the simulation to load.
     * @param fileId The ID of the file to create.
     */
    createSimulation(id: string, fileId?: string): Promise<void>;

    /**
     * Deletes all the files in the current user's simulation context that load the given simulation ID.
     * @param id The ID of the simulation to remove.
     */
    destroySimulations(id: string): Promise<void>;

    /**
     * Creates a new workspace file.
     * @param fileId The ID of the file to create. If not specified a new ID will be generated.
     * @param builderContextId The ID of the context to create for the file. If not specified a new context ID will be generated.
     * @param contextFormula The formula that should be used to determine whether the workspace is allowed to be a context.
     * @param label The label that should be added to the created file.
     */
    createWorkspace(
        fileId?: string,
        builderContextId?: string,
        contextFormula?: string,
        label?: string
    ): Promise<void>;

    /**
     * Gets the parsed ID of the simulation.
     */
    getParsedId(): Promise<SimulationIdParseSuccess>;

    /**
     * Gets whether the simulation has been forced offline.
     */
    isForcedOffline(): Promise<boolean>;

    /**
     * Toggles whether the simulation has been forced offline.
     */
    toggleForceOffline(): Promise<void>;

    /**
     * Gets an observable that resolves whenever a new file is discovered.
     * That is, it was created or added by another user.
     */
    filesDiscovered: Observable<AuxFile[]>;

    /**
     * Gets an observable that resolves whenever a file is removed.
     * That is, it was deleted from the working directory either by checking out a
     * branch that does not contain the file or by deleting it.
     */
    filesRemoved: Observable<string[]>;

    /**
     * Gets an observable that resolves whenever a file is updated.
     */
    filesUpdated: Observable<AuxFile[]>;

    /**
     * Gets the observable list of local events that have been processed by this file helper.
     */
    localEvents: Observable<LocalEvents>;

    /**
     * An observable that resolves whenever the state between this client
     * and the remote peer changes. Upon subscription, this observable
     * will resolve immediately with the current connection state.
     *
     * Basically this resolves with true whenever we're connected and false whenever we're disconnected.
     */
    connectionStateChanged: Observable<boolean>;

    /**
     * Constructs a new weave that contains the smallest possible valid causal history for the given list
     * of parent atoms.
     * @param parents The list of atoms that should be kept in the weave.
     */
    subweave(...parents: Atom<FileOp>[]): Promise<Weave<FileOp>>;

    /**
     * Gets the site that the simulation is acting as.
     */
    site(): Promise<SiteInfo>;

    /**
     * Gets the list of sites that this simulation knows about.
     */
    knownSites(): Promise<SiteInfo[]>;

    /**
     * Pastes the given AUX State into the simulation as a new worksurface at the given position.
     * @param state The state to copy from.
     * @param x The X position that the worksurface should be placed at.
     * @param y The Y position that the worksurface should be placed at.
     * @param z The Z position that the worksurface should be placed at.
     */
    pasteState(state: AuxState, x: number, y: number, z: number): Promise<void>;
}
