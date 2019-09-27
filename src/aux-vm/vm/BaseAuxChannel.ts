import { Subject, SubscriptionLike } from 'rxjs';
import { tap, first } from 'rxjs/operators';
import { AuxChannel } from './AuxChannel';
import { AuxUser } from '../AuxUser';
import {
    LocalActions,
    BotAction,
    AuxCausalTree,
    fileChangeObservables,
    GLOBALS_FILE_ID,
    isInUsernameList,
    getBotDesignerList,
    shouldDeleteUser,
    botRemoved,
    AuxOp,
    convertToCopiableValue,
    SandboxLibrary,
    Sandbox,
} from '@casual-simulation/aux-common';
import { PrecalculationManager } from '../managers/PrecalculationManager';
import { AuxHelper } from './AuxHelper';
import { AuxConfig } from './AuxConfig';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import {
    StoredCausalTree,
    RealtimeCausalTree,
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
    RemoteAction,
    DeviceInfo,
    ADMIN_ROLE,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { FileDependentInfo } from '../managers/DependencyManager';

export interface AuxChannelOptions {
    sandboxFactory?: (lib: SandboxLibrary) => Sandbox;
}

export abstract class BaseAuxChannel implements AuxChannel, SubscriptionLike {
    protected _helper: AuxHelper;
    protected _precalculation: PrecalculationManager;
    protected _aux: RealtimeCausalTree<AuxCausalTree>;
    protected _config: AuxConfig;
    protected _options: AuxChannelOptions;
    protected _subs: SubscriptionLike[];
    protected _deviceInfo: DeviceInfo;
    private _hasRegisteredSubs: boolean;

    private _user: AuxUser;
    private _onLocalEvents: Subject<LocalActions[]>;
    private _onDeviceEvents: Subject<DeviceAction[]>;
    private _onStateUpdated: Subject<StateUpdatedEvent>;
    private _onConnectionStateChanged: Subject<StatusUpdate>;
    private _onError: Subject<AuxChannelErrorType>;

    get onLocalEvents() {
        return this._onLocalEvents;
    }

    get onDeviceEvents() {
        return this._onDeviceEvents;
    }

    get onStateUpdated() {
        return this._onStateUpdated;
    }

    get onConnectionStateChanged() {
        return this._onConnectionStateChanged;
    }

    get onError() {
        return this._onError;
    }

    get helper() {
        return this._helper;
    }

    protected get user() {
        return this._user;
    }

    constructor(user: AuxUser, config: AuxConfig, options: AuxChannelOptions) {
        this._user = user;
        this._config = config;
        this._options = options;
        this._subs = [];
        this._hasRegisteredSubs = false;
        this._onLocalEvents = new Subject<LocalActions[]>();
        this._onDeviceEvents = new Subject<DeviceAction[]>();
        this._onStateUpdated = new Subject<StateUpdatedEvent>();
        this._onConnectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();

        this._onConnectionStateChanged.subscribe(null, err => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
        this._onStateUpdated.subscribe(null, err => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
        this._onLocalEvents.subscribe(null, err => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
        this._onDeviceEvents.subscribe(null, err => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
    }

    async init(
        onLocalEvents?: (events: LocalActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void
    ): Promise<void> {
        if (onLocalEvents) {
            this.onLocalEvents.subscribe(e => onLocalEvents(e));
        }
        if (onStateUpdated) {
            this.onStateUpdated.subscribe(s => onStateUpdated(s));
        }
        if (onConnectionStateChanged) {
            this.onConnectionStateChanged.subscribe(s =>
                onConnectionStateChanged(s)
            );
        }
        if (onDeviceEvents) {
            this.onDeviceEvents.subscribe(e => onDeviceEvents(e));
        }
        // if (onError) {
        //     this.onError.subscribe(onError);
        // }

        return await this._init();
    }

    async initAndWait(
        onLocalEvents?: (events: LocalActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void
    ) {
        const promise = this.onConnectionStateChanged
            .pipe(first(s => s.type === 'init'))
            .toPromise();
        await this.init(
            onLocalEvents,
            onDeviceEvents,
            onStateUpdated,
            onConnectionStateChanged,
            onError
        );
        await promise;
    }

    private async _init(): Promise<void> {
        this._handleStatusUpdated({
            type: 'progress',
            message: 'Creating causal tree...',
            progress: 0.1,
        });
        this._aux = await this._createRealtimeCausalTree();

        let statusMapper = remapProgressPercent(0.3, 0.6);
        this._subs.push(
            this._aux,
            this._aux.onError.subscribe(err => this._handleError(err)),
            this._aux.onRejected.subscribe(rejected => {
                rejected.forEach(r => {
                    console.warn('[AuxChannel] Atom Rejected', r);
                });
            }),
            this._aux.statusUpdated
                .pipe(
                    tap(state => this._handleStatusUpdated(statusMapper(state)))
                )
                .subscribe(null, (e: any) => console.error(e)),
            this._aux.events
                .pipe(tap(events => this._handleServerEvents(events)))
                .subscribe(null, (e: any) => console.error(e))
        );

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Initializing causal tree...',
            progress: 0.2,
        });
        await this._initRealtimeCausalTree();

        return null;
    }

    /**
     * Initializes the aux.
     * @param loadingProgress The loading progress.
     */
    protected async _initAux() {
        this._handleStatusUpdated({
            type: 'progress',
            message: 'Removing old users...',
            progress: 0.7,
        });
        await this._deleteOldUserFiles();

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Initializing user bot...',
            progress: 0.8,
        });
        await this._initUserFile();

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Launching interface...',
            progress: 0.9,
        });
        await this._initGlobalsFile();
    }

    async setUser(user: AuxUser): Promise<void> {
        this._user = user;

        if (this.user && this._helper) {
            this._helper.userId = this.user.id;
            await this._initUserFile();
        }
    }

    async sendEvents(events: BotAction[]): Promise<void> {
        await this._helper.transaction(...events);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        return this._helper.formulaBatch(formulas);
    }

    async search(search: string): Promise<any> {
        return convertToCopiableValue(this._helper.search(search));
    }

    async forkAux(newId: string): Promise<any> {
        throw new Error('Not Implemented');
    }

    abstract setGrant(grant: string): Promise<void>;

    async exportFiles(botIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return this._helper.exportFiles(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._aux.tree.export();
    }

    async getReferences(tag: string): Promise<FileDependentInfo> {
        return this._precalculation.dependencies.getDependents(tag);
    }

    async getTags(): Promise<string[]> {
        return this._helper.getTags();
    }

    /**
     * Sends the given list of remote events to their destinations.
     * @param events The events.
     */
    protected abstract _sendRemoteEvents(events: RemoteAction[]): Promise<void>;

    protected _createAuxHelper() {
        let helper = new AuxHelper(
            this._aux.tree,
            this._config.config,
            this._options.sandboxFactory
        );
        helper.userId = this.user ? this.user.id : null;
        return helper;
    }

    protected _registerSubscriptions() {
        const { botsAdded, botsRemoved, botsUpdated } = fileChangeObservables(
            this._aux
        );

        this._subs.push(
            this._helper.localEvents.subscribe(
                e => this._handleLocalEvents(e),
                (e: any) => console.error(e)
            ),
            this._helper.deviceEvents.subscribe(
                e => this._handleDeviceEvents(e),
                (e: any) => console.error(e)
            ),
            this._helper.remoteEvents.subscribe(e => {
                this._sendRemoteEvents(e);
            }),
            botsAdded
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._handleStateUpdated(
                            this._precalculation.botsAdded(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            botsRemoved
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._handleStateUpdated(
                            this._precalculation.botsRemoved(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            botsUpdated
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._handleStateUpdated(
                            this._precalculation.botsUpdated(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e))
        );
    }

    protected async _ensureSetup() {
        console.log('[AuxChannel] Got Tree:', this._aux.tree.site.id);
        if (!this._helper) {
            this._helper = this._createAuxHelper();
        }
        if (!this._precalculation) {
            this._precalculation = this._createPrecalculationManager();
        }

        await this._initAux();

        if (!this._checkAccessAllowed()) {
            this._onConnectionStateChanged.next({
                type: 'authorization',
                authorized: false,
                reason: 'unauthorized',
            });
            return;
        }

        if (!this._hasRegisteredSubs) {
            this._hasRegisteredSubs = true;
            this._registerSubscriptions();
        }

        this._onConnectionStateChanged.next({
            type: 'init',
        });
    }

    protected async _handleStatusUpdated(state: StatusUpdate) {
        if (state.type === 'authentication') {
            this._deviceInfo = state.info;
        } else if (state.type === 'sync' && state.synced) {
            await this._ensureSetup();
        }

        this._onConnectionStateChanged.next(state);
    }

    /**
     * Decides what to do with device events from the server.
     * By default the events are processed as-is.
     * This means that the onDeviceEvents observable will be triggered so that
     * other components can decide what to do.
     * @param events The events.
     */
    protected async _handleServerEvents(events: DeviceAction[]) {
        await this.sendEvents(events);
    }

    protected _handleStateUpdated(event: StateUpdatedEvent) {
        this._onStateUpdated.next(event);
    }

    protected _handleError(error: any) {
        this._onError.next(error);
    }

    protected async _initRealtimeCausalTree(): Promise<void> {
        await this._aux.connect();
        // await this._aux.waitUntilSynced();
    }

    protected abstract _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    >;

    protected _createPrecalculationManager(): PrecalculationManager {
        return new PrecalculationManager(
            () => this._aux.tree.value,
            () => this._helper.createContext()
        );
    }

    protected _handleLocalEvents(e: LocalActions[]) {
        this._onLocalEvents.next(e);
    }

    protected _handleDeviceEvents(e: DeviceAction[]) {
        this._onDeviceEvents.next(e);
    }

    private async _initUserFile() {
        if (!this.user) {
            console.warn(
                '[BaseAuxChannel] Not initializing user bot because user is null'
            );
            return;
        }
        const userFile = this._helper.userFile;
        await this._helper.createOrUpdateUserFile(this.user, userFile);
    }

    private async _deleteOldUserFiles() {
        let events: BotAction[] = [];
        for (let bot of this._helper.objects) {
            if (bot.tags['aux._user'] && shouldDeleteUser(bot)) {
                console.log('[BaseAuxChannel] Removing User', bot.id);
                events.push(botRemoved(bot.id));
            }
        }

        await this._helper.transaction(...events);
    }

    private async _initGlobalsFile() {
        let globalsFile = this._helper.globalsFile;
        if (!globalsFile) {
            const oldGlobalsFile = this._helper.botsState['globals'];
            if (oldGlobalsFile) {
                await this._helper.createBot(
                    GLOBALS_FILE_ID,
                    oldGlobalsFile.tags
                );
            } else {
                await this._createGlobalsFile();
            }
        }
    }

    protected async _createGlobalsFile() {
        await this._helper.createGlobalsFile(GLOBALS_FILE_ID);
    }

    /**
     * Checks if the current user is allowed access to the simulation.
     */
    _checkAccessAllowed(): boolean {
        if (!this._helper.userFile || !this._deviceInfo) {
            return false;
        }

        if (
            this._deviceInfo.roles.indexOf(ADMIN_ROLE) >= 0 ||
            this._deviceInfo.roles.indexOf(SERVER_ROLE) >= 0
        ) {
            return true;
        }

        const calc = this._helper.createContext();
        const username = this._helper.userFile.tags['aux._user'];
        const bot = this._helper.globalsFile;

        if (this._config.config.isBuilder) {
            const designers = getBotDesignerList(calc, bot);
            if (designers) {
                if (!isInUsernameList(calc, bot, 'aux.designers', username)) {
                    return false;
                } else {
                    return true;
                }
            }
        }

        return true;
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._subs.forEach(s => s.unsubscribe());
    }

    closed: boolean;
}
