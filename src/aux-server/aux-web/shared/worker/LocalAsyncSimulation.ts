import { AsyncSimulation } from '../AsyncSimulation';
import { Observable } from 'rxjs';
import { AuxObject, LocalEvents, AuxFile } from '@casual-simulation/aux-common';
import { FilesUpdatedEvent } from '../FilePanelManager';
import { RecentsUpdatedEvent } from '../RecentFilesManager';

export interface LocalAsyncSimulation extends AsyncSimulation {
    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * The ID of the user's file.
     */
    userFileId: string;

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
     * Creates an observable that resolves whenever the given file changes.
     * @param file The file to watch.
     */
    fileChanged(file: AuxObject): Observable<AuxObject>;

    /**
     * Creates an observable that resolves whenever the user's file changes.
     */
    userFileChanged(): Observable<AuxObject>;
}
