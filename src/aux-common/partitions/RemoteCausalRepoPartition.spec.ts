import { testPartitionImplementation } from './test/PartitionTests';
import { RemoteCausalRepoPartitionImpl } from './RemoteCausalRepoPartition';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import {
    Atom,
    atom,
    atomId,
    ADD_ATOMS,
    AddAtomsEvent,
    MemoryConnectionClient,
    CausalRepoClient,
    SEND_EVENT,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    COMMIT,
    WATCH_COMMITS,
    GET_BRANCH,
    WATCH_BRANCH,
    DEVICES,
    DevicesEvent,
    BRANCHES_STATUS,
    BranchesStatusEvent,
} from '@casual-simulation/causal-trees/core2';
import {
    remote,
    DeviceAction,
    device,
    deviceInfo,
    Action,
    BRANCHES,
    BranchesEvent,
} from '@casual-simulation/causal-trees';
import flatMap from 'lodash/flatMap';
import { waitAsync } from '../test/TestHelpers';
import {
    botAdded,
    createBot,
    botUpdated,
    Bot,
    UpdatedBot,
    unlockSpace,
    asyncResult,
    asyncError,
    getPlayerCount,
    getStories,
    BotActions,
    getPlayers,
    action,
    ON_REMOTE_WHISPER_ACTION_NAME,
    getStoryStatuses,
} from '../bots';
import { AuxOpType, bot, tag, value, AuxCausalTree } from '../aux-format-2';
import { RemoteCausalRepoPartitionConfig } from './AuxPartitionConfig';
import { info } from 'console';

console.log = jest.fn();

describe('RemoteCausalRepoPartition', () => {
    testPartitionImplementation(async () => {
        const connection = new MemoryConnectionClient();
        const addAtoms = new BehaviorSubject<AddAtomsEvent>({
            branch: 'testBranch',
            atoms: [atom(atomId('a', 1), null, {})],
        });
        connection.events.set(ADD_ATOMS, addAtoms);

        const client = new CausalRepoClient(connection);
        connection.connect();

        return new RemoteCausalRepoPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            client,
            {
                type: 'remote_causal_repo',
                branch: 'testBranch',
                host: 'testHost',
            }
        );
    });

    describe('connection', () => {
        let connection: MemoryConnectionClient;
        let client: CausalRepoClient;
        let partition: RemoteCausalRepoPartitionImpl;
        let receiveEvent: Subject<ReceiveDeviceActionEvent>;
        let addAtoms: Subject<AddAtomsEvent>;
        let added: Bot[];
        let removed: string[];
        let updated: UpdatedBot[];
        let errors: any[];
        let sub: Subscription;

        beforeEach(async () => {
            connection = new MemoryConnectionClient();
            receiveEvent = new Subject<ReceiveDeviceActionEvent>();
            addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(RECEIVE_EVENT, receiveEvent);
            connection.events.set(ADD_ATOMS, addAtoms);
            client = new CausalRepoClient(connection);
            connection.connect();
            sub = new Subscription();

            added = [];
            removed = [];
            updated = [];
            errors = [];

            setupPartition({
                type: 'remote_causal_repo',
                branch: 'testBranch',
                host: 'testHost',
            });
        });

        afterEach(() => {
            sub.unsubscribe();
        });

        it('should return immediate for the realtimeStrategy if the partition is not static', () => {
            expect(partition.realtimeStrategy).toEqual('immediate');
        });

        it('should return delayed for the realtimeStrategy if the partition is static', () => {
            setupPartition({
                type: 'remote_causal_repo',
                branch: 'testBranch',
                host: 'testHost',
                static: true,
            });
            expect(partition.realtimeStrategy).toEqual('delayed');
        });

        it('should use the given space for bot events', async () => {
            partition.space = 'test';
            partition.connect();

            await partition.applyEvents([
                botAdded(
                    createBot(
                        'test1',
                        {
                            abc: 'def',
                        },
                        <any>'other'
                    )
                ),
            ]);

            await waitAsync();

            expect(added).toEqual([
                createBot(
                    'test1',
                    {
                        abc: 'def',
                    },
                    <any>'test'
                ),
            ]);
        });

        it('should use the given space for new atoms', async () => {
            partition.space = 'test';
            partition.connect();

            const bot1 = atom(atomId('a', 1), null, bot('bot1'));
            const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
            const value1 = atom(atomId('a', 3), tag1, value('abc'));

            addAtoms.next({
                branch: 'testBranch',
                atoms: [bot1, tag1, value1],
            });

            await waitAsync();

            expect(added).toEqual([
                createBot(
                    'bot1',
                    {
                        tag1: 'abc',
                    },
                    <any>'test'
                ),
            ]);
        });

        it('should send a WATCH_BRANCH event to the server', async () => {
            setupPartition({
                type: 'remote_causal_repo',
                branch: 'testBranch',
                host: 'testHost',
            });

            partition.connect();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'testBranch',
                        siteId: partition.tree.site.id,
                    },
                },
            ]);
        });

        describe('remote events', () => {
            it('should send the remote event to the server', async () => {
                await partition.sendRemoteEvents([
                    remote(
                        {
                            type: 'def',
                        },
                        {
                            deviceId: 'device',
                        }
                    ),
                ]);

                expect(connection.sentMessages).toEqual([
                    {
                        name: SEND_EVENT,
                        data: {
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'def',
                                },
                                {
                                    deviceId: 'device',
                                }
                            ),
                        },
                    },
                ]);
            });

            it('should not send the remote event if remote events are disabled', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    remoteEvents: false,
                });

                await partition.sendRemoteEvents([
                    remote(
                        {
                            type: 'def',
                        },
                        {
                            deviceId: 'device',
                        }
                    ),
                ]);

                expect(connection.sentMessages).toEqual([]);
            });

            it('should listen for device events from the connection', async () => {
                let events = [] as Action[];
                partition.onEvents.subscribe(e => events.push(...e));

                const action = device(
                    deviceInfo('username', 'device', 'session'),
                    {
                        type: 'abc',
                    }
                );
                partition.connect();

                receiveEvent.next({
                    branch: 'testBranch',
                    action: action,
                });

                await waitAsync();

                expect(events).toEqual([action]);
            });

            it('should not send events when in readOnly mode', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    readOnly: true,
                });

                await partition.sendRemoteEvents([
                    remote(
                        {
                            type: 'def',
                        },
                        {
                            deviceId: 'device',
                        }
                    ),
                ]);

                expect(connection.sentMessages).toEqual([]);
            });

            it('should not send events when in static mode', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                await partition.sendRemoteEvents([
                    remote(
                        {
                            type: 'def',
                        },
                        {
                            deviceId: 'device',
                        }
                    ),
                ]);

                expect(connection.sentMessages).toEqual([]);
            });

            describe('mark_history', () => {
                it(`should send a ${COMMIT} event to the server`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    await partition.sendRemoteEvents([
                        remote(<any>{
                            type: 'mark_history',
                            message: 'newCommit',
                        }),
                    ]);

                    expect(connection.sentMessages).toEqual([
                        {
                            name: COMMIT,
                            data: {
                                branch: 'testBranch',
                                message: 'newCommit',
                            },
                        },
                    ]);
                });
            });

            describe('browse_history', () => {
                it(`should send a load_space action`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    let events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    await partition.sendRemoteEvents([
                        remote(<any>{
                            type: 'browse_history',
                        }),
                    ]);

                    expect(events).toEqual([
                        {
                            type: 'load_space',
                            space: 'history',
                            config: {
                                type: 'causal_repo_history_client',
                                branch: 'testBranch',
                                client: expect.anything(),
                            },
                        },
                    ]);
                });
            });

            describe('get_player_count', () => {
                it(`should send a ${DEVICES} event to the server`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    await partition.sendRemoteEvents([
                        remote(getPlayerCount('testBranch')),
                    ]);

                    expect(connection.sentMessages).toEqual([
                        {
                            name: DEVICES,
                            data: 'testBranch',
                        },
                    ]);
                });

                it(`should send an async result with the response`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    const devices = new Subject<DevicesEvent>();
                    connection.events.set(DEVICES, devices);

                    await partition.sendRemoteEvents([
                        remote(
                            getPlayerCount('testBranch'),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ]);

                    await waitAsync();

                    const events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    const info1 = deviceInfo('info1', 'info1', 'info1');
                    const info2 = deviceInfo('info2', 'info2', 'info2');
                    devices.next({
                        devices: [info1, info2],
                    });

                    await waitAsync();

                    expect(events).toEqual([asyncResult('task1', 2)]);
                });

                it(`should filter out the server player`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    const devices = new Subject<DevicesEvent>();
                    connection.events.set(DEVICES, devices);

                    await partition.sendRemoteEvents([
                        remote(
                            getPlayerCount('testBranch'),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ]);

                    await waitAsync();

                    const events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    const info1 = deviceInfo('info1', 'info1', 'info1');
                    const info2 = deviceInfo('Server', 'info2', 'info2');
                    devices.next({
                        devices: [info1, info2],
                    });

                    await waitAsync();

                    expect(events).toEqual([asyncResult('task1', 1)]);
                });
            });

            describe('get_stories', () => {
                it(`should send a ${BRANCHES} event to the server`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    await partition.sendRemoteEvents([
                        remote(getStories(), undefined, undefined, 'task1'),
                    ]);

                    expect(connection.sentMessages).toEqual([
                        {
                            name: BRANCHES,
                            data: undefined,
                        },
                    ]);
                });

                it(`should send a ${BRANCHES_STATUS} event to the server if told to include statuses`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    await partition.sendRemoteEvents([
                        remote(
                            getStoryStatuses(),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ]);

                    expect(connection.sentMessages).toEqual([
                        {
                            name: BRANCHES_STATUS,
                            data: undefined,
                        },
                    ]);
                });

                it(`should send an async result with the response`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    const branches = new Subject<BranchesEvent>();
                    connection.events.set(BRANCHES, branches);

                    await partition.sendRemoteEvents([
                        remote(getStories(), undefined, undefined, 'task1'),
                    ]);

                    await waitAsync();

                    const events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    branches.next({
                        branches: ['abc', 'def'],
                    });

                    await waitAsync();

                    expect(events).toEqual([
                        asyncResult('task1', ['abc', 'def']),
                    ]);
                });

                it('should filter out branches that start with a dollar sign ($)', async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    const branches = new Subject<BranchesEvent>();
                    connection.events.set(BRANCHES, branches);

                    await partition.sendRemoteEvents([
                        remote(getStories(), undefined, undefined, 'task1'),
                    ]);

                    await waitAsync();

                    const events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    branches.next({
                        branches: ['$admin', '$$hello', 'abc', 'def'],
                    });

                    await waitAsync();

                    expect(events).toEqual([
                        asyncResult('task1', ['abc', 'def']),
                    ]);
                });

                it(`should filter out branches that start with a dollar sign when including statuses`, async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    const branches = new Subject<BranchesStatusEvent>();
                    connection.events.set(BRANCHES_STATUS, branches);

                    await partition.sendRemoteEvents([
                        remote(
                            getStoryStatuses(),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ]);

                    await waitAsync();

                    const events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    branches.next({
                        branches: [
                            {
                                branch: '$admin',
                                lastUpdateTime: new Date(2019, 1, 1),
                            },
                            {
                                branch: '$$other',
                                lastUpdateTime: new Date(2019, 1, 1),
                            },
                            {
                                branch: 'abc',
                                lastUpdateTime: new Date(2019, 1, 1),
                            },
                            {
                                branch: 'def',
                                lastUpdateTime: new Date(2019, 1, 1),
                            },
                        ],
                    });

                    await waitAsync();

                    expect(events).toEqual([
                        asyncResult('task1', [
                            {
                                story: 'abc',
                                lastUpdateTime: new Date(2019, 1, 1),
                            },
                            {
                                story: 'def',
                                lastUpdateTime: new Date(2019, 1, 1),
                            },
                        ]),
                    ]);
                });
            });

            describe('get_players', () => {
                it('should not send a get_players event to the server', async () => {
                    setupPartition({
                        type: 'remote_causal_repo',
                        branch: 'testBranch',
                        host: 'testHost',
                    });
                    partition.connect();

                    await partition.sendRemoteEvents([
                        remote(getPlayers(), undefined, undefined, 'task1'),
                    ]);

                    await waitAsync();

                    expect(connection.sentMessages).not.toContainEqual({
                        name: SEND_EVENT,
                        data: {
                            branch: 'testBranch',
                            action: remote(
                                getPlayers(),
                                undefined,
                                undefined,
                                'task1'
                            ),
                        },
                    });
                });
            });

            describe('action', () => {
                it('should translate a remote shout to a onRemoteWhisper event', async () => {
                    let events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    partition.connect();

                    const info1 = deviceInfo(
                        'info1Username',
                        'info1DeviceId',
                        'info1SessionId'
                    );
                    receiveEvent.next({
                        branch: 'testBranch',
                        action: {
                            type: 'device',
                            device: info1,
                            event: action('eventName', null, null, {
                                abc: 'def',
                            }),
                        },
                    });

                    await waitAsync();

                    expect(events).toEqual([
                        action(ON_REMOTE_WHISPER_ACTION_NAME, null, null, {
                            name: 'eventName',
                            that: { abc: 'def' },
                            playerId: 'info1SessionId',
                        }),
                    ]);
                });

                it('should ignore the bot IDs and userId', async () => {
                    let events = [] as Action[];
                    partition.onEvents.subscribe(e => events.push(...e));

                    partition.connect();

                    const info1 = deviceInfo(
                        'info1Username',
                        'info1DeviceId',
                        'info1SessionId'
                    );
                    receiveEvent.next({
                        branch: 'testBranch',
                        action: {
                            type: 'device',
                            device: info1,
                            event: action('eventName', ['abc'], 'userId', {
                                abc: 'def',
                            }),
                        },
                    });

                    await waitAsync();

                    expect(events).toEqual([
                        action(ON_REMOTE_WHISPER_ACTION_NAME, null, null, {
                            name: 'eventName',
                            that: { abc: 'def' },
                            playerId: 'info1SessionId',
                        }),
                    ]);
                });
            });
        });

        describe('remove atoms', () => {
            it('should remove the given atoms from the tree', async () => {
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot('newBot', {
                            abc: 'def',
                        })
                    ),
                ]);

                const addedAtoms = flatMap(
                    connection.sentMessages.filter(m => m.name === ADD_ATOMS),
                    m => m.data.atoms
                );
                const newBotAtom = addedAtoms.find(
                    a =>
                        a.value.type === AuxOpType.bot &&
                        a.value.id === 'newBot'
                );

                addAtoms.next({
                    branch: 'testBranch',
                    removedAtoms: [newBotAtom.hash],
                });

                await waitAsync();

                expect(partition.state['newBot']).toBeUndefined();
            });

            it('should send removed atoms to the repo', async () => {
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot('newBot', {
                            abc: 'def',
                        })
                    ),
                ]);

                await partition.applyEvents([
                    botUpdated('newBot', {
                        tags: {
                            abc: '123',
                        },
                    }),
                ]);

                const addedAtoms = flatMap(
                    connection.sentMessages.filter(m => m.name === ADD_ATOMS),
                    m => m.data.atoms
                );
                const oldValueAtom = addedAtoms.find(
                    a =>
                        a.value.type === AuxOpType.value &&
                        a.value.value === 'def'
                );

                expect(connection.sentMessages).toContainEqual({
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: expect.anything(),
                        removedAtoms: [oldValueAtom.hash],
                    },
                });
            });
        });

        describe('remote atoms', () => {
            it('should add the given atoms to the tree and update the state', async () => {
                partition.connect();

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });
                await waitAsync();

                expect(added).toEqual([
                    createBot('bot1', {
                        tag1: 'abc',
                    }),
                ]);
            });

            it('should merge merge added bots and updates', async () => {
                partition.connect();

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));
                const value2 = atom(atomId('a', 4), tag1, value('newValue'));

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1, value2],
                });
                await waitAsync();

                expect(added).toEqual([
                    createBot('bot1', {
                        tag1: 'newValue',
                    }),
                ]);
                expect(removed).toEqual([]);
                expect(updated).toEqual([]);
            });
        });

        describe('atoms', () => {
            it('should not send new atoms to the server if in readOnly mode', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    readOnly: true,
                });

                partition.connect();

                await partition.applyEvents([botAdded(createBot('bot1'))]);
                await waitAsync();

                expect(connection.sentMessages.slice(1)).toEqual([]);
            });

            it('should not send new atoms to the server if in static mode', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                partition.connect();

                await partition.applyEvents([botAdded(createBot('bot1'))]);
                await waitAsync();

                expect(connection.sentMessages.slice(1)).toEqual([]);
            });

            it('should handle an ADD_ATOMS event without any new atoms', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                partition.connect();

                const a1 = atom(atomId('a', 1), null, {});

                addAtoms.next({
                    branch: 'testBranch',
                    removedAtoms: [a1.hash],
                });
                await waitAsync();

                expect(errors).toEqual([]);
            });
        });

        describe('static mode', () => {
            it('should send a GET_BRANCH event when in static mode', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                expect(connection.sentMessages).toEqual([]);
                partition.connect();

                await waitAsync();

                expect(connection.sentMessages).toEqual([
                    {
                        name: GET_BRANCH,
                        data: 'testBranch',
                    },
                ]);
            });

            it('should not apply atoms to the causal tree', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                expect(connection.sentMessages).toEqual([]);
                partition.connect();

                const ret = await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]);

                expect(ret).toEqual([]);
                expect(partition.state).toEqual({});
            });

            it('should load the initial state properly', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                expect(partition.state).toEqual({
                    bot1: createBot('bot1', {
                        tag1: 'abc',
                    }),
                });
            });

            it('should transition to non static when a unlock_space event is sent', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                await partition.applyEvents([
                    unlockSpace(<any>'admin', '3342'),
                    botAdded(
                        createBot('test1', {
                            hello: 'world',
                        })
                    ),
                ]);

                expect(partition.state).toEqual({
                    bot1: createBot('bot1', {
                        tag1: 'abc',
                    }),
                    test1: createBot('test1', {
                        hello: 'world',
                    }),
                });
            });

            it('should transition to non read only when a unlock_space event is sent', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                    readOnly: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                const tree = (<any>partition)._tree as AuxCausalTree;
                const test1 = atom(atomId(tree.site.id, 5), null, bot('test1'));
                const helloTag = atom(
                    atomId(tree.site.id, 6),
                    test1,
                    tag('hello')
                );
                const worldValue = atom(
                    atomId(tree.site.id, 7),
                    helloTag,
                    value('world')
                );

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                await partition.applyEvents([
                    unlockSpace('admin', '3342'),
                    botAdded(
                        createBot('test1', {
                            hello: 'world',
                        })
                    ),
                ]);

                expect(connection.sentMessages.slice(2)).toEqual([
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: 'testBranch',
                            atoms: [test1, helloTag, worldValue],
                        },
                    },
                ]);
            });

            it('should not transition when a unlock_space event is sent with the wrong password', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                    readOnly: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                await partition.applyEvents([
                    unlockSpace('admin', 'wrong'),
                    botAdded(
                        createBot('test1', {
                            hello: 'world',
                        })
                    ),
                ]);

                expect(connection.sentMessages.slice(2)).toEqual([]);
            });

            it('should not try to connect if it is not already connected', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                    readOnly: true,
                });

                await partition.applyEvents([unlockSpace('admin', '3342')]);

                expect(connection.sentMessages.length).toEqual(0);
            });

            it('should be able to unlock while waiting for the initial connection to finish', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                    readOnly: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                await partition.applyEvents([unlockSpace('admin', '3342')]);

                expect(connection.sentMessages).toEqual([
                    {
                        name: GET_BRANCH,
                        data: 'testBranch',
                    },
                ]);

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                expect(connection.sentMessages.slice(1)).toEqual([
                    {
                        name: WATCH_BRANCH,
                        data: {
                            branch: 'testBranch',
                            siteId: partition.tree.site.id,
                        },
                    },
                ]);
            });

            it('should resolve the async task when unlocked', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                    readOnly: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                let events = [] as Action[];
                partition.onEvents.subscribe(e => events.push(...e));
                await partition.applyEvents([
                    unlockSpace('admin', '3342', 123),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult(123, undefined)]);
            });

            it('should resolve the async task if already unlocked', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                let events = [] as Action[];
                partition.onEvents.subscribe(e => events.push(...e));
                await partition.applyEvents([
                    unlockSpace('admin', '3342', 123),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult(123, undefined)]);
            });

            it('should reject the async task if given the wrong password', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                    readOnly: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });

                let events = [] as Action[];
                partition.onEvents.subscribe(e => events.push(...e));

                await partition.applyEvents([
                    unlockSpace('admin', 'wrong', 123),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    asyncError(
                        123,
                        new Error(
                            'Unable to unlock the space because the passcode is incorrect.'
                        )
                    ),
                ]);
            });
        });

        describe('temporary', () => {
            it('should load the given branch as temporary', async () => {
                setupPartition({
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                    temporary: true,
                });

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                partition.connect();

                await waitAsync();

                expect(connection.sentMessages).toEqual([
                    {
                        name: WATCH_BRANCH,
                        data: {
                            branch: 'testBranch',
                            siteId: partition.tree.site.id,
                            temporary: true,
                        },
                    },
                ]);
            });
        });

        function setupPartition(config: RemoteCausalRepoPartitionConfig) {
            partition = new RemoteCausalRepoPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                client,
                config
            );

            sub.add(partition);
            sub.add(partition.onBotsAdded.subscribe(b => added.push(...b)));
            sub.add(partition.onBotsRemoved.subscribe(b => removed.push(...b)));
            sub.add(partition.onBotsUpdated.subscribe(b => updated.push(...b)));
            sub.add(partition.onError.subscribe(e => errors.push(e)));
        }
    });
});
