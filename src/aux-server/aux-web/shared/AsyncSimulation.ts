import { Initable } from './Initable';
import { StoredCausalTree } from '@casual-simulation/causal-trees';
import {
    AuxOp,
    FilesState,
    AuxObject,
    LocalEvents,
    SimulationIdParseSuccess,
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
     * Gets the simulation's user file.
     */
    getUserFile(): Promise<AuxObject>;

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
}
