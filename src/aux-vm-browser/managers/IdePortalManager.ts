import {
    Subject,
    Observable,
    BehaviorSubject,
    merge,
    from,
    SubscriptionLike,
} from 'rxjs';
import {
    flatMap,
    tap,
    withLatestFrom,
    bufferTime,
    startWith,
} from 'rxjs/operators';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    isBot,
    PrecalculatedBot,
    isPrecalculated,
    isExistingBot,
    createPrecalculatedBot,
    filterBotsBySelection,
    botsInDimension,
    SHEET_PORTAL,
    IDE_PORTAL,
    isPortalScript,
    DNA_TAG_PREFIX,
    tagsOnBot,
    hasValue,
} from '@casual-simulation/aux-common';
import {
    PortalManager,
    UpdatedBotInfo,
} from '@casual-simulation/aux-vm/managers';
import { flatMap as lodashFlatMap, sortedIndexBy } from 'lodash';

export type IdeNode = IdeFolderNode | IdeTagNode;

export interface IdeFolderNode {
    type: 'folder';
    path: string;
    name: string;
    key: string;
    children: IdeNode[];
}

export interface IdeTagNode {
    type: 'tag';
    path: string;
    botId: string;
    tag: string;
    prefix: string;
}

export interface IdePortalUpdate {
    hasPortal: boolean;
    // items: IdeNode[];
}

/**
 * Defines a class that manages the bot panel.
 */
export class IdePortalManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: BotWatcher;
    private _buffer: boolean;

    private _itemsAdded: Subject<IdeNode[]>;
    private _itemsUpdated: Subject<IdeNode[]>;
    private _itemsRemoved: Subject<IdeNode[]>;
    private _portalUpdated: BehaviorSubject<IdePortalUpdate>;
    private _currentPrefix: string;
    private _items: IdeTagNode[];

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever the list of selected bots is updated.
     */
    get itemsAdded(): Observable<IdeNode[]> {
        return this._itemsAdded.pipe(startWith(this._items));
    }

    /**
     * Gets an observable that resolves whenever an item is updated.
     */
    get itemsUpdated(): Observable<IdeNode[]> {
        return this._itemsUpdated;
    }

    /**
     * Gets an observable that resolves whenever an item is removed.
     */
    get itemsRemoved(): Observable<IdeNode[]> {
        return this._itemsRemoved;
    }

    /**
     * Gets an observable that resolves whenever information about the portal is updated.
     */
    get portalUpdated(): Observable<IdePortalUpdate> {
        return this._portalUpdated;
    }

    /**
     * Gets the list of items that should be exposed in the IDE portal.
     */
    get items() {
        return this._items;
    }

    /**
     * Creates a new bot panel manager.
     * @param watcher The bot watcher to use.
     * @param helper The bot helper to use.
     * @param bufferEvents Whether to buffer the update events.
     */
    constructor(
        watcher: BotWatcher,
        helper: BotHelper,
        bufferEvents: boolean = true
    ) {
        this._watcher = watcher;
        this._helper = helper;
        this._buffer = bufferEvents;
        this._items = [];
        this._portalUpdated = new BehaviorSubject<IdePortalUpdate>({
            hasPortal: false,
        });
        this._itemsAdded = new Subject<IdeNode[]>();
        this._itemsUpdated = new Subject<IdeNode[]>();
        this._itemsRemoved = new Subject<IdeNode[]>();

        this._subs.push(
            this._calculatePortalUpdated().subscribe(this._portalUpdated),
            ...this._watchBots()
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach((s) => s.unsubscribe());
            this._subs = null;
        }
    }

    private _calculatePortalUpdated(): Observable<IdePortalUpdate> {
        const allBotsSelectedUpdatedAddedAndRemoved = merge(
            this._watcher.botsDiscovered,
            this._watcher.botsUpdated,
            this._watcher.botsRemoved
        );
        const bufferedEvents: Observable<any> = this._buffer
            ? allBotsSelectedUpdatedAddedAndRemoved.pipe(bufferTime(10))
            : allBotsSelectedUpdatedAddedAndRemoved;
        return bufferedEvents.pipe(
            flatMap(async () => {
                if (!this._helper.userBot) {
                    return {
                        hasPortal: false,
                        items: [],
                    };
                }
                const prefix = this._helper.userBot.tags[IDE_PORTAL];
                if (prefix) {
                    return {
                        hasPortal: true,
                    };
                }

                return {
                    hasPortal: false,
                };
            })
        );
    }

    private _watchBots(): SubscriptionLike[] {
        return [
            this._watcher.botsDiscovered.subscribe((bots) => {
                if (this._needsReset()) {
                    this._reset();
                } else {
                    this._addBots(bots);
                }
            }),

            this._watcher.botTagsUpdated.subscribe((bots) => {
                if (this._needsReset()) {
                    this._reset();
                } else {
                    this._updateBots(bots);
                }
            }),

            this._watcher.botsRemoved.subscribe((bots) => {
                if (this._needsReset()) {
                    this._reset();
                } else {
                    this._deleteBots(bots);
                }
            }),
        ];
    }

    private _reset() {
        const removedItems = this._items;
        this._items = [];

        this._addBots(this._helper.objects);

        if (removedItems.length > 0) {
            this._itemsRemoved.next(removedItems);
        }
    }

    private _addBots(bots: PrecalculatedBot[]) {
        if (!hasValue(this._currentPrefix)) {
            return;
        }
        let newItems = [] as IdeTagNode[];

        for (let bot of bots) {
            if (bot.id === this._helper.userId) {
                continue;
            }
            for (let tag of tagsOnBot(bot)) {
                if (isPortalScript(this._currentPrefix, bot.tags[tag])) {
                    let item = this._createItem(bot, tag);
                    newItems.push(item);

                    const index = sortedIndexBy(
                        this._items,
                        item,
                        (i) => i.path
                    );
                    if (index >= 0) {
                        this._items.splice(index, 0, item);
                    }
                }
            }
        }

        if (newItems.length > 0) {
            this._itemsAdded.next(newItems);
        }
    }

    private _updateBots(updates: UpdatedBotInfo[]) {
        if (!hasValue(this._currentPrefix)) {
            return;
        }

        let newItems = [] as IdeTagNode[];
        let updatedItems = [] as IdeTagNode[];
        let removedItems = [] as IdeTagNode[];

        for (let update of updates) {
            for (let tag of update.tags) {
                const path = `/${tag}/${update.bot.id}.js`;
                const isScript = isPortalScript(
                    this._currentPrefix,
                    update.bot.tags[tag]
                );
                let index = sortedIndexBy(
                    this._items,
                    { path } as any,
                    (b) => b.path
                );

                if (index >= 0) {
                    const item = this._items[index];
                    if (item?.path === path) {
                        if (isScript) {
                            // update
                            updatedItems.push(item);
                        } else {
                            removedItems.push(item);
                            this._items.splice(index, 1);
                        }
                    } else {
                        // new bot
                        const item = this._createItem(update.bot, tag);
                        newItems.push(item);
                        this._items.splice(index, 0, item);
                    }
                }
            }
        }

        if (newItems.length > 0) {
            this._itemsAdded.next(newItems);
        }
        if (updatedItems.length > 0) {
            this._itemsUpdated.next(updatedItems);
        }
        if (removedItems.length > 0) {
            this._itemsRemoved.next(removedItems);
        }
    }

    private _deleteBots(bots: string[]) {
        if (!hasValue(this._currentPrefix)) {
            return;
        }

        let removedItems = [] as IdeNode[];
        for (let bot of bots) {
            const items = this._items.filter((i) => i.botId === bot);
            removedItems.push(...items);

            this._items = this._items.filter((i) => i.botId !== bot);
        }

        if (removedItems.length > 0) {
            this._itemsRemoved.next(removedItems);
        }
    }

    private _createItem(bot: PrecalculatedBot, tag: string): IdeTagNode {
        return {
            type: 'tag',
            path: `/${tag}/${bot.id}.js`,
            botId: bot.id,
            tag: tag,
            prefix: this._currentPrefix,
        };
    }

    private _needsReset(): boolean {
        return this._checkPrefix();
    }

    private _checkPrefix(): boolean {
        const currentPrefix = this._helper.userBot?.tags[IDE_PORTAL];
        const changed = currentPrefix !== this._currentPrefix;
        this._currentPrefix = currentPrefix;
        return changed;
    }
}
