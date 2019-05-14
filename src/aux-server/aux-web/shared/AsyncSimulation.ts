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
    File,
    PartialFile,
} from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';
import { FilesUpdatedEvent } from './FilePanelManager';
import { RecentsUpdatedEvent } from './RecentFilesManager';

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
     * Gets the current file state.
     */
    getFilesState(): Promise<AuxState>;

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
     * Clears the user's current selection.
     */
    clearSelection(): Promise<void>;

    /**
     * Sets the list of files that the user should have selected.
     * @param files The files.
     */
    setSelectedFiles(files: AuxObject[]): Promise<void>;

    /**
     * Selects the given file for the current user.
     * @param file The file to select.
     * @param multiSelect Whether to put the user into multi-select mode. (Default false)
     */
    selectFile(file: AuxObject, multiSelect?: boolean): Promise<void>;

    /**
     * Adds the given file to the recents list.
     * @param file The file to add.
     * @param updateTags Whether to update the diff tags.
     */
    addFileDiff(file: File, updateTags?: boolean): Promise<void>;

    /**
     * Adds a diffball that represents the given file ID, tag, and value.
     * @param fileId The ID of the file that the diff represents.
     * @param tag The tag that the diff contains.
     * @param value The value that the diff contains.
     */
    addTagDiff(fileId: string, tag: string, value: any): Promise<void>;

    /**
     * Clears the list of recent files.
     */
    clearRecents(): Promise<void>;

    /**
     * Sets the recent file that is currently selected.
     * @param file The file to select.
     */
    setSelectedRecentFile(file: AuxObject): Promise<void>;

    /**
     * Gets the currently selected recent file.
     */
    getSelectedRecentFile(): Promise<AuxObject>;

    /**
     * Gets the list of recent files.
     */
    getRecentFiles(): Promise<AuxObject[]>;

    /**
     * Calculates the nicely formatted value for the given file and tag.
     * @param file The file to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedFileValue(file: File, tag: string): Promise<string>;

    /**
     * Updates the given file with the given data.
     * @param file The file.
     * @param newData The new data that the file should have.
     */
    updateFile(file: AuxFile, newData: PartialFile): Promise<void>;

    /**
     * Destroys the given file.
     * @param file The file to destroy.
     */
    destroyFile(file: AuxObject): Promise<void>;

    /**
     * Creates a new file with the given ID and tags. Returns the file that was created.
     * @param id (Optional) The ID that the file should have.
     * @param tags (Optional) The tags that the file should have.
     */
    createFile(id?: string, tags?: File['tags']): Promise<AuxObject>;

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
     * Sets the file that the user is editing.
     * @param file The file.
     */
    setEditingFile(file: File): Promise<void>;

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
     * Creates an observable that resolves whenever the given file changes.
     * @param file The file to watch.
     */
    fileChanged(file: AuxObject): Observable<AuxObject>;

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
     * Gets an observable that resolves whenever the list of selected files is updated.
     */
    filePanelUpdated: Observable<FilesUpdatedEvent>;

    /**
     * Gets an observable that resolves when the file panel is opened or closed.
     */
    filePanelOpenChanged: Observable<boolean>;

    /**
     * Gets an observable that resolves when the file panel search is updated.
     */
    filePanelSearchUpdated: Observable<string>;

    /**
     * Gets an observable that resolves when the recents list is updated.
     */
    recentsUpdated: Observable<RecentsUpdatedEvent>;

    /**
     * Sets the search value in the file panel.
     * @param search The search.
     */
    setSearch(search: string): Promise<void>;

    /**
     * Toggles whether the file panel is open or closed.
     */
    toggleFilePanelOpen(): Promise<void>;

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
