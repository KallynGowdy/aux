import { CausalRepoClient } from './CausalRepoClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import { Subject } from 'rxjs';
import { waitAsync } from './test/TestHelpers';
import {
    WATCH_BRANCH,
    AddAtomsEvent,
    ADD_ATOMS,
    ATOMS_RECEIVED,
    AtomsReceivedEvent,
    WATCH_BRANCHES,
    LOAD_BRANCH,
    UNLOAD_BRANCH,
    LoadBranchEvent,
    UnloadBranchEvent,
    UNWATCH_BRANCH,
    UNWATCH_BRANCHES,
    WATCH_DEVICES,
    DEVICE_CONNECTED_TO_BRANCH,
    DisconnectedFromBranchEvent,
    ConnectedToBranchEvent,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    UNWATCH_DEVICES,
} from './CausalRepoEvents';
import { Atom, atom, atomId } from './Atom2';
import { deviceInfo } from '..';

describe('CausalRepoClient', () => {
    let client: CausalRepoClient;
    let connection: MemoryConnectionClient;

    beforeEach(() => {
        connection = new MemoryConnectionClient();
        client = new CausalRepoClient(connection);
    });

    describe('watchBranch()', () => {
        it('should send a watch branch event after connecting', async () => {
            client.watchBranch('abc').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);
        });

        it('should return an observable of atoms for the branch', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[];
            connection.connect();
            client.watchBranch('abc').subscribe(a => atoms.push(...a));

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), a1, {});

            addAtoms.next({
                branch: 'abc',
                atoms: [a1, a2],
            });

            addAtoms.next({
                branch: 'other',
                atoms: [b1, b2],
            });

            await waitAsync();

            expect(atoms).toEqual([a1, a2]);
        });

        it('should send a watch branch event after disconnecting and reconnecting', async () => {
            connection.connect();
            client.watchBranch('abc').subscribe();

            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);

            connection.disconnect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);

            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);
        });

        it('should remember atoms that were sent to the branch and resend them after reconnecting if they were not acknowledged', async () => {
            const atomsReceived = new Subject<AtomsReceivedEvent>();
            connection.events.set(ATOMS_RECEIVED, atomsReceived);
            connection.connect();
            client.watchBranch('abc').subscribe();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            client.addAtoms('abc', [a1, a2, a3]);

            atomsReceived.next({
                branch: 'abc',
                hashes: [a1.hash],
            });

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages.slice(2)).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a2, a3],
                    },
                },
            ]);
        });

        it('should allow the first list of atoms even if it is empty', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[][];
            connection.connect();
            client.watchBranch('abc').subscribe(a => atoms.push(a));

            await waitAsync();

            addAtoms.next({
                branch: 'abc',
                atoms: [],
            });

            await waitAsync();

            expect(atoms).toEqual([[]]);
        });

        it('should send a unwatch branch event when unsubscribed', async () => {
            const sub = client.watchBranch('abc').subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
                {
                    name: UNWATCH_BRANCH,
                    data: 'abc',
                },
            ]);
        });
    });

    describe('addAtoms()', () => {
        it('should send a add atoms event', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            client.addAtoms('abc', [a1, a2]);

            expect(connection.sentMessages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });
    });

    describe('forcedOffline', () => {
        it('should disconnect when set set to true', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe(state => states.push(state));

            connection.connect();
            client.forcedOffline = true;

            await waitAsync();

            expect(states).toEqual([false, true, false]);
        });

        it('should reconnect when set set back to false', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe(state => states.push(state));

            connection.connect();
            client.forcedOffline = true;
            client.forcedOffline = false;

            await waitAsync();

            expect(states).toEqual([false, true, false, true]);
        });
    });

    describe('watchBranches()', () => {
        it('should send a watch_branches event after connecting', async () => {
            client.watchBranches().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCHES,
                    data: undefined,
                },
            ]);
        });

        it('should return an observable of branch loaded/unloaded events', async () => {
            let loadedBranches: string[] = [];
            let unloadedBranches: string[] = [];
            client.watchBranches().subscribe(e => {
                if (e.type === LOAD_BRANCH) {
                    loadedBranches.push(e.branch);
                } else {
                    unloadedBranches.push(e.branch);
                }
            });

            let loadBranch = new Subject<LoadBranchEvent>();
            let unloadBranch = new Subject<UnloadBranchEvent>();
            connection.events.set(LOAD_BRANCH, loadBranch);
            connection.events.set(UNLOAD_BRANCH, unloadBranch);

            connection.connect();
            await waitAsync();

            loadBranch.next({
                branch: 'abc',
            });

            unloadBranch.next({
                branch: 'def',
            });
            await waitAsync();

            expect(loadedBranches).toEqual(['abc']);
            expect(unloadedBranches).toEqual(['def']);
        });

        it('should send a unwatch branches event when unsubscribed', async () => {
            const sub = client.watchBranches().subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCHES,
                    data: undefined,
                },
                {
                    name: UNWATCH_BRANCHES,
                    data: undefined,
                },
            ]);
        });
    });

    describe('watchDevices()', () => {
        it('should send a watch devices event after connecting', async () => {
            client.watchDevices().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_DEVICES,
                    data: undefined,
                },
            ]);
        });

        it('should return an observable of connected/disconnected events', async () => {
            let connections: ConnectedToBranchEvent[] = [];
            let disconnections: DisconnectedFromBranchEvent[] = [];
            client.watchDevices().subscribe(e => {
                if (e.type === DEVICE_CONNECTED_TO_BRANCH) {
                    connections.push(e);
                } else {
                    disconnections.push(e);
                }
            });

            let connect = new Subject<ConnectedToBranchEvent>();
            let disconnect = new Subject<DisconnectedFromBranchEvent>();
            connection.events.set(DEVICE_CONNECTED_TO_BRANCH, connect);
            connection.events.set(DEVICE_DISCONNECTED_FROM_BRANCH, disconnect);

            const device1 = deviceInfo('device1', 'device1', 'device1');
            const device2 = deviceInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                branch: 'abc',
                device: device1,
            });

            disconnect.next({
                branch: 'def',
                device: device2,
            });
            await waitAsync();

            expect(connections).toEqual([
                {
                    type: DEVICE_CONNECTED_TO_BRANCH,
                    branch: 'abc',
                    device: device1,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: DEVICE_DISCONNECTED_FROM_BRANCH,
                    branch: 'def',
                    device: device2,
                },
            ]);
        });

        it('should send a unwatch devices event when unsubscribed', async () => {
            const sub = client.watchDevices().subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_DEVICES,
                    data: undefined,
                },
                {
                    name: UNWATCH_DEVICES,
                    data: undefined,
                },
            ]);
        });
    });
});
