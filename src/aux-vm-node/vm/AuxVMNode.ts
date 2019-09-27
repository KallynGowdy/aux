import {
    AuxVM,
    StateUpdatedEvent,
    AuxChannelErrorType,
    BotDependentInfo,
} from '@casual-simulation/aux-vm';
import { Observable, Subject } from 'rxjs';
import { LocalActions, BotAction, AuxOp } from '@casual-simulation/aux-common';
import {
    StoredCausalTree,
    LoadingProgressCallback,
    StatusUpdate,
    DeviceAction,
} from '@casual-simulation/causal-trees';
import { AuxUser, BaseAuxChannel } from '@casual-simulation/aux-vm';

export class AuxVMNode implements AuxVM {
    private _channel: BaseAuxChannel;
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _onError: Subject<AuxChannelErrorType>;

    id: string;

    get localEvents(): Observable<LocalActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    constructor(channel: BaseAuxChannel) {
        this._channel = channel;
        this._localEvents = new Subject<LocalActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
    }

    setUser(user: AuxUser): Promise<void> {
        return this._channel.setUser(user);
    }

    setGrant(grant: string): Promise<void> {
        return this._channel.setGrant(grant);
    }

    sendEvents(events: BotAction[]): Promise<void> {
        return this._channel.sendEvents(events);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._channel.formulaBatch(formulas);
    }

    search(search: string): Promise<any> {
        return this._channel.search(search);
    }

    forkAux(newId: string): Promise<void> {
        return this._channel.forkAux(newId);
    }

    exportBots(botIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return this._channel.exportBots(botIds);
    }

    exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._channel.exportTree();
    }

    getReferences(tag: string): Promise<BotDependentInfo> {
        return this._channel.getReferences(tag);
    }

    getTags(): Promise<string[]> {
        return this._channel.getTags();
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        return await this._channel.initAndWait(
            e => this._localEvents.next(e),
            e => this._deviceEvents.next(e),
            state => this._stateUpdated.next(state),
            connection => this._connectionStateChanged.next(connection),
            err => this._onError.next(err)
        );
    }

    unsubscribe(): void {
        this.closed = true;
        this._channel.unsubscribe();
    }
    closed: boolean;
}
