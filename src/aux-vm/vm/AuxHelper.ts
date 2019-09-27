import {
    AuxCausalTree,
    SandboxLibrary,
    LocalActions,
    BotsState,
    getActiveObjects,
    createCalculationContext,
    BotCalculationContext,
    AuxFile,
    BotAction,
    createBot,
    Bot,
    updateBot,
    PartialFile,
    merge,
    AUX_FILE_VERSION,
    calculateFormulaEvents,
    calculateActionEvents,
    BotSandboxContext,
    DEFAULT_USER_MODE,
    PasteStateAction,
    getBotConfigContexts,
    createWorkspace,
    createContextId,
    duplicateBot,
    cleanBot,
    addState,
    Sandbox,
    SandboxFactory,
    searchFileState,
    AuxOp,
    createFormulaLibrary,
    FormulaLibraryOptions,
    addToContextDiff,
    botAdded,
    getBotPosition,
    getContexts,
    filterWellKnownAndContextTags,
    tagsOnBot,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    StoredCausalTree,
    RemoteAction,
    DeviceAction,
} from '@casual-simulation/causal-trees';
import { Subject, Observable } from 'rxjs';
import { flatMap, fromPairs, union, sortBy } from 'lodash';
import { BaseHelper } from '../managers/BaseHelper';
import { AuxUser } from '../AuxUser';

/**
 * Definesa a class that contains a set of functions to help an AuxChannel
 * run formulas and process bot events.
 */
export class AuxHelper extends BaseHelper<AuxFile> {
    private static readonly _debug = false;
    private _tree: AuxCausalTree;
    private _lib: SandboxLibrary;
    private _localEvents: Subject<LocalActions[]>;
    private _remoteEvents: Subject<RemoteAction[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _sandboxFactory: SandboxFactory;

    /**
     * Creates a new bot helper.
     * @param tree The tree that the bot helper should use.
     */
    constructor(
        tree: AuxCausalTree,
        config?: FormulaLibraryOptions['config'],
        sandboxFactory?: (lib: SandboxLibrary) => Sandbox
    ) {
        super();
        this._localEvents = new Subject<LocalActions[]>();
        this._remoteEvents = new Subject<RemoteAction[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._sandboxFactory = sandboxFactory;

        this._tree = tree;
        this._lib = createFormulaLibrary({ config });
    }

    /**
     * Gets the current local bot state.
     */
    get botsState() {
        return this._tree.value;
    }

    get localEvents() {
        return this._localEvents;
    }

    get remoteEvents() {
        return this._remoteEvents;
    }

    get deviceEvents() {
        return this._deviceEvents;
    }

    /**
     * Creates a new BotCalculationContext from the current state.
     */
    createContext(): BotSandboxContext {
        return createCalculationContext(
            this.objects,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: BotAction[]): Promise<void> {
        const allEvents = this._flattenEvents(events);
        await this._tree.addEvents(allEvents);
        this._sendOtherEvents(allEvents);
    }

    /**
     * Creates a new bot with the given ID and tags. Returns the ID of the new bot.
     * @param id (Optional) The ID that the bot should have.
     * @param tags (Optional) The tags that the bot should have.
     */
    async createBot(id?: string, tags?: Bot['tags']): Promise<string> {
        if (AuxHelper._debug) {
            console.log('[AuxHelper] Create Bot');
        }

        const bot = createBot(id, tags);
        await this._tree.addFile(bot);

        return bot.id;
    }

    /**
     * Updates the given bot with the given data.
     * @param bot The bot.
     * @param newData The new data that the bot should have.
     */
    async updateBot(bot: AuxFile, newData: PartialFile): Promise<void> {
        updateBot(bot, this.userFile ? this.userFile.id : null, newData, () =>
            this.createContext()
        );

        await this._tree.updateBot(bot, newData);
    }

    /**
     * Creates a new globals bot.
     * @param botId The ID of the bot to create. If not specified a new ID will be generated.
     */
    async createGlobalsFile(botId?: string) {
        const workspace = createBot(botId, {});

        const final = merge(workspace, {
            tags: {
                'aux.version': AUX_FILE_VERSION,
                'aux.destroyable': false,
            },
        });

        await this._tree.addFile(final);
    }

    /**
     * Creates or updates the user bot for the given user.
     * @param user The user that the bot is for.
     * @param userFile The bot to update. If null or undefined then a bot will be created.
     */
    async createOrUpdateUserFile(user: AuxUser, userFile: AuxFile) {
        const userContext = `_user_${user.username}_${this._tree.site.id}`;
        const userInventoryContext = `_user_${user.username}_inventory`;
        const userMenuContext = `_user_${user.username}_menu`;
        const userSimulationsContext = `_user_${user.username}_simulations`;
        if (!userFile) {
            await this.createBot(user.id, {
                [userContext]: true,
                ['aux.context']: userContext,
                ['aux.context.visualize']: true,
                ['aux._user']: user.username,
                ['aux._userInventoryContext']: userInventoryContext,
                ['aux._userMenuContext']: userMenuContext,
                ['aux._userSimulationsContext']: userSimulationsContext,
                'aux._mode': DEFAULT_USER_MODE,
            });
        } else {
            if (!userFile.tags['aux._userMenuContext']) {
                await this.updateBot(userFile, {
                    tags: {
                        ['aux._userMenuContext']: userMenuContext,
                    },
                });
            }
            if (!userFile.tags['aux._userInventoryContext']) {
                await this.updateBot(userFile, {
                    tags: {
                        ['aux._userInventoryContext']: userInventoryContext,
                    },
                });
            }
            if (!userFile.tags['aux._userSimulationsContext']) {
                await this.updateBot(userFile, {
                    tags: {
                        ['aux._userSimulationsContext']: userSimulationsContext,
                    },
                });
            }
        }
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        const state = this.botsState;
        let events = flatMap(formulas, f =>
            calculateFormulaEvents(
                state,
                f,
                this.userId,
                undefined,
                this._sandboxFactory,
                this._lib
            )
        );
        await this.transaction(...events);
    }

    search(search: string) {
        return searchFileState(
            search,
            this.botsState,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
    }

    getTags(): string[] {
        let objects = getActiveObjects(this.botsState);
        let allTags = union(...objects.map(o => tagsOnBot(o)));
        let sorted = sortBy(allTags, t => t);
        return sorted;
    }

    exportFiles(botIds: string[]): StoredCausalTree<AuxOp> {
        const bots = botIds.map(id => this.botsState[id]);
        const atoms = bots.map(f => f.metadata.ref);
        const weave = this._tree.weave.subweave(...atoms);
        const stored = storedTree(
            this._tree.site,
            this._tree.knownSites,
            weave.atoms
        );
        return stored;
    }

    private _flattenEvents(events: BotAction[]): BotAction[] {
        let resultEvents: BotAction[] = [];
        for (let event of events) {
            if (event.type === 'action') {
                const result = calculateActionEvents(
                    this.botsState,
                    event,
                    this._sandboxFactory,
                    this._lib
                );
                resultEvents.push(...this._flattenEvents(result.events));
            } else if (event.type === 'update_bot') {
                const bot = this.botsState[event.id];
                updateBot(bot, this.userFile.id, event.update, () =>
                    this.createContext()
                );
                resultEvents.push(event);
            } else if (event.type === 'paste_state') {
                resultEvents.push(...this._pasteState(event));
            } else {
                resultEvents.push(event);
            }
        }

        return resultEvents;
    }

    private _sendOtherEvents(events: BotAction[]) {
        let remoteEvents: RemoteAction[] = [];
        let localEvents: LocalActions[] = [];
        let deviceEvents: DeviceAction[] = [];

        for (let event of events) {
            if (event.type === 'remote') {
                remoteEvents.push(event);
            } else if (event.type === 'device') {
                deviceEvents.push(event);
            } else if (event.type === 'add_bot') {
            } else if (event.type === 'remove_bot') {
            } else if (event.type === 'update_bot') {
            } else if (event.type === 'apply_state') {
            } else if (event.type === 'transaction') {
            } else {
                localEvents.push(<LocalActions>event);
            }
        }

        if (localEvents.length > 0) {
            this._localEvents.next(localEvents);
        }
        if (remoteEvents.length > 0) {
            this._remoteEvents.next(remoteEvents);
        }
        if (deviceEvents.length > 0) {
            this._deviceEvents.next(deviceEvents);
        }
    }

    private _pasteState(event: PasteStateAction) {
        // TODO: Cleanup this function to make it easier to understand
        const value = event.state;
        const botIds = Object.keys(value);
        let state: BotsState = {};
        const oldFiles = botIds.map(id => value[id]);
        const oldCalc = createCalculationContext(
            oldFiles,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
        const newCalc = this.createContext();

        if (event.options.context) {
            return this._pasteExistingWorksurface(
                oldFiles,
                oldCalc,
                event,
                newCalc
            );
        } else {
            return this._pasteNewWorksurface(oldFiles, oldCalc, event, newCalc);
        }
    }

    private _pasteExistingWorksurface(
        oldFiles: Bot[],
        oldCalc: BotSandboxContext,
        event: PasteStateAction,
        newCalc: BotSandboxContext
    ) {
        let events: BotAction[] = [];

        // Preserve positions from old context
        for (let oldFile of oldFiles) {
            const tags = tagsOnBot(oldFile);
            const tagsToRemove = filterWellKnownAndContextTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newFile = duplicateBot(oldCalc, oldFile, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToContextDiff(
                        newCalc,
                        event.options.context,
                        event.options.x,
                        event.options.y
                    ),
                    [`${event.options.context}.z`]: event.options.z,
                },
            });
            events.push(botAdded(cleanBot(newFile)));
        }

        return events;
    }

    private _pasteNewWorksurface(
        oldFiles: Bot[],
        oldCalc: BotSandboxContext,
        event: PasteStateAction,
        newCalc: BotSandboxContext
    ) {
        const oldContextFiles = oldFiles.filter(
            f => getBotConfigContexts(oldCalc, f).length > 0
        );
        const oldContextFile =
            oldContextFiles.length > 0 ? oldContextFiles[0] : null;
        const oldContexts = oldContextFile
            ? getBotConfigContexts(oldCalc, oldContextFile)
            : [];
        let oldContext = oldContexts.length > 0 ? oldContexts[0] : null;
        let events: BotAction[] = [];
        const context = createContextId();
        let workspace: Bot;
        if (oldContextFile) {
            workspace = duplicateBot(oldCalc, oldContextFile, {
                tags: {
                    'aux.context': context,
                },
            });
        } else {
            workspace = createWorkspace(undefined, context);
        }
        workspace.tags['aux.context.x'] = event.options.x;
        workspace.tags['aux.context.y'] = event.options.y;
        workspace.tags['aux.context.z'] = event.options.z;
        events.push(botAdded(workspace));
        if (!oldContext) {
            oldContext = context;
        }

        // Preserve positions from old context
        for (let oldFile of oldFiles) {
            if (oldContextFile && oldFile.id === oldContextFile.id) {
                continue;
            }
            const tags = tagsOnBot(oldFile);
            const tagsToRemove = filterWellKnownAndContextTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newFile = duplicateBot(oldCalc, oldFile, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToContextDiff(
                        newCalc,
                        context,
                        oldFile.tags[`${oldContext}.x`],
                        oldFile.tags[`${oldContext}.y`],
                        oldFile.tags[`${oldContext}.sortOrder`]
                    ),
                    [`${context}.z`]: oldFile.tags[`${oldContext}.z`],
                },
            });
            events.push(botAdded(cleanBot(newFile)));
        }
        return events;
    }
}
