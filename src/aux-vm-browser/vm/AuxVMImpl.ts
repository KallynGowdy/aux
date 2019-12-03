import { LocalActions, BotAction, AuxOp } from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { wrap, proxy, Remote } from 'comlink';
import {
    AuxConfig,
    AuxVM,
    AuxUser,
    StateUpdatedEvent,
    BotDependentInfo,
} from '@casual-simulation/aux-vm';
import {
    AuxChannel,
    AuxStatic,
    AuxChannelErrorType,
    StoredAux,
} from '@casual-simulation/aux-vm';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import {
    StoredCausalTree,
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
} from '@casual-simulation/causal-trees';
import Bowser from 'bowser';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class AuxVMImpl implements AuxVM {
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _onError: Subject<AuxChannelErrorType>;
    private _config: AuxConfig;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _proxy: Remote<AuxChannel>;
    private _initialUser: AuxUser;
    closed: boolean;

    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * Creates a new Simulation VM.
     */
    constructor(user: AuxUser, config: AuxConfig) {
        this._initialUser = user;
        this._config = config;
        this._localEvents = new Subject<LocalActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    /**
     * Initaializes the VM.
     */
    async init(): Promise<void> {
        return await this._init();
    }

    private async _init(): Promise<void> {
        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Initializing web worker...',
            progress: 0.1,
        });
        this._iframe = document.createElement('iframe');
        this._iframe.src = '/aux-vm-iframe.html';
        this._iframe.style.display = 'none';

        // Allow the iframe to run scripts, but do nothing else.
        // Because we're not allowing the same origin, this prevents the VM from talking to
        // storage like IndexedDB and therefore prevents different VMs from affecting each other.
        this._iframe.sandbox.add('allow-scripts');

        const bowserResult = Bowser.parse(navigator.userAgent);

        // Safari requires the allow-same-origin option in order to load
        // web workers using a blob.
        if (
            bowserResult.browser.name === 'Safari' ||
            bowserResult.os.name === 'iOS'
        ) {
            console.warn('[AuxVMImpl] Adding allow-same-origin for Safari');
            this._iframe.sandbox.add('allow-same-origin');
        }

        let promise = waitForLoad(this._iframe);
        document.body.appendChild(this._iframe);

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Creating VM...',
            progress: 0.2,
        });
        const wrapper = wrap<AuxStatic>(this._channel.port1);
        this._proxy = await new wrapper(
            location.origin,
            this._initialUser,
            this._config
        );

        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._proxy.init(
            proxy(events => this._localEvents.next(events)),
            proxy(events => this._deviceEvents.next(events)),
            proxy(state => this._stateUpdated.next(state)),
            proxy(state =>
                this._connectionStateChanged.next(statusMapper(state))
            ),
            proxy(err => this._onError.next(err))
        );
    }

    /**
     * The observable list of events that should be produced locally.
     */
    get localEvents(): Observable<LocalActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    /**
     * The observable list of bot state updates from this simulation.
     */
    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    setUser(user: AuxUser): Promise<void> {
        return this._proxy.setUser(user);
    }

    setGrant(grant: string): Promise<void> {
        return this._proxy.setGrant(grant);
    }

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    sendEvents(events: BotAction[]): Promise<void> {
        return this._proxy.sendEvents(events);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._proxy.formulaBatch(formulas);
    }

    search(search: string): Promise<any> {
        return this._proxy.search(search);
    }

    forkAux(newId: string): Promise<void> {
        return this._proxy.forkAux(newId);
    }

    exportBots(botIds: string[]): Promise<StoredAux> {
        return this._proxy.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    export(): Promise<StoredAux> {
        return this._proxy.export();
    }

    getReferences(tag: string): Promise<BotDependentInfo> {
        return this._proxy.getReferences(tag);
    }

    getTags(): Promise<string[]> {
        return this._proxy.getTags();
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._channel = null;
        this._proxy = null;
        document.body.removeChild(this._iframe);
        this._iframe = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }
}
