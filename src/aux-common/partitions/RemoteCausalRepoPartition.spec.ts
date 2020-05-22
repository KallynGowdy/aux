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
} from '@casual-simulation/causal-trees/core2';
import {
    remote,
    DeviceAction,
    device,
    deviceInfo,
    Action,
} from '@casual-simulation/causal-trees';
import flatMap from 'lodash/flatMap';
import { waitAsync } from '../test/TestHelpers';
import { botAdded, createBot, botUpdated, Bot, UpdatedBot } from '../bots';
import { AuxOpType, bot, tag, value } from '../aux-format-2';
import { RemoteCausalRepoPartitionConfig } from './AuxPartitionConfig';

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
        }
    });
});
