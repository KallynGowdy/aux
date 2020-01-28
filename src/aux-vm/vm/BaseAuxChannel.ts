import { Subject, SubscriptionLike } from 'rxjs';
import { tap, first } from 'rxjs/operators';
import { AuxChannel } from './AuxChannel';
import { AuxUser } from '../AuxUser';
import {
    LocalActions,
    BotAction,
    AuxCausalTree,
    botChangeObservables,
    GLOBALS_BOT_ID,
    isInUsernameList,
    botRemoved,
    AuxOp,
    convertToCopiableValue,
    SandboxLibrary,
    Sandbox,
    atomsToDiff,
    botAdded,
    botUpdated,
    Bot,
    AuxOpType,
    createBot,
    getAtomBot,
    getAtomTag,
    tagsOnBot,
    ON_ACTION_ACTION_NAME,
    BotTags,
    atomToEvent,
    BotsState,
    BOT_SPACE_TAG,
} from '@casual-simulation/aux-common';
import { PrecalculationManager } from '../managers/PrecalculationManager';
import { AuxHelper } from './AuxHelper';
import { AuxConfig, buildFormulaLibraryOptions } from './AuxConfig';
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
    RealtimeCausalTreeOptions,
    Atom,
    Action,
} from '@casual-simulation/causal-trees';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { BotDependentInfo } from '../managers/DependencyManager';
import intersection from 'lodash/intersection';
import difference from 'lodash/difference';
import mapValues from 'lodash/mapValues';
import {
    AuxPartitions,
    CausalTreePartition,
    MemoryPartition,
    AuxPartition,
    iteratePartitions,
} from '../partitions/AuxPartition';
import { PartitionConfig } from '../partitions/AuxPartitionConfig';
import { StatusHelper } from './StatusHelper';
import { StoredAux } from '../StoredAux';
import pick from 'lodash/pick';
import flatMap from 'lodash/flatMap';

export interface AuxChannelOptions {
    sandboxFactory?: (lib: SandboxLibrary) => Sandbox;
}

export abstract class BaseAuxChannel implements AuxChannel, SubscriptionLike {
    protected _helper: AuxHelper;
    protected _precalculation: PrecalculationManager;
    protected _config: AuxConfig;
    protected _options: AuxChannelOptions;
    protected _subs: SubscriptionLike[];
    protected _deviceInfo: DeviceInfo;
    protected _partitions: AuxPartitions;
    private _statusHelper: StatusHelper;
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

        this._partitions = <any>{};
        let partitions: AuxPartition[] = [];
        for (let key in this._config.partitions) {
            if (!this._config.partitions.hasOwnProperty(key)) {
                continue;
            }
            const partition = await this._createPartition(
                this._config.partitions[key]
            );
            if (partition) {
                this._partitions[key] = partition;
                partitions.push(partition);
            } else {
                throw new Error(
                    `[BaseAuxChannel] Unable to build partition: ${key}`
                );
            }
        }

        this._statusHelper = new StatusHelper(
            partitions.map(p => p.onStatusUpdated)
        );

        let statusMapper = remapProgressPercent(0.3, 0.6);
        this._subs.push(
            this._statusHelper,
            this._statusHelper.updates
                .pipe(
                    tap(state => this._handleStatusUpdated(statusMapper(state)))
                )
                .subscribe(null, (e: any) => console.error(e)),
            ...flatMap(partitions, p =>
                this._getCleanupSubscriptionsForPartition(p)
            )
        );

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Initializing causal tree...',
            progress: 0.2,
        });
        for (let partition of partitions) {
            partition.connect();
        }
        return null;
    }

    protected _getCleanupSubscriptionsForPartition(
        partition: AuxPartition
    ): SubscriptionLike[] {
        return [
            partition,
            partition.onError.subscribe(err => this._handleError(err)),
            partition.onEvents
                .pipe(tap(events => this._handlePartitionEvents(events)))
                .subscribe(null, (e: any) => console.error(e)),
        ];
    }

    /**
     * Creates a partition for the given config.
     * @param config The config.
     */
    protected abstract _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition>;

    /**
     * Initializes the aux.
     * @param loadingProgress The loading progress.
     */
    protected async _initAux() {
        this._handleStatusUpdated({
            type: 'progress',
            message: 'Initializing user bot...',
            progress: 0.8,
        });
        await this._initUserBot();

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Launching interface...',
            progress: 0.9,
        });
        await this._initGlobalsBot();
        await this._initUserDimensionBot();
    }

    async setUser(user: AuxUser): Promise<void> {
        for (let [key, partition] of iteratePartitions(this._partitions)) {
            if (partition.setUser) {
                await partition.setUser(user);
            }
        }

        this._user = user;

        if (this.user && this._helper) {
            this._helper.userId = this.user.id;
            await this._initUserBot();
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
        console.log('[BaseAuxChannel] Forking AUX');
        let events: BotAction[] = [];
        const globals = this._helper.globalsBot;
        if (globals) {
            console.log('[BaseAuxChannel] Cleaning Config bot.');
            let badTags = tagsOnBot(globals).filter(tag => {
                return tag === ON_ACTION_ACTION_NAME;
            });
            let tags: BotTags = {};
            for (let tag of badTags) {
                console.log(`[BaseAuxChannel] Removing ${tag} tag.`);
                tags[tag] = null;
            }
            events.push(
                botUpdated(globals.id, {
                    tags: tags,
                })
            );
        }

        for (let [key, partition] of iteratePartitions(this._partitions)) {
            if ('fork' in partition) {
                await partition.fork(newId, events);
            }
        }
        console.log('[BaseAuxChannel] Finished');
    }

    async setGrant(grant: string): Promise<void> {
        for (let [key, partition] of iteratePartitions(this._partitions)) {
            if (partition.setGrant) {
                await partition.setGrant(grant);
            }
        }
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        return this._helper.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        let final: BotsState = {};
        const state = this._helper.publicBotsState;

        for (let key in state) {
            const bot = state[key];
            final[key] = pick(bot, 'id', 'tags', BOT_SPACE_TAG);
        }

        return {
            version: 1,
            state: final,
        };
    }

    async getReferences(tag: string): Promise<BotDependentInfo> {
        return this._precalculation.dependencies.getDependents(tag);
    }

    async getTags(): Promise<string[]> {
        return this._helper.getTags();
    }

    /**
     * Sends the given list of remote events to their destinations.
     * @param events The events.
     */
    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        for (let [key, partition] of iteratePartitions(this._partitions)) {
            if (partition.sendRemoteEvents) {
                await partition.sendRemoteEvents(events);
            }
        }
    }

    protected _createAuxHelper() {
        const partitions: any = this._partitions;
        let helper = new AuxHelper(
            partitions,
            buildFormulaLibraryOptions(this._config.config),
            this._options.sandboxFactory
        );
        helper.userId = this.user ? this.user.id : null;
        return helper;
    }

    protected _registerSubscriptions() {
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
            })
        );
        for (let [key, partition] of iteratePartitions(this._partitions)) {
            this._registerStateSubscriptionsForPartition(partition);
        }
    }

    protected _registerStateSubscriptionsForPartition(partition: AuxPartition) {
        this._subs.push(
            partition.onBotsAdded
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
            partition.onBotsRemoved
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
            partition.onBotsUpdated
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
        // console.log('[AuxChannel] Got Tree:', this._aux.tree.site.id);
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

        console.log('[BaseAuxChannel] Sending init event');
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
     * Decides what to do with device events from partitions.
     * By default the events are processed as-is.
     * This means that the events are sent directly to the AuxHelper via this.sendEvents().
     * @param events The events.
     */
    protected async _handlePartitionEvents(events: Action[]) {
        const actions = <BotAction[]>events;
        await this.sendEvents(actions);
    }

    protected _handleStateUpdated(event: StateUpdatedEvent) {
        this._onStateUpdated.next(event);
    }

    protected _handleError(error: any) {
        this._onError.next(error);
    }

    protected _createPrecalculationManager(): PrecalculationManager {
        return new PrecalculationManager(
            () => this._helper.botsState,
            () => this._helper.createContext()
        );
    }

    protected _handleLocalEvents(e: LocalActions[]) {
        for (let event of e) {
            if (event.type === 'load_space') {
                this._loadPartition(event.space, event.config);
            }
        }
        this._onLocalEvents.next(e);
    }

    protected _handleDeviceEvents(e: DeviceAction[]) {
        this._onDeviceEvents.next(e);
    }

    protected async _loadPartition(space: string, config: PartitionConfig) {
        if (space in this._partitions) {
            console.log(
                `[BaseAuxChannel] Cannot load partition for "${space}" since the space is already occupied`
            );
            return;
        }

        let partition = await this._createPartition(config);
        if (!partition) {
            return;
        }

        this._partitions[space] = partition;
        this.helper.addPartition(space, partition);
        this._subs.push(
            ...this._getCleanupSubscriptionsForPartition(partition)
        );

        partition.connect();

        if (this._hasRegisteredSubs) {
            this._registerStateSubscriptionsForPartition(partition);
        }
    }

    private async _initUserBot() {
        if (!this.user) {
            console.warn(
                '[BaseAuxChannel] Not initializing user bot because user is null. (User needs to be specified)'
            );
            return;
        }
        try {
            const userBot = this._helper.userBot;
            console.log('[BaseAuxChannel] Init User bot', userBot);
            await this._helper.createOrUpdateUserBot(this.user, userBot);
        } catch (err) {
            console.error('[BaseAuxChannel] Unable to init user bot:', err);
        }
    }

    private async _initGlobalsBot() {
        try {
            let globalsBot = this._helper.globalsBot;
            if (!globalsBot) {
                const oldGlobalsBot = this._helper.botsState['globals'];
                if (oldGlobalsBot) {
                    await this._helper.createBot(
                        GLOBALS_BOT_ID,
                        oldGlobalsBot.tags
                    );
                } else {
                    await this._createGlobalsBot();
                }
            }
        } catch (err) {
            console.error('[BaseAuxChannel] Unable to init globals bot:', err);
        }
    }

    private async _initUserDimensionBot() {
        try {
            await this._helper.createOrUpdateUserDimensionBot();
        } catch (err) {
            console.error(
                '[BaseAuxChannel] Unable to init user dimension bot:',
                err
            );
        }
    }

    protected async _createGlobalsBot() {
        await this._helper.createGlobalsBot(GLOBALS_BOT_ID);
    }

    /**
     * Checks if the current user is allowed access to the simulation.
     */
    _checkAccessAllowed(): boolean {
        for (let [key, partition] of iteratePartitions(this._partitions)) {
            if (partition.type === 'causal_tree') {
                if (partition.tree.weave.atoms.length === 0) {
                    return true;
                }
            }
        }

        if (!this._helper.userBot) {
            return false;
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

export function filterAtomFactory(
    getHelper: () => AuxHelper
): (tree: AuxCausalTree, atom: Atom<AuxOp>) => boolean {
    return (tree, atom) => filterAtom(tree, atom, getHelper);
}

export function filterAtom(
    tree: AuxCausalTree,
    atom: Atom<AuxOp>,
    getHelper: () => AuxHelper
): boolean {
    if (!tree || tree.site.id === atom.id.site) {
        return true;
    }

    let helper = getHelper();

    if (helper) {
        let event: BotAction = atomToEvent(atom, tree);

        if (event) {
            const events = [event];
            const final = helper.resolveEvents(events);
            const allowed = intersection(final, events);
            const added = difference(final, events);

            if (added.length > 0) {
                helper.transaction(...added);
            }

            return allowed.length === events.length;
        } else {
            return true;
        }
    } else {
        return true;
    }
}
