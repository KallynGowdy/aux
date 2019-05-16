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
import { FilesUpdatedEvent } from './FilePanelManager';
import { RecentsUpdatedEvent } from './RecentFilesManager';
import { User } from './User';
import { FileManager } from './FileManager';

export class AsyncSimulationWrapper extends AsyncCalculationContextWrapper
    implements AsyncSimulation {
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

    userFileChanged(): Observable<AuxObject> {
        return this.fileChanged(this._sim.helper.userFile);
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

    async init(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        loadingCallback?: LoadingProgressCallback
    ): Promise<void> {
        this._sim = new FileManager(user, id, config);
        await this._sim.init(loadingCallback);
    }

    unsubscribe(): void {
        this._sim.unsubscribe();
        this.closed = true;
    }

    closed: boolean;

    async getObjects(): Promise<File[]> {
        return this._sim.helper.objects;
    }

    private _sim: Simulation;

    constructor() {
        super(null);
    }
}
