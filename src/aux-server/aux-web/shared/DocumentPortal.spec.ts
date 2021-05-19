import { botUpdated, createBot } from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { waitForSync } from '@casual-simulation/aux-vm';
import { Simulation, SimulationManager } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';
import { nodeSimulationWithConfig } from '@casual-simulation/aux-vm-node';
import { DocumentPortal } from './DocumentPortal';

console.log = jest.fn();

describe('DocumentPortal', () => {
    let simulationManager: SimulationManager<RemoteSimulation>;
    let portal: DocumentPortal;
    let sim: RemoteSimulation;

    beforeEach(async () => {
        simulationManager = new SimulationManager<RemoteSimulation>((id) =>
            nodeSimulationWithConfig(
                {
                    id: 'user',
                    name: 'user',
                    token: 'token',
                    username: 'username',
                },
                id,
                {
                    config: {
                        version: 'v1.0.0',
                        versionHash: 'hash',
                    },
                    partitions: {
                        shared: {
                            type: 'memory',
                            initialState: {
                                test1: createBot('test1', {
                                    doc: true,
                                }),
                                test2: createBot('test2', {
                                    doc: true,
                                    other: true,
                                }),
                                test3: createBot('test3', {
                                    other: true,
                                }),
                                user: createBot('user', {}),
                            },
                        },
                    },
                }
            )
        );

        portal = new DocumentPortal(simulationManager, ['documentPortal']);

        sim = await simulationManager.addSimulation('test');
        sim.helper.userId = 'user';
    });

    it('should keep bots that are in both dimensions', async () => {
        await waitForSync(sim);

        await sim.helper.updateBot(sim.helper.botsState['user'], {
            tags: {
                documentPortal: 'doc',
            },
        });

        await waitAsync();

        expect(portal.items.length).toEqual(2);

        await sim.helper.updateBot(sim.helper.botsState['user'], {
            tags: {
                documentPortal: 'other',
            },
        });

        await waitAsync();

        expect(portal.items.length).toEqual(2);
    });

    it('should sort items by their sort order', async () => {
        await waitForSync(sim);

        await sim.helper.updateBot(sim.helper.botsState['user'], {
            tags: {
                documentPortal: 'doc',
            },
        });

        await sim.helper.transaction(
            botUpdated('test1', {
                tags: {
                    doc: true,
                },
            }),
            botUpdated('test2', {
                tags: {
                    doc: true,
                    menuSortOrder: 1,
                },
            }),
            botUpdated('test3', {
                tags: {
                    doc: true,
                    menuSortOrder: -1,
                },
            })
        );

        await waitAsync();

        expect(portal.items).toEqual([
            {
                bot: sim.helper.botsState['test3'],
                dimensions: new Set(['doc']),
                simulationId: 'test',
            },
            {
                bot: sim.helper.botsState['test1'],
                dimensions: new Set(['doc']),
                simulationId: 'test',
            },
            {
                bot: sim.helper.botsState['test2'],
                dimensions: new Set(['doc']),
                simulationId: 'test',
            },
        ]);
    });
});
