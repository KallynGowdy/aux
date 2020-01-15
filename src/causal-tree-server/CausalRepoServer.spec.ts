import { CausalRepoServer } from './CausalRepoServer';
import {
    MemoryConnectionServer,
    MemoryConnection,
} from './MemoryConnectionServer';
import {
    MemoryCausalRepoStore,
    atom,
    atomId,
    index,
    commit,
    branch,
    storeData,
    updateBranch,
    loadCommit,
    loadBranch,
    AddAtomsEvent,
    WATCH_BRANCH,
    ADD_ATOMS,
    UNWATCH_BRANCH,
    WATCH_BRANCHES,
    LOAD_BRANCH,
    UNLOAD_BRANCH,
    WATCH_DEVICES,
    DEVICE_CONNECTED_TO_BRANCH,
    UNWATCH_DEVICES,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    MemoryStageStore,
    ATOMS_RECEIVED,
    BRANCH_INFO,
    SEND_EVENT,
    SendRemoteActionEvent,
    RECEIVE_EVENT,
    BRANCHES,
    atomIdToString,
    COMMIT,
    CommitEvent,
    WATCH_COMMITS,
    ADD_COMMITS,
    CHECKOUT,
    CheckoutEvent,
} from '@casual-simulation/causal-trees/core2';
import { waitAsync } from './test/TestHelpers';
import { Subject } from 'rxjs';
import {
    DeviceInfo,
    deviceInfo,
    remote,
    SESSION_ID_CLAIM,
    device as deviceEvent,
} from '@casual-simulation/causal-trees';

console.log = jest.fn();

const device1Info = deviceInfo('device1', 'device1', 'device1');
const device2Info = deviceInfo('device2', 'device2', 'device2');
const device3Info = deviceInfo('device3', 'device3', 'device3');
const device4Info = deviceInfo('device4', 'device4', 'device4');

describe('CausalRepoServer', () => {
    let server: CausalRepoServer;
    let connections: MemoryConnectionServer;
    let store: MemoryCausalRepoStore;
    let stageStore: MemoryStageStore;

    beforeEach(() => {
        store = new MemoryCausalRepoStore();
        stageStore = new MemoryStageStore();
        connections = new MemoryConnectionServer();
        server = new CausalRepoServer(connections, store, stageStore);
    });

    describe(WATCH_BRANCH, () => {
        it('should load the given branch and send the current atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should create a new orphan branch if the branch name does not exist', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);
            await waitAsync();

            joinBranch.next('doesNotExist');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'doesNotExist',
                        atoms: [],
                    },
                },
            ]);
        });

        it('should be able to accept multiple requests to watch a branch at a time', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');
            joinBranch2.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should load the atoms from the stage', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            await stageStore.addAtoms('testBranch', [a3]);

            joinBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);
        });
    });

    describe(UNWATCH_BRANCH, () => {
        it('should stop sending new atoms to devices that have left a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch1 = new Subject<string>();
            const leaveBranch1 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch1);
            device2.events.set(UNWATCH_BRANCH, leaveBranch1);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a3, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);
            await waitAsync();

            joinBranch1.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });
            await waitAsync();

            leaveBranch1.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a4],
            });
            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);
        });

        it('should commit changes before unloading a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            const [savedBranch] = await store.getBranches('testBranch');
            expect(savedBranch.hash).not.toBe(b.hash);

            const savedCommit = await loadBranch(store, savedBranch);
            expect([...savedCommit.atoms.values()]).toEqual([a1, a2, a3]);
            expect(savedCommit.commit.message).toEqual('Save before unload');
        });

        it('should clear the stored stage after commiting', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            const stage = await stageStore.getStage('testBranch');
            expect(stage).toEqual({
                additions: [],
                deletions: {},
            });
        });
    });

    describe(WATCH_BRANCHES, () => {
        it('should issue an event when a branch is loaded', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it('should issue an event for each branch that is already loaded', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch2');
            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch2',
                    },
                },
            ]);
        });

        it('should issue an event when a branch is unloaded via unwatching leaving', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: UNLOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it('should issue an event when a branch is unloaded via disconnecting', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            device.disconnect.next();
            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: UNLOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });
    });

    describe(ADD_ATOMS, () => {
        it('should add the given atoms to the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            joinBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },

                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch2.next('testBranch');
            joinBranch3.next('testBranch');

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);
        });

        it('should not notify the device that sent the new atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const joinBranch = new Subject<string>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const [repoAtom] = await store.getObjects([a3.hash]);
            expect(repoAtom).toEqual({
                type: 'atom',
                data: a3,
            });
        });

        it('should not send atoms that are already in the current commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, a3, idx, c]);
            await updateBranch(store, b);

            joinBranch2.next('testBranch');
            joinBranch3.next('testBranch');

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);

            expect(device.messages).toEqual([
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should add the atoms to the stage store', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const stage = await stageStore.getStage('testBranch');

            expect(stage).toEqual({
                additions: [a3],
                deletions: {},
            });
        });

        it('should remove the given atoms from to the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, a3, idx, c]);
            await updateBranch(store, b);

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            joinBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },

                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, a3, idx, c]);
            await updateBranch(store, b);

            joinBranch2.next('testBranch');
            joinBranch3.next('testBranch');

            await waitAsync();

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        removedAtoms: [a3.hash],
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        removedAtoms: [a3.hash],
                    },
                },
            ]);
        });

        it('should not notify the device that removed the atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            const joinBranch = new Subject<string>();
            device.events.set(ADD_ATOMS, removeAtoms);
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, a3, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');

            await waitAsync();

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should not send atoms that were already removed from the current commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch2.next('testBranch');
            joinBranch3.next('testBranch');

            await waitAsync();

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);

            expect(device.messages).toEqual([
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should add the removed atoms to the stage store', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, a3, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            const stage = await stageStore.getStage('testBranch');

            expect(stage).toEqual({
                additions: [],
                deletions: {
                    [a3.hash]: atomIdToString(a3.id),
                },
            });
        });
    });

    describe(COMMIT, () => {
        it('should commit the current changes to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const makeCommit = new Subject<CommitEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(COMMIT, makeCommit);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            makeCommit.next({
                branch: 'testBranch',
                message: 'newCommit',
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const data = await loadBranch(store, testBranch);

            expect(data.commit.message).toBe('newCommit');
            expect(data.commit.previousCommit).toBe(c.hash);
            expect(data.atoms).toEqual(
                new Map([[a1.hash, a1], [a2.hash, a2], [a3.hash, a3]])
            );
        });

        it('should send the new commit to all devices watching for commits', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const makeCommit = new Subject<CommitEvent>();
            const watchCommits = new Subject<string>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(COMMIT, makeCommit);
            device.events.set(WATCH_COMMITS, watchCommits);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            watchCommits.next('testBranch');

            await waitAsync();

            makeCommit.next({
                branch: 'testBranch',
                message: 'newCommit',
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const [newCommit] = await store.getObjects([testBranch.hash]);

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
                {
                    name: ADD_COMMITS,
                    data: {
                        branch: 'testBranch',
                        commits: [c],
                    },
                },
                {
                    name: ADD_COMMITS,
                    data: {
                        branch: 'testBranch',
                        commits: [newCommit],
                    },
                },
            ]);
        });
    });

    describe(WATCH_COMMITS, () => {
        it('should send the commits for the branch when first connected', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchCommits = new Subject<string>();
            device.events.set(WATCH_COMMITS, watchCommits);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a2, a3);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, [a1, a2, a3, idx1, idx2, c1, c2]);
            await updateBranch(store, b);

            watchCommits.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send all the existing commits
                {
                    name: ADD_COMMITS,
                    data: {
                        branch: 'testBranch',
                        commits: [c2, c1],
                    },
                },
            ]);
        });
    });

    describe(CHECKOUT, () => {
        it('should reset the given branch to the given commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const checkout = new Subject<CheckoutEvent>();
            device.events.set(CHECKOUT, checkout);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a2, a3);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, [a1, a2, a3, idx1, idx2, c1, c2]);
            await updateBranch(store, b);

            checkout.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const [branchCommit] = await store.getObjects([testBranch.hash]);

            expect(branchCommit).toEqual(c1);
        });

        it(`should send a ADD_ATOMS event with difference between the two commits`, async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const checkout = new Subject<CheckoutEvent>();
            const watchBranch = new Subject<string>();
            device.events.set(CHECKOUT, checkout);
            device.events.set(WATCH_BRANCH, watchBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, [a1, a2, a3, a4, a5, idx1, idx2, c1, c2]);
            await updateBranch(store, b);

            watchBranch.next('testBranch');

            await waitAsync();

            checkout.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a4, a5],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                        removedAtoms: [a4.hash, a5.hash],
                    },
                },
            ]);
        });
    });

    describe(SEND_EVENT, () => {
        it('should notify the device that the event was sent to', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next('testBranch');
            joinBranch3.next('testBranch');

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        sessionId: device3Info.claims[SESSION_ID_CLAIM],
                    }
                ),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(device1Info, {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should send remote events to the default selector if none is specified', async () => {
            server.defaultDeviceSelector = {
                sessionId: device2Info.claims[SESSION_ID_CLAIM],
            };
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next('testBranch');
            joinBranch3.next('testBranch');

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remote({
                    type: 'abc',
                }),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(device1Info, {
                            type: 'abc',
                        }),
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                    },
                },
            ]);
        });
    });

    describe(WATCH_DEVICES, () => {
        it('should send an event when a device connects to a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            const leaveBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);
            device2.events.set(UNWATCH_BRANCH, leaveBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next('testBranch');
            await waitAsync();

            leaveBranch2.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next('testBranch');
            await waitAsync();

            device2.disconnect.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send events for all the currently loaded branches and devices', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            const device4 = new MemoryConnection(device4Info);
            const joinBranch4 = new Subject<string>();
            device4.events.set(WATCH_BRANCH, joinBranch4);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);
            connections.connection.next(device4);
            await waitAsync();

            joinBranch2.next('testBranch');
            await waitAsync();

            joinBranch3.next('testBranch2');
            await waitAsync();

            joinBranch4.next('testBranch2');
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch2',
                        device: device3Info,
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch2',
                        device: device4Info,
                    },
                },
            ]);
        });
    });

    describe(BRANCH_INFO, () => {
        it('should send a response with false when the given branch does not exist', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branchInfo = new Subject<string>();
            device.events.set(BRANCH_INFO, branchInfo);

            connections.connection.next(device);
            await waitAsync();

            branchInfo.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCH_INFO,
                    data: {
                        branch: 'testBranch',
                        exists: false,
                    },
                },
            ]);
        });

        it('should send a response with true when the given branch exists', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branchInfo = new Subject<string>();
            device.events.set(BRANCH_INFO, branchInfo);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            branchInfo.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCH_INFO,
                    data: {
                        branch: 'testBranch',
                        exists: true,
                    },
                },
            ]);
        });
    });

    describe(BRANCHES, () => {
        it('should send a response with the list of branch names', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branches = new Subject<void>();
            device.events.set(BRANCHES, branches);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);
            const b2 = branch('testBranch2', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b1);
            await updateBranch(store, b2);

            branches.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCHES,
                    data: {
                        branches: ['testBranch', 'testBranch2'],
                    },
                },
            ]);
        });
    });
    // describe(UNWATCH_DEVICES, () => {
    //     it('should stop sending events when a device connects to a branch', async () => {
    //         server.init();

    //         const device = new MemoryConnection('testDevice');
    //         const watchDevices = new Subject<void>();
    //         device.events.set(WATCH_DEVICES, watchDevices);

    //         const device1 = new MemoryConnection('testDevice1');
    //         const joinBranch1 = new Subject<string>();
    //         device1.events.set(WATCH_BRANCH, joinBranch1);

    //         connections.connection.next(device);
    //         connections.connection.next(device1);
    //         await waitAsync();

    //         watchDevices.next();
    //         await waitAsync();

    //         joinBranch1.next('testBranch');
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: DEVICE_CONNECTED_TO_BRANCH,
    //                 data: {
    //                     branch: 'testBranch',
    //                     connectionId: 'testDevice1'
    //                 },
    //             },
    //         ]);
    //     });
    // });
});
