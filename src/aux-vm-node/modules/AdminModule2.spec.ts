import {
    AuxCausalTree,
    botAdded,
    createBot,
    shell,
    GLOBALS_BOT_ID,
    action,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    RemoteAction,
    remote,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxUser, AuxConfig, Simulation } from '@casual-simulation/aux-vm';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AdminModule2 } from './AdminModule2';
import { Subscription } from 'rxjs';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import uuid from 'uuid/v4';
import { NodeSimulation } from '../managers/NodeSimulation';
import { nodeSimulationForLocalRepo } from '../managers/NodeSimulationFactories';

console.error = jest.fn();
let logMock = (console.log = jest.fn());

jest.mock('child_process');

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AdminModule2', () => {
    let simulation: Simulation;
    let user: AuxUser;
    let device: DeviceInfo;
    let serverDevice: DeviceInfo;
    let config: AuxConfig;
    let subject: AdminModule2;
    let sub: Subscription;

    beforeEach(async () => {
        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
                    type: 'causal_repo',
                },
            },
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        serverDevice = {
            claims: {
                [USERNAME_CLAIM]: 'server',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [SERVER_ROLE],
        };

        simulation = nodeSimulationForLocalRepo(user, 'simulationId');
        await simulation.init();

        subject = new AdminModule2();
        sub = await subject.setup(simulation);

        logMock.mockClear();
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    describe('events', () => {
        describe('shell', () => {
            it('should run the given shell command and output the results to the console', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                await simulation.helper.transaction(
                    shell('echo "Hello, World!"')
                );

                await wait(20);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });

            it('should run the given shell command and output the results to the auxFinishedTasks dimension', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                uuidMock.mockReturnValue('testId');
                await simulation.helper.transaction(
                    shell('echo "Hello, World!"')
                );

                await wait(20);

                expect(simulation.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        auxFinishedTasks: true,
                        auxTaskShell: 'echo "Hello, World!"',
                        auxTaskOutput: 'Hello, World!',
                    },
                });
            });
        });

        describe('device', () => {
            it('should pipe device events through onUniverseAction()', async () => {
                await simulation.helper.createBot('test', {
                    testShout: '@setTag(this, "abc", true)',
                });

                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            onUniverseAction: `@
                                if (that.action.type === 'device') {
                                    action.perform(that.action.event);
                                }
                            `,
                        },
                    }
                );

                await simulation.helper.transaction({
                    type: 'device',
                    device: device,
                    event: action('testShout'),
                });

                await waitAsync();

                expect(simulation.helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        abc: true,
                    },
                });
            });
        });
    });

    describe('deviceConnected()', () => {
        it('should set the number of connected devices on the globals bot', async () => {
            await subject.deviceConnected(simulation, device);

            let testDevice2: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername2',
                    [DEVICE_ID_CLAIM]: 'deviceId2',
                    [SESSION_ID_CLAIM]: 'sessionId2',
                },
                roles: [],
            };
            await subject.deviceConnected(simulation, testDevice2);

            expect(simulation.helper.globalsBot).toMatchObject({
                id: GLOBALS_BOT_ID,
                tags: {
                    auxConnectedSessions: 2,
                },
            });

            await subject.deviceDisconnected(simulation, device);

            expect(simulation.helper.globalsBot).toMatchObject({
                id: GLOBALS_BOT_ID,
                tags: {
                    auxConnectedSessions: 1,
                },
            });

            await subject.deviceDisconnected(simulation, testDevice2);

            // Wait for the async operations to finish
            await waitAsync();

            expect(simulation.helper.globalsBot).toMatchObject({
                id: GLOBALS_BOT_ID,
                tags: {
                    auxConnectedSessions: 0,
                },
            });
        });

        it('should set the auxPlayerActive tag based on the session ID', async () => {
            await simulation.helper.transaction(
                botAdded(createBot(GLOBALS_BOT_ID, {}))
            );
            await simulation.helper.createBot('sessionId', {});

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceConnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: true,
                },
            });

            await subject.deviceDisconnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: false,
                },
            });

            await subject.deviceConnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: true,
                },
            });

            await subject.deviceDisconnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: false,
                },
            });
        });
    });
});
