import { AsyncSimulation } from '../AsyncSimulation';
import { Simulation } from '../Simulation';
import {
    FileEvent,
    UserMode,
    AuxObject,
    SelectionMode,
    File,
    FileTags,
    AuxOp,
    FilesState,
    AuxState,
    SimulationIdParseSuccess,
    LocalEvents,
    FileOp,
    FileDragMode,
    FileShape,
    FilterParseResult,
    FileLabelAnchor,
    AsyncCalculationContextWrapper,
} from '@casual-simulation/aux-common';
import { Observable, SubscriptionLike } from 'rxjs';
import {
    StoredCausalTree,
    Atom,
    Weave,
    SiteInfo,
} from '@casual-simulation/causal-trees';
import { LoadingProgressCallback } from '@casual-simulation/aux-common/LoadingProgress';
import { FilesUpdatedEvent } from '../FilePanelManager';
import { RecentsUpdatedEvent } from '../RecentFilesManager';
import { simd } from 'sharp';
import {
    RemoteAsyncSimulation,
    SimulationEvents,
} from './RemoteAsyncSimulation';

export class RemoteAsyncSimulationWrapper extends AsyncCalculationContextWrapper
    implements RemoteAsyncSimulation {
    async watchFile(
        key: string,
        id: string,
        callback: (event: AuxObject) => void
    ): Promise<void> {
        const listenerId = key + id;

        await this.unwatchFile(key, id);

        const file = this._sim.helper.filesState[id];
        const sub = this.fileChanged(file).subscribe(f => {
            callback(f);
        });

        this._fileListeners.set(listenerId, sub);
    }

    async unwatchFile(key: string, id: string): Promise<void> {
        const listenerId = key + id;
        if (this._fileListeners.has(listenerId)) {
            const listener = this._fileListeners.get(listenerId);
            listener.unsubscribe();
        }
    }

    async registerListener(
        key: string,
        callback: (event: SimulationEvents) => void
    ): Promise<void> {
        this._listeners.set(key, callback);
    }

    async unregisterListener(key: string): Promise<void> {
        this._listeners.delete(key);
    }

    get id(): string {
        return this._sim.id;
    }

    get userFileId(): string {
        return this._sim.helper.userFile.id;
    }

    async exportAux(): Promise<StoredCausalTree<AuxOp>> {
        return this._sim.aux.tree.export();
    }

    async forkAux(forkName: string): Promise<void> {
        return await this._sim.forkAux(forkName);
    }

    addState(state: FilesState): Promise<void> {
        return this._sim.helper.addState(state);
    }

    async getFilesState(): Promise<AuxState> {
        return this._sim.helper.filesState;
    }

    async actionEvents(
        eventName: string,
        files: File[],
        arg?: any
    ): Promise<{ events: FileEvent[]; hasUserDefinedEvents: boolean }> {
        return this._sim.helper.actionEvents(eventName, files, arg);
    }

    action(eventName: string, files: File[], arg?: any): Promise<void> {
        return this._sim.helper.action(eventName, files, arg);
    }

    transaction(...events: FileEvent[]): Promise<void> {
        return this._sim.helper.transaction(...events);
    }

    async getUserFile(): Promise<AuxObject> {
        return this._sim.helper.userFile;
    }

    setUserMode(mode: UserMode): Promise<void> {
        return this._sim.setUserMode(mode);
    }

    async globalsFile(): Promise<AuxObject> {
        return this._sim.helper.globalsFile;
    }

    async getSelectedFilesForUser(): Promise<AuxObject[]> {
        return this._sim.selection.getSelectedFilesForUser(
            this._sim.helper.userFile
        );
    }

    async getSelectionMode(): Promise<SelectionMode> {
        return this._sim.selection.mode;
    }

    clearSelection(): Promise<void> {
        return this._sim.selection.clearSelection();
    }

    setSelectedFiles(files: AuxObject[]): Promise<void> {
        return this._sim.selection.setSelectedFiles(files);
    }

    selectFile(file: AuxObject, multiSelect?: boolean): Promise<void> {
        return this._sim.selection.selectFile(file, multiSelect);
    }

    async addFileDiff(file: File, updateTags?: boolean): Promise<void> {
        return this._sim.recent.addFileDiff(file, updateTags);
    }

    async addTagDiff(fileId: string, tag: string, value: any): Promise<void> {
        return this._sim.recent.addTagDiff(fileId, tag, value);
    }

    async clearRecents(): Promise<void> {
        return this._sim.recent.clear();
    }

    async setSelectedRecentFile(file: File): Promise<void> {
        this._sim.recent.selectedRecentFile = file;
    }
    async getSelectedRecentFile(): Promise<File> {
        return this._sim.recent.selectedRecentFile;
    }

    async getRecentFiles(): Promise<File[]> {
        return this._sim.recent.files;
    }

    updateFile(file: AuxObject, newData: Partial<File>): Promise<void> {
        return this._sim.helper.updateFile(file, newData);
    }

    async updateFileEvent(
        file: File,
        newData: Partial<File>
    ): Promise<FileEvent> {
        return this._sim.helper.updateFileEvent(file, newData);
    }

    destroyFile(file: AuxObject): Promise<void> {
        return this._sim.helper.destroyFile(file);
    }

    async calculateDestroyFileEvents(file: File): Promise<FileEvent[]> {
        return this._sim.helper.calculateDestroyFileEvents(file);
    }

    deleteEverything(): Promise<void> {
        return this._sim.deleteEverything();
    }

    createFile(id?: string, tags?: FileTags): Promise<AuxObject> {
        return this._sim.helper.createFile(id, tags);
    }

    createSimulation(id: string, fileId?: string): Promise<void> {
        return this._sim.helper.createSimulation(id, fileId);
    }

    destroySimulations(id: string): Promise<void> {
        return this._sim.helper.destroySimulations(id);
    }

    createWorkspace(
        fileId?: string,
        builderContextId?: string,
        contextFormula?: string,
        label?: string
    ): Promise<void> {
        return this._sim.helper.createWorkspace(
            fileId,
            builderContextId,
            contextFormula,
            label
        );
    }

    setEditingFile(file: File): Promise<void> {
        return this._sim.helper.setEditingFile(file);
    }

    async getParsedId(): Promise<SimulationIdParseSuccess> {
        return this._sim.parsedId;
    }

    async isForcedOffline(): Promise<boolean> {
        return this._sim.socketManager.forcedOffline;
    }

    async toggleForceOffline(): Promise<void> {
        return this._sim.socketManager.toggleForceOffline();
    }

    fileChanged(file: AuxObject): Observable<AuxObject> {
        return this._sim.watcher.fileChanged(file);
    }

    get filesDiscovered(): Observable<AuxObject[]> {
        return this._sim.watcher.filesDiscovered;
    }

    get filesRemoved(): Observable<string[]> {
        return this._sim.watcher.filesRemoved;
    }

    get filesUpdated(): Observable<AuxObject[]> {
        return this._sim.watcher.filesUpdated;
    }

    get localEvents(): Observable<LocalEvents> {
        return this._sim.helper.localEvents;
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._sim.aux.channel.connectionStateChanged;
    }

    get filePanelUpdated(): Observable<FilesUpdatedEvent> {
        return this._sim.filePanel.filesUpdated;
    }

    get filePanelOpenChanged(): Observable<boolean> {
        return this._sim.filePanel.isOpenChanged;
    }

    get filePanelSearchUpdated(): Observable<string> {
        return this._sim.filePanel.searchUpdated;
    }

    get recentsUpdated(): Observable<RecentsUpdatedEvent> {
        return this._sim.recent.onUpdated;
    }

    async setSearch(search: string): Promise<void> {
        this._sim.filePanel.search = search;
    }

    async toggleFilePanelOpen(): Promise<void> {
        return this._sim.filePanel.toggleOpen();
    }

    async subweave(...parents: Atom<AuxOp>[]): Promise<Weave<AuxOp>> {
        return this._sim.aux.tree.weave.subweave(...parents);
    }

    async site(): Promise<SiteInfo> {
        return this._sim.aux.tree.site;
    }

    async knownSites(): Promise<SiteInfo[]> {
        return this._sim.aux.tree.knownSites;
    }

    pasteState(
        state: AuxState,
        x: number,
        y: number,
        z: number
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        await this._sim.init(loadingCallback);

        this._subs = [
            this.filesDiscovered.subscribe(files => {
                this._sendEvent({
                    name: 'files_discovered',
                    data: files,
                });
            }),
            this.filesUpdated.subscribe(files => {
                this._sendEvent({
                    name: 'files_updated',
                    data: files,
                });
            }),
            this.filesRemoved.subscribe(files => {
                this._sendEvent({
                    name: 'files_removed',
                    data: files,
                });
            }),
            this.localEvents.subscribe(event => {
                this._sendEvent({
                    name: 'local_events',
                    data: event,
                });
            }),
            this.filePanelSearchUpdated.subscribe(search => {
                this._sendEvent({
                    name: 'file_panel_search_updated',
                    data: search,
                });
            }),
            this.filePanelOpenChanged.subscribe(open => {
                this._sendEvent({
                    name: 'file_panel_open_changed',
                    data: open,
                });
            }),
            this.filePanelUpdated.subscribe(files => {
                this._sendEvent({
                    name: 'file_panel_updated',
                    data: files,
                });
            }),
            this.recentsUpdated.subscribe(recents => {
                this._sendEvent({
                    name: 'recents_updated',
                    data: recents,
                });
            }),
            this.connectionStateChanged.subscribe(state => {
                this._sendEvent({
                    name: 'connection_state_changed',
                    data: state,
                });
            }),
        ];
    }

    unsubscribe(): void {
        this._sim.unsubscribe();
        this.closed = true;
    }

    closed: boolean;

    async getObjects(): Promise<File[]> {
        return this._sim.helper.objects;
    }

    private _sendEvent(event: SimulationEvents) {
        this._listeners.forEach(l => l(event));
    }

    private _listeners: Map<string, (event: SimulationEvents) => void>;
    private _fileListeners: Map<string, SubscriptionLike>;
    private _sim: Simulation;
    private _subs: SubscriptionLike[];

    constructor(sim: Simulation) {
        super(null);
        this._sim = sim;
        this._listeners = new Map();
        this._fileListeners = new Map();
    }
}
