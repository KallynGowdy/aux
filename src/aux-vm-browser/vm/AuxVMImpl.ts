import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    BotDependentInfo,
    ProxyBridgePartitionImpl,
    RuntimeStateVersion,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { wrap, proxy, Remote, expose, transfer } from 'comlink';
import {
    AuxConfig,
    AuxVM,
    AuxUser,
    ChannelActionResult,
} from '@casual-simulation/aux-vm';
import {
    AuxChannel,
    AuxStatic,
    AuxChannelErrorType,
    StoredAux,
} from '@casual-simulation/aux-vm';
import { loadScript, registerIFramePortal, setupChannel, waitForLoad } from '../html/IFrameHelpers';
import {
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import Bowser from 'bowser';
import axios from 'axios';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class AuxVMImpl implements AuxVM {
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _onError: Subject<AuxChannelErrorType>;
    private _config: AuxConfig;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _proxy: Remote<AuxChannel>;
    private _initialUser: AuxUser;
    private _manifest: { [key: string]: string };
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
        this._versionUpdated = new Subject<RuntimeStateVersion>();
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
        const origin = this._config.config.vmOrigin || location.origin;
        const iframeUrl = new URL('/aux-vm-iframe.html', origin).href;

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Getting web manifest...',
            progress: 0.05,
        });

        await this._initManifest();

        // TODO: Decide which origin to use
        const workerUrl = new URL(this._manifest['worker.js'], location.origin)
            .href;

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Initializing web worker...',
            progress: 0.1,
        });
        this._iframe = document.createElement('iframe');
        this._iframe.src = iframeUrl;
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
        document.body.insertBefore(this._iframe, document.body.firstChild);

        await promise;

        await loadScript(this._iframe.contentWindow, workerUrl);

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
            processPartitions(this._config)
        );

        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._proxy.init(
            proxy((events) => this._localEvents.next(events)),
            proxy((events) => this._deviceEvents.next(events)),
            proxy((state) => this._stateUpdated.next(state)),
            proxy((version) => this._versionUpdated.next(version)),
            proxy((state) =>
                this._connectionStateChanged.next(statusMapper(state))
            ),
            proxy((err) => this._onError.next(err))
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

    get versionUpdated(): Observable<RuntimeStateVersion> {
        return this._versionUpdated;
    }

    async setUser(user: AuxUser): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.setUser(user);
    }

    async setGrant(grant: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.setGrant(grant);
    }

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    async sendEvents(events: BotAction[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.sendEvents(events);
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * Returns the results from the event.
     * @param eventName The name of the event.
     * @param botIds The IDs of the bots that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        if (!this._proxy) return null;
        return await this._proxy.shout(eventName, botIds, arg);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.forkAux(newId);
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.export();
    }

    async getReferences(tag: string): Promise<BotDependentInfo> {
        if (!this._proxy) return null;
        return await this._proxy.getReferences(tag);
    }

    async getTags(): Promise<string[]> {
        if (!this._proxy) return null;
        return await this._proxy.getTags();
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

    async registerCustomPortal(id: string, source: string): Promise<void> {
        if (!this._iframe) {
            console.warn('[AuxVMImpl] Not initalized!');
            return;
        }

        await registerIFramePortal(this._iframe.contentWindow, id, source);
        console.log(`[AuxVMImpl] Registered portal: ${id}`);
    }

    private async _initManifest() {
        console.log('[AuxVMImpl] Fetching manifest...');
        this._manifest = await this._getManifest();
        await this._saveConfig();
        if (!this._config) {
            console.warn(
                '[AuxVMImpl] Manifest not able to be fetched from the server or local storage.'
            );
        }
    }

    private async _getManifest(): Promise<any> {
        const serverConfig = await this._fetchManifestFromServer();
        if (serverConfig) {
            return serverConfig;
        } else {
            return await this._fetchConfigFromLocalStorage();
        }
    }

    private async _fetchManifestFromServer(): Promise<any> {
        try {
            const result = await axios.get<any>(`/api/manifest`);
            if (result.status === 200) {
                return result.data;
            } else {
                console.error(
                    '[AuxVMImpl] Unable to fetch manifest from server.'
                );
                return null;
            }
        } catch (err) {
            console.error(
                '[AuxVMImpl] Unable to fetch manifest from server: ',
                err
            );
            return null;
        }
    }

    private async _saveConfig() {
        try {
            if (this._manifest) {
                globalThis.localStorage.setItem(
                    'manifest',
                    JSON.stringify(this._manifest)
                );
            } else {
                globalThis.localStorage.removeItem('manifest');
            }
        } catch (err) {
            console.error('Unable to save manifest: ', err);
        }
    }

    private async _fetchConfigFromLocalStorage(): Promise<any> {
        try {
            const val = globalThis.localStorage.getItem('manifest');
            if (val) {
                return JSON.parse(val);
            } else {
                console.error(
                    '[AuxVMImpl] Unable to fetch manifest from storage.'
                );
                return null;
            }
        } catch (err) {
            console.error(
                '[AuxVMImpl] Unable to fetch manifest from storage',
                err
            );
            return null;
        }
    }
}

function processPartitions(config: AuxConfig): AuxConfig {
    let transferrables = [] as any[];
    for (let key in config.partitions) {
        const partition = config.partitions[key];
        if (partition.type === 'proxy') {
            const bridge = new ProxyBridgePartitionImpl(partition.partition);
            const channel = new MessageChannel();
            expose(bridge, channel.port1);
            transferrables.push(channel.port2);
            config.partitions[key] = {
                type: 'proxy_client',
                editStrategy: partition.partition.realtimeStrategy,
                private: partition.partition.private,
                port: channel.port2,
            };
        }
    }
    return transfer(config, transferrables);
}
