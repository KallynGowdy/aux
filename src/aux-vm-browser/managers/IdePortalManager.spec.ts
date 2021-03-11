import { IdeNode, IdePortalManager } from './IdePortalManager';
import {
    BotHelper,
    BotWatcher,
    buildVersionNumber,
    CodeBundle,
    LibraryModule,
    PortalManager,
    ScriptPrefix,
} from '@casual-simulation/aux-vm';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    PrecalculatedBot,
    BotIndex,
    botUpdated,
    botRemoved,
    registerPrefix,
    BotsState,
    BotAction,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject, Subscription } from 'rxjs';
import { locale } from 'faker';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

describe('IdePortalManager', () => {
    let manager: IdePortalManager;
    let watcher: BotWatcher;
    let portals: PortalManager;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';
    let localEvents: Subject<BotAction[]>;

    beforeEach(async () => {
        vm = new TestAuxVM(userId);
        vm.processEvents = true;
        localEvents = vm.localEvents = new Subject();
        helper = new BotHelper(vm);
        helper.userId = userId;
        index = new BotIndex();

        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );

        await vm.sendEvents([
            botAdded(
                createBot('user', {
                    idePortal: '🔺',
                })
            ),
        ]);

        localEvents.next([
            registerPrefix('🔺', {
                language: 'javascript',
            }),
        ]);

        manager = new IdePortalManager(watcher, helper, false);
    });

    describe('portalUpdated', () => {
        it('should resolve with whether the portal is open', async () => {
            let hasPortal: boolean;
            manager.portalUpdated.subscribe((portal) => {
                hasPortal = portal.hasPortal;
            });

            await waitAsync();

            expect(hasPortal).toBe(true);
        });

        it('should resolve with false when the idePortal tag is removed from the player bot', async () => {
            let hasPortal: boolean;
            manager.portalUpdated.subscribe((portal) => {
                hasPortal = portal.hasPortal;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        idePortal: null,
                    },
                }),
            ]);

            expect(hasPortal).toBe(false);
        });
    });

    describe('itemsAdded', () => {
        let newItems: IdeNode[];
        let sub: Subscription;
        beforeEach(() => {
            newItems = [];
            sub = manager.itemsAdded.subscribe((e) => {
                newItems.push(...e);
            });
        });

        afterEach(() => {
            if (sub) {
                sub.unsubscribe();
            }
        });

        it('should resolve whenever a bot with the correct prefix is added', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);
            expect(manager.items).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);
        });

        it('should resolve whenever a tag with the correct prefix is added to a bot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        abc: '🔺def',
                    },
                }),
            ]);

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
                {
                    type: 'tag',
                    path: '/abc/test.js',
                    botId: 'test',
                    tag: 'abc',
                    prefix: '🔺',
                },
            ]);
        });

        it('should not resolve whenever a bot without the correct prefix is added', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: 'script',
                    })
                ),
            ]);

            expect(newItems).toEqual([]);
        });

        it('should resolve with items that already exist', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        abc: '🔺script',
                    })
                ),
            ]);

            let items = [] as IdeNode[];
            manager.itemsAdded.subscribe((a) => items.push(...a));

            await waitAsync();

            expect(items).toEqual([
                {
                    type: 'tag',
                    path: '/abc/test2.js',
                    botId: 'test2',
                    tag: 'abc',
                    prefix: '🔺',
                },
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);
        });

        it('should resolve with items that are added because the tag was edited to have the correct prefix', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: 'script',
                    })
                ),
            ]);

            expect(newItems).toEqual([]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        hello: '🔺script',
                    },
                }),
            ]);

            await waitAsync();

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);
        });

        it('should not resolve when a script is updated but is still an item', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        hello: '🔺script',
                    },
                }),
            ]);

            await waitAsync();

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);
        });

        it('should add all items when the prefix changes', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '📖script',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        abc: '📖script',
                    })
                ),
            ]);

            expect(newItems).toEqual([]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        idePortal: '📖',
                    },
                }),
            ]);

            expect(newItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '📖',
                },
                {
                    type: 'tag',
                    path: '/abc/test2.js',
                    botId: 'test2',
                    tag: 'abc',
                    prefix: '📖',
                },
            ]);

            expect(manager.items).toEqual([
                {
                    type: 'tag',
                    path: '/abc/test2.js',
                    botId: 'test2',
                    tag: 'abc',
                    prefix: '📖',
                },
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '📖',
                },
            ]);
        });

        it('should ignore the user bot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('user', {
                        idePortal: '🔺',
                    })
                ),
            ]);

            expect(newItems).toEqual([]);
            expect(manager.items).toEqual([]);
        });
    });

    describe('itemsUpdated', () => {
        let updatedItems: IdeNode[];
        let sub: Subscription;
        beforeEach(() => {
            updatedItems = [];
            sub = manager.itemsUpdated.subscribe((e) => {
                updatedItems.push(...e);
            });
        });

        afterEach(() => {
            if (sub) {
                sub.unsubscribe();
            }
        });

        it('should resolve whenever an item is updated', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(updatedItems).toEqual([]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        hello: '🔺abcdef',
                    },
                }),
            ]);

            expect(updatedItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);

            expect(manager.items).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);
        });
    });

    describe('itemsRemoved', () => {
        let removedItems: IdeNode[];
        let sub: Subscription;
        beforeEach(async () => {
            removedItems = [];
            sub = manager.itemsRemoved.subscribe((e) => {
                removedItems.push(...e);
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);
        });

        afterEach(() => {
            if (sub) {
                sub.unsubscribe();
            }
        });

        it('should resolve whenever an item is removed because the bot is removed', async () => {
            expect(removedItems).toEqual([]);

            await vm.sendEvents([botRemoved('test')]);

            expect(removedItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);

            expect(manager.items).toEqual([]);
        });

        it('should resolve whenever an item is removed because the script prefix changed', async () => {
            expect(removedItems).toEqual([]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        hello: 'script',
                    },
                }),
            ]);

            expect(removedItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);

            expect(manager.items).toEqual([]);
        });

        it('should remove all items when the prefix changes', async () => {
            expect(removedItems).toEqual([]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        idePortal: 'different',
                    },
                }),
            ]);

            expect(removedItems).toEqual([
                {
                    type: 'tag',
                    path: '/hello/test.js',
                    botId: 'test',
                    tag: 'hello',
                    prefix: '🔺',
                },
            ]);

            expect(manager.items).toEqual([]);
        });
    });
});
