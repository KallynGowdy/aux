import { AuxVM } from '../AuxVM';
import { Observable, Subject } from 'rxjs';
import { StateUpdatedEvent } from '../../managers/StateUpdatedEvent';
import { AuxChannelErrorType } from '../AuxChannelErrorTypes';
import { Remote } from 'comlink';
import {
    AuxCausalTree,
    LocalEvents,
    FileEvent,
    PrecalculatedFilesState,
    FilesState,
    createCalculationContext,
    merge,
    AuxObject,
    searchFileState,
    AuxOp,
    getActiveObjects,
    tagsOnFile,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    StoredCausalTree,
    site,
    RealtimeCausalTree,
    StatusUpdate,
    DeviceEvent,
} from '@casual-simulation/causal-trees';
import { PrecalculationManager } from '../../managers/PrecalculationManager';
import { values, union } from 'lodash';
import { AuxUser } from '../../AuxUser';
import { FileDependentInfo } from '../../managers/DependencyManager';

export class TestAuxVM implements AuxVM {
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _precalculator: PrecalculationManager;

    events: FileEvent[];
    formulas: string[];

    id: string;

    processEvents: boolean;
    state: FilesState;
    localEvents: Observable<LocalEvents[]>;
    deviceEvents: Observable<DeviceEvent[]>;
    connectionStateChanged: Subject<StatusUpdate>;
    onError: Subject<AuxChannelErrorType>;
    grant: string;
    user: AuxUser;

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    constructor(userId: string = 'user') {
        this.events = [];
        this.formulas = [];

        this.processEvents = false;
        this.state = {};
        this._precalculator = new PrecalculationManager(
            () => this.state,
            () => createCalculationContext(values(this.state), userId)
        );
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this.connectionStateChanged = new Subject<StatusUpdate>();
        this.onError = new Subject<AuxChannelErrorType>();
    }

    async setUser(user: AuxUser): Promise<void> {
        this.user = user;
    }
    async setGrant(grant: string): Promise<void> {
        this.grant = grant;
    }

    async sendEvents(events: FileEvent[]): Promise<void> {
        this.events.push(...events);

        if (this.processEvents) {
            let added = [];
            let removed = [];
            let updated = [];

            for (let event of events) {
                if (event.type === 'file_added') {
                    this.state[event.file.id] = event.file;
                    added.push(<AuxObject>event.file);
                } else if (event.type === 'file_removed') {
                    delete this.state[event.id];
                    removed.push(event.id);
                } else if (event.type === 'file_updated') {
                    this.state[event.id] = merge(
                        this.state[event.id],
                        event.update
                    );
                    updated.push({
                        file: <AuxObject>this.state[event.id],
                        tags: Object.keys(event.update.tags),
                    });
                }
            }

            if (added.length > 0) {
                this._stateUpdated.next(this._precalculator.filesAdded(added));
            }
            if (removed.length > 0) {
                this._stateUpdated.next(
                    this._precalculator.filesRemoved(removed)
                );
            }
            if (updated.length > 0) {
                this._stateUpdated.next(
                    this._precalculator.filesUpdated(updated)
                );
            }
        }
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        this.formulas.push(...formulas);
    }

    async init(loadingCallback?: any): Promise<void> {}

    async search(search: string): Promise<any> {
        return searchFileState(search, this._precalculator.filesState);
    }

    async forkAux(newId: string): Promise<void> {}

    async exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return storedTree(site(1));
    }

    async exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return storedTree(site(1));
    }

    async getRealtimeTree(): Promise<
        Remote<RealtimeCausalTree<AuxCausalTree>>
    > {
        return null;
    }

    async getReferences(tag: string): Promise<FileDependentInfo> {
        return this._precalculator.dependencies.getDependents(tag);
    }

    async getTags(): Promise<string[]> {
        let objects = getActiveObjects(this.state);
        let allTags = union(...objects.map(o => tagsOnFile(o))).sort();
        return allTags;
    }

    sendState(update: StateUpdatedEvent) {
        this._stateUpdated.next(update);
    }

    unsubscribe(): void {}
    closed: boolean;
}
