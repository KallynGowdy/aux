import {
    NodeAuxChannel,
    AuxLoadedChannel,
    nodeSimulationForBranch,
} from '@casual-simulation/aux-vm-node';
import {
    botAdded,
    createBot,
    AuxCausalTree,
    webhook,
    setupChannel,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    DeviceInfo,
    RealtimeChannelInfo,
    storedTree,
    site,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
    deviceInfo,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import { SetupChannelModule2 } from './SetupChannelModule2';
import { AuxUser, AuxConfig, Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import {
    CausalRepoClient,
    MemoryCausalRepoStore,
    MemoryStageStore,
} from '@casual-simulation/causal-trees/core2';
import {
    CausalRepoServer,
    ConnectionBridge,
    FixedConnectionServer,
} from '@casual-simulation/causal-tree-server';
console.log = jest.fn();

describe('SetupChannelModule2', () => {
    let user: AuxUser;
    let serverUser: AuxUser;
    let processingUser: AuxUser;
    let device: DeviceInfo;
    let subject: SetupChannelModule2;
    let serverClient: CausalRepoClient;
    let processingClient: CausalRepoClient;
    let simulation: Simulation;
    let sub: Subscription;

    beforeEach(async () => {
        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        serverUser = {
            id: 'server',
            isGuest: false,
            name: 'Server',
            username: 'server',
            token: 'server',
        };
        processingUser = {
            id: 'processing',
            isGuest: false,
            name: 'Processing',
            username: 'processing',
            token: 'processing',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        const serverDevice = deviceInfo('server', 'server', 'server');
        const processingDevice = deviceInfo(
            'processing',
            'processing',
            'processing'
        );

        const store = new MemoryCausalRepoStore();
        const stageStore = new MemoryStageStore();
        const serverBridge = new ConnectionBridge(serverDevice);
        const processingBridge = new ConnectionBridge(processingDevice);
        const fixedConnectionServer = new FixedConnectionServer([
            serverBridge.serverConnection,
            processingBridge.serverConnection,
        ]);

        const server = new CausalRepoServer(
            fixedConnectionServer,
            store,
            stageStore
        );
        server.init();

        serverClient = new CausalRepoClient(serverBridge.clientConnection);
        processingClient = new CausalRepoClient(
            processingBridge.clientConnection
        );
        subject = new SetupChannelModule2(serverUser, serverClient);

        simulation = nodeSimulationForBranch(user, serverClient, 'id');
        await simulation.init();

        sub = await subject.setup(simulation);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
        simulation.unsubscribe();
    });

    describe('events', () => {
        describe('setup_channel', () => {
            it('should create non-existant channels', async () => {
                expect.assertions(1);

                await simulation.helper.transaction(setupChannel('newChannel'));

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);
            });

            it('should clone the given bot into the new channel', async () => {
                expect.assertions(2);

                await simulation.helper.transaction(
                    setupChannel(
                        'newChannel',
                        createBot('test', {
                            abc: 'def',
                        })
                    )
                );

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                const { result } = await newChannelSim.helper.search(
                    `getBot("abc", "def")`
                );
                expect(result).toEqual(
                    createBot(result.id, {
                        abc: 'def',
                    })
                );
            });

            it('should clone the given mod into the new channel', async () => {
                expect.assertions(2);

                await simulation.helper.transaction(
                    setupChannel('newChannel', {
                        abc: 'def',
                    })
                );

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                const { result } = await newChannelSim.helper.search(
                    `getBot("abc", "def")`
                );
                expect(result).toEqual(
                    createBot(result.id, {
                        abc: 'def',
                    })
                );
            });

            it('should call onCreate() on the new bot', async () => {
                expect.assertions(2);

                await simulation.helper.transaction(
                    setupChannel('newChannel', {
                        onCreate: '@setTag(this, "created", true)',
                    })
                );

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                const { result } = await newChannelSim.helper.search(
                    `getBot("created", true)`
                );
                expect(result).toEqual(
                    createBot(result.id, {
                        onCreate: '@setTag(this, "created", true)',
                        created: true,
                    })
                );
            });

            it('should not add the new bot if the channel already exists', async () => {
                expect.assertions(1);

                // Creates the new channel
                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                await simulation.helper.transaction(
                    setupChannel('newChannel', {
                        test: 'abc',
                    })
                );

                await waitAsync();

                const { result } = await newChannelSim.helper.search(
                    `getBot("abc", "def")`
                );
                expect(result).toBeUndefined();
            });
        });
    });
});
