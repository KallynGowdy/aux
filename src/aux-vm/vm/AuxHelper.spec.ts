import {
    AuxCausalTree,
    AuxObject,
    BotAction,
    botAdded,
    createBot,
    botUpdated,
    GLOBALS_BOT_ID,
    LocalActions,
    action,
    toast,
    Sandbox,
    addState,
    updateBot,
    botRemoved,
    BotActions,
    USERS_CONTEXT,
    BotsState,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from './test/TestAuxVM';
import { AuxHelper } from './AuxHelper';
import {
    storedTree,
    site,
    USERNAME_CLAIM,
    DeviceAction,
    RemoteAction,
    remote,
} from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';
import {
    createLocalCausalTreePartitionFactory,
    createMemoryPartition,
} from '..';
import { waitAsync } from '../test/TestHelpers';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();
console.error = jest.fn();

describe('AuxHelper', () => {
    let userId: string = 'user';
    let tree: AuxCausalTree;
    let vm: TestAuxVM;
    let helper: AuxHelper;

    beforeEach(async () => {
        uuidMock.mockReset();
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new AuxHelper({
            shared: await createLocalCausalTreePartitionFactory({}, null, null)(
                {
                    type: 'causal_tree',
                    tree: tree,
                    id: 'testAux',
                }
            ),
        });
        helper.userId = userId;

        await tree.root();
        await tree.bot('user');
    });

    it('should use the given sandbox factory', async () => {
        const sandbox: Sandbox = {
            library: null,
            interface: null,
            run: null,
        };
        helper = new AuxHelper(
            {
                shared: await createLocalCausalTreePartitionFactory(
                    {},
                    null,
                    null
                )({
                    type: 'causal_tree',
                    tree: tree,
                    id: 'testAux',
                }),
            },
            undefined,
            lib => sandbox
        );
        helper.userId = userId;

        const context = helper.createContext();
        expect(context.sandbox).toBe(sandbox);
    });

    describe('partitions', () => {
        it('should exclude partitions which dont have their bot from the bot state', () => {
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                    },
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
            });

            expect(helper.botsState).toEqual({
                test: createBot('test', {}, 'shared'),
            });
            expect(Object.keys(helper.botsState)).toEqual(['test']);
        });

        it('should send local events for the events that are returned from the partition', async () => {
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                    },
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', undefined, <any>'abc'),
                    },
                }),
            });
            helper.userId = 'test';

            let events: BotAction[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        test: 123,
                    },
                })
            );

            await waitAsync();

            expect(events).toEqual([
                botUpdated('test', {
                    tags: {
                        test: 123,
                    },
                }),
            ]);
        });

        it('should place bots in partitions based on the bot space', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
                TEST: mem,
            });

            await helper.createBot('abcdefghijklmnop', undefined, <any>'TEST');

            expect(Object.keys(helper.botsState)).toEqual(['abcdefghijklmnop']);
            expect(Object.keys(mem.state)).toEqual(['abcdefghijklmnop']);
        });

        it('should ignore bots going to partitions that dont exist', async () => {
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
            });

            await helper.createBot('abcdefghijklmnop', undefined, <any>'TEST');
            expect(Object.keys(helper.botsState)).toEqual([]);
        });

        it('should prevent partitions from overriding other partitions', async () => {
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    },
                }),
                TEST: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', {
                            bad: 'thing',
                        }),
                    },
                }),
            });

            expect(helper.botsState).toEqual({
                test: createBot(
                    'test',
                    {
                        abc: 'def',
                    },
                    'shared'
                ),
            });
        });

        it('should split add_state events into the correct partitions', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = new AuxHelper({
                shared: shared,
                TEST: mem,
            });

            await helper.transaction(
                addState({
                    abc: createBot('abc', {}, <any>'TEST'),
                    normal: createBot('normal', {}),
                })
            );

            expect(Object.keys(helper.botsState)).toEqual(['normal', 'abc']);
            expect(Object.keys(mem.state)).toEqual(['abc']);
            expect(Object.keys(shared.state)).toEqual(['normal']);
        });

        it('should set the correct space on bots from partitions', async () => {
            let TEST = createMemoryPartition({
                type: 'memory',
                initialState: {
                    abc: createBot('abc', {}),
                    def: createBot('def', {}, <any>'wrong'),
                },
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {
                    normal: createBot('normal', {}),
                },
            });
            helper = new AuxHelper({
                shared: shared,
                TEST: TEST,
            });

            expect(helper.botsState).toEqual({
                abc: createBot('abc', {}, <any>'TEST'),
                def: createBot('def', {}, <any>'TEST'),
                normal: createBot('normal', {}, 'shared'),
            });
            expect(TEST.state).toEqual({
                abc: createBot('abc'),
                def: createBot('def', {}, <any>'wrong'),
            });
            expect(shared.state).toEqual({
                normal: createBot('normal'),
            });
        });
    });

    describe('publicBotsState', () => {
        it('should return the bots state from all the public partitions', async () => {
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                    },
                    private: false,
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        abc: createBot('abc'),
                    },
                    private: true,
                }),
            });

            expect(helper.publicBotsState).toEqual({
                test: createBot('test', {}, 'shared'),
            });
            expect(Object.keys(helper.publicBotsState)).toEqual(['test']);
        });
    });

    describe('userBot', () => {
        it('should return the bot that has the same ID as the user ID', async () => {
            const bot = tree.value['user'];
            const user = helper.userBot;

            expect(user).toEqual({
                ...bot,
                space: 'shared',
            });
        });
    });

    describe('globalsBot', () => {
        it('should return the bot with the globals ID', async () => {
            await tree.bot(GLOBALS_BOT_ID);

            const bot = tree.value[GLOBALS_BOT_ID];
            const globals = helper.globalsBot;

            expect(globals).toEqual({
                ...bot,
                space: 'shared',
            });
        });
    });

    describe('objects', () => {
        it('should return active objects', async () => {
            const { added: bot1 } = await tree.bot('test1');
            const { added: bot2 } = await tree.bot('test2');

            const objs = helper.objects;

            expect(objs).toEqual([
                {
                    ...tree.value['test2'],
                    space: 'shared',
                },
                { ...tree.value['test1'], space: 'shared' },
                helper.userBot,
            ]);
        });
    });

    describe('createContext()', () => {
        describe('player.inDesigner()', () => {
            it('should return true when in builder', async () => {
                helper = new AuxHelper(
                    {
                        shared: await createLocalCausalTreePartitionFactory(
                            {},
                            null,
                            null
                        )({
                            type: 'causal_tree',
                            tree: tree,
                            id: 'testAux',
                        }),
                    },
                    {
                        isBuilder: true,
                        isPlayer: false,
                    }
                );
                helper.userId = userId;

                const context = helper.createContext();

                expect(context.sandbox.library.player.inDesigner()).toBe(true);
            });

            it('should return false when not in builder', async () => {
                helper = new AuxHelper(
                    {
                        shared: await createLocalCausalTreePartitionFactory(
                            {},
                            null,
                            null
                        )({
                            type: 'causal_tree',
                            tree: tree,
                            id: 'testAux',
                        }),
                    },
                    {
                        isBuilder: false,
                        isPlayer: true,
                    }
                );
                helper.userId = userId;

                const context = helper.createContext();

                expect(context.sandbox.library.player.inDesigner()).toBe(false);
            });

            it('should default to not in aux builder or player', async () => {
                helper = new AuxHelper({
                    shared: await createLocalCausalTreePartitionFactory(
                        {},
                        null,
                        null
                    )({
                        type: 'causal_tree',
                        tree: tree,
                        id: 'testAux',
                    }),
                });
                helper.userId = userId;

                const context = helper.createContext();

                expect(context.sandbox.library.player.inDesigner()).toBe(false);
            });
        });
    });

    describe('transaction()', () => {
        it('should emit local events that are sent via transaction()', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.transaction(toast('test'));

            expect(events).toEqual([toast('test')]);
        });

        it('should run action events', async () => {
            await helper.createBot('test', {
                action: '@setTag(this, "#hit", true)',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.hit).toBe(true);
        });

        it('should support player.inDesigner() in actions', async () => {
            helper = new AuxHelper(
                {
                    shared: await createLocalCausalTreePartitionFactory(
                        {},
                        null,
                        null
                    )({
                        type: 'causal_tree',
                        tree: tree,
                        id: 'testAux',
                    }),
                },
                {
                    isBuilder: true,
                    isPlayer: true,
                }
            );
            helper.userId = userId;

            await helper.createBot('test', {
                action: '@setTag(this, "#value", player.inDesigner())',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.value).toBe(true);
        });

        it('should emit local events from actions', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createBot('test', {
                action: '@player.toast("test")',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(events).toEqual([toast('test')]);
        });

        it('should calculate assignment formulas', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createBot('test', {});

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        test: ':="abc"',
                    },
                })
            );

            expect(helper.botsState['test']).toMatchObject({
                id: 'test',
                tags: {
                    test: {
                        _assignment: true,
                        editing: true,
                        formula: ':="abc"',
                        value: 'abc',
                    },
                },
            });
        });

        it('should emit remote events that are sent via transaction()', async () => {
            let events: RemoteAction[] = [];
            helper.remoteEvents.subscribe(e => events.push(...e));

            await helper.transaction(remote(toast('test')));

            expect(events).toEqual([remote(toast('test'))]);
        });

        it('should emit device events that are sent via transaction()', async () => {
            let events: DeviceAction[] = [];
            helper.deviceEvents.subscribe(e => events.push(...e));

            await helper.transaction({
                type: 'device',
                device: null,
                event: toast('test'),
            });

            expect(events).toEqual([
                {
                    type: 'device',
                    device: null,
                    event: toast('test'),
                },
            ]);
        });

        describe('paste_state', () => {
            it('should add the given bots to a new context', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot1: createBot('bot1', {
                        auxDimension: 'context',
                        auxDimensionVisualize: 'surface',
                        auxDimensionX: 0,
                        auxDimensionY: 1,
                        auxDimensionZ: 2,
                    }),
                    bot2: createBot('bot2', {
                        context: true,
                        contextX: 0,
                        contextY: 0,
                        test: 'abc',
                    }),
                });
            });

            it('should preserve X and Y positions if a context bot is included', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2')
                    .mockReturnValueOnce('bot3');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            old: true,
                            oldX: 3,
                            oldY: 2,
                            oldZ: 1,
                        }),
                        contextBot: createBot('contextBot', {
                            auxDimension: 'old',
                            auxDimensionVisualize: true,
                            other: 'def',
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot1: createBot('bot1', {
                        auxDimension: 'context',
                        auxDimensionVisualize: true,
                        auxDimensionX: -1,
                        auxDimensionY: 1,
                        auxDimensionZ: 2,
                        other: 'def',
                    }),
                    bot2: createBot('bot2', {
                        context: true,
                        contextX: 3,
                        contextY: 2,
                        contextZ: 1,
                        test: 'abc',
                    }),
                });
            });

            it('should check the current state for contexts if they are not included in the copied state', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2')
                    .mockReturnValueOnce('bot3');

                await helper.transaction(
                    addState({
                        contextBot: createBot('contextBot', {
                            auxDimension: 'old',
                            auxDimensionVisualize: true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            oldX: 3,
                            oldY: 2,
                            oldZ: 1,
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toEqual({
                    contextBot: expect.any(Object),
                    user: expect.any(Object),
                    bot1: expect.objectContaining(
                        createBot('bot1', {
                            auxDimension: 'context',
                            auxDimensionVisualize: 'surface',
                            auxDimensionX: -1,
                            auxDimensionY: 1,
                            auxDimensionZ: 2,
                        })
                    ),
                    bot2: expect.objectContaining(
                        createBot('bot2', {
                            context: true,
                            contextX: 0,
                            contextY: 0,
                            contextSortOrder: 0,
                            test: 'abc',
                        })
                    ),
                });
            });

            it('should add the given bots to the given context at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('bot2');

                await helper.transaction(
                    addState({
                        contextBot: createBot('contextBot', {
                            auxDimension: 'old',
                            auxDimensionVisualize: true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            old: true,
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        context: 'fun',
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: {
                        tags: expect.not.objectContaining({
                            old: true,
                        }),
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: createBot('bot2', {
                        fun: true,
                        funX: 0,
                        funY: 1,
                        funZ: 2,
                        test: 'abc',
                    }),
                });
            });

            it('should add the given bots the given context at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('bot2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        context: 'fun',
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: createBot('bot2', {
                        fun: true,
                        funX: 0,
                        funY: 1,
                        funZ: 2,
                        test: 'abc',
                    }),
                });
            });
        });

        describe('onChannelAction()', () => {
            it('should emit an onChannelAction() call to the globals bot', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: '@setTag(this, "hit", true)',
                });

                await helper.transaction({
                    type: 'go_to_url',
                    url: 'test',
                });

                expect(helper.globalsBot).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: {
                        onChannelAction: '@setTag(this, "hit", true)',
                        hit: true,
                    },
                });
            });

            it('should skip actions that onChannelAction() rejects', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: '@action.reject(that.action)',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            it('should allow rejecting rejections', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: '@action.reject(that.action)',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            const falsyTests = [
                ['0'],
                ['""'],
                ['null'],
                ['undefined'],
                ['NaN'],
            ];

            it.each(falsyTests)(
                'should allow actions that onChannelAction() returns %s for',
                async val => {
                    await helper.createBot(GLOBALS_BOT_ID, {
                        onChannelAction: `@return ${val};`,
                    });

                    await helper.createBot('test', {});

                    await helper.transaction(
                        botUpdated('test', {
                            tags: {
                                updated: true,
                            },
                        })
                    );

                    expect(helper.botsState['test']).toMatchObject({
                        id: 'test',
                        tags: expect.objectContaining({
                            updated: true,
                        }),
                    });
                }
            );

            it('should allow actions that onChannelAction() returns true for', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: '@return true',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        updated: true,
                    },
                });
            });

            it('should allow actions when onChannelAction() errors out', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: '@throw new Error("Error")',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        updated: true,
                    },
                });
            });

            it('should be able to filter based on action type', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: `@
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            it('should filter actions from inside shouts', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: `@
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                    'test()': 'setTag(this, "abc", true)',
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                expect(helper.botsState[GLOBALS_BOT_ID]).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: expect.not.objectContaining({
                        abc: true,
                    }),
                });
            });

            it('should be able to filter out actions before they are run', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: `@
                        if (that.action.type === 'action') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                    'test()': 'setTag(this, "abc", true)',
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                expect(helper.botsState[GLOBALS_BOT_ID]).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: expect.not.objectContaining({
                        abc: true,
                    }),
                });
            });

            it('should allow updates to the onChannelAction() handler by default', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {});

                await helper.transaction(
                    botUpdated(GLOBALS_BOT_ID, {
                        tags: {
                            onChannelAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                        },
                    })
                );

                expect(helper.globalsBot).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: expect.objectContaining({
                        onChannelAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                    }),
                });
            });

            it('should allow the entire update and not just the onChannelAction() part', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {});

                await helper.transaction(
                    botUpdated(GLOBALS_BOT_ID, {
                        tags: {
                            onChannelAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                            test: true,
                        },
                    })
                );

                expect(helper.globalsBot).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: expect.objectContaining({
                        onChannelAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                        test: true,
                    }),
                });
            });

            it('should prevent deleting the globals bot by default', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {});

                await helper.transaction(botRemoved(GLOBALS_BOT_ID));

                expect(helper.globalsBot).toBeTruthy();
            });

            it('should run once per action event', async () => {
                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');

                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: `@
                        if (that.action.type === 'action') {
                            create(null, {
                                test: true
                            });
                        }
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                const matching = helper.objects.filter(o => 'test' in o.tags);
                expect(matching.length).toBe(1);
            });

            it('should run once per update event', async () => {
                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');

                await helper.createBot(GLOBALS_BOT_ID, {
                    onChannelAction: `@
                        if (that.action.type === 'update_bot') {
                            create(null, {
                                test: true
                            });
                        }
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated(GLOBALS_BOT_ID, {
                        tags: {
                            update: 123,
                        },
                    })
                );

                const matching = helper.objects.filter(o => 'test' in o.tags);
                expect(matching.length).toBe(1);
            });
        });
    });

    describe('search()', () => {
        it('should support player.inDesigner()', async () => {
            helper = new AuxHelper(
                {
                    shared: await createLocalCausalTreePartitionFactory(
                        {},
                        null,
                        null
                    )({
                        type: 'causal_tree',
                        tree: tree,
                        id: 'testAux',
                    }),
                },
                {
                    isBuilder: true,
                    isPlayer: true,
                }
            );
            helper.userId = userId;

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", player.inDesigner())',
            });

            const result = await helper.search('player.inDesigner()');

            expect(result.result).toBe(true);
        });
    });

    describe('getTags()', () => {
        it('should return the full list of tags sorted alphabetically', async () => {
            await helper.createBot('test', {
                abc: 'test1',
                xyz: 'test2',
            });

            await helper.createBot('test2', {
                '123': 456,
                def: 'test1',
                xyz: 'test2',
            });

            const tags = helper.getTags();

            expect(tags).toEqual(['123', 'abc', 'def', 'xyz']);
        });
    });

    describe('formulaBatch()', () => {
        it('should support player.inDesigner()', async () => {
            helper = new AuxHelper(
                {
                    shared: await createLocalCausalTreePartitionFactory(
                        {},
                        null,
                        null
                    )({
                        type: 'causal_tree',
                        tree: tree,
                        id: 'testAux',
                    }),
                },
                {
                    isBuilder: true,
                    isPlayer: true,
                }
            );
            helper.userId = userId;

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", player.inDesigner())',
            });

            await helper.formulaBatch([
                'setTag(getBot("id", "test"), "value", player.inDesigner())',
            ]);

            expect(helper.botsState['test'].tags.value).toBe(true);
        });
    });

    describe('createOrUpdateUserBot()', () => {
        it('should create a bot for the user', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            helper = new AuxHelper({
                shared: await createLocalCausalTreePartitionFactory(
                    {},
                    null,
                    null
                )({
                    type: 'causal_tree',
                    tree: tree,
                    id: 'testAux',
                }),
            });
            helper.userId = userId;

            await tree.root();
            await helper.createOrUpdateUserBot(
                {
                    id: 'testUser',
                    username: 'username',
                    name: 'test',
                    isGuest: false,
                    token: 'abc',
                },
                null
            );

            expect(helper.botsState['testUser']).toMatchObject({
                id: 'testUser',
                tags: {
                    [USERS_CONTEXT]: true,
                    ['_auxUser']: 'username',
                    ['_auxUserInventoryDimension']: '_user_username_inventory',
                    ['_auxUserMenuDimension']: '_user_username_menu',
                    ['_auxUserChannelsContext']: '_user_username_simulations',
                },
            });
        });

        const contextCases = [
            ['menu context', '_auxUserMenuDimension', '_user_username_menu'],
            [
                'inventory context',
                '_auxUserInventoryDimension',
                '_user_username_inventory',
            ],
            [
                'simulations context',
                '_auxUserChannelsContext',
                '_user_username_simulations',
            ],
        ];

        it.each(contextCases)(
            'should add the %s to a user that doesnt have it',
            async (desc, tag, value) => {
                await helper.createOrUpdateUserBot(
                    {
                        id: 'user',
                        username: 'username',
                        name: 'test',
                        isGuest: false,
                        token: 'abc',
                    },
                    null
                );

                expect(helper.userBot).toMatchObject({
                    id: 'user',
                    tags: {
                        [tag]: value,
                    },
                });
            }
        );
    });

    describe('createOrUpdateUserContextBot()', () => {
        it('should create a context bot for all the users', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            helper = new AuxHelper({
                shared: await createLocalCausalTreePartitionFactory(
                    {},
                    null,
                    null
                )({
                    type: 'causal_tree',
                    tree: tree,
                    id: 'testAux',
                }),
            });
            helper.userId = userId;

            await tree.root();

            uuidMock.mockReturnValueOnce('context');
            await helper.createOrUpdateUserContextBot();

            expect(helper.botsState['context']).toMatchObject({
                id: 'context',
                tags: {
                    ['auxDimension']: USERS_CONTEXT,
                    ['auxDimensionVisualize']: true,
                },
            });
        });

        it('should not create a context bot for all the users if one already exists', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            helper = new AuxHelper({
                shared: await createLocalCausalTreePartitionFactory(
                    {},
                    null,
                    null
                )({
                    type: 'causal_tree',
                    tree: tree,
                    id: 'testAux',
                }),
            });
            helper.userId = userId;

            await tree.root();
            await helper.createBot('userContext', {
                auxDimension: USERS_CONTEXT,
            });

            uuidMock.mockReturnValueOnce('context');
            await helper.createOrUpdateUserContextBot();

            expect(helper.botsState['context']).toBeUndefined();
        });
    });

    describe('exportBots()', () => {
        it('should only export bots with the given IDs', () => {
            helper = new AuxHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                        test1: createBot('test1'),
                        test2: createBot('test2'),
                    },
                    private: false,
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        abc: createBot('abc'),
                    },
                    private: true,
                }),
            });

            const exported = helper.exportBots(['test', 'abc']);

            expect(exported).toEqual({
                version: 1,
                state: {
                    test: createBot('test', {}, 'shared'),
                    abc: createBot('abc', {}, <any>'abc'),
                },
            });
        });
    });
});
