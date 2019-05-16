import { AsyncSimulation, User } from '../managers';
import AsyncSimulationWorker from 'worker-loader!./AsyncSimulation.worker';
import { createProxy } from './WorkerProxy';
import { union } from './UnionProxy';

export const knownAsyncSimulationObservables: string[] = [
    'filesDiscovered',
    'filesRemoved',
    'filesUpdated',
    'localEvents',
    'connectionStateChanged',
    'filePanelUpdated',
    'filePanelOpenChanged',
    'filePanelSearchUpdated',
    'recentsUpdated',
    'userFileChanged',
];

export async function createAsyncSimulation(
    user: User,
    id: string,
    config: any
): Promise<AsyncSimulation> {
    const worker = new AsyncSimulationWorker();
    const sandbox = createProxy<AsyncSimulation>(worker, {
        knownObservables: knownAsyncSimulationObservables,
    });
    await sandbox.init(user, id, config);
    return union(
        {
            id: id,
            userFileId: user.id,

            // TODO: Get this prop to be reactive
            closed: false,

            // Need to specify that 'then' is not a property on the object
            // so that async integration doesn't think that it is a promise.
            then: undefined,
        },
        sandbox
    );
}
