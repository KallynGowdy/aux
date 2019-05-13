import { Simulation } from '../Simulation';
import { FileManager } from '../FileManager';
import { User } from '../User';
import { StoredCausalTree } from '@casual-simulation/causal-trees';
import {
    AuxOp,
    FilesState,
    File,
    AuxObject,
    SimulationIdParseSuccess,
} from '@casual-simulation/aux-common';

const ctx: Worker = self as any;
let simulation: Simulation;

export async function init(
    user: User,
    id: string,
    config: { isBuilder: boolean; isPlayer: boolean }
) {
    simulation = new FileManager(user, id, config);
    await simulation.init();
}

export function exportAux(): StoredCausalTree<AuxOp> {
    return simulation.aux.tree.export();
}

export function addState(state: FilesState) {
    return simulation.helper.addState(state);
}

export function action(
    eventName: string,
    files: File[],
    arg?: any
): Promise<void> {
    return simulation.helper.action(eventName, files, arg);
}

export async function getUserFile(): Promise<AuxObject> {
    return simulation.helper.userFile;
}
export function createSimulation(id: string, fileId?: string): Promise<void> {
    return simulation.helper.createSimulation(id, fileId);
}

export function destroySimulations(id: string): Promise<void> {
    return simulation.helper.destroySimulations(id);
}

export async function getParsedId(): Promise<SimulationIdParseSuccess> {
    return simulation.parsedId;
}

export async function isForcedOffline(): Promise<boolean> {
    return simulation.socketManager.forcedOffline;
}

export async function toggleForceOffline(): Promise<void> {
    return simulation.socketManager.toggleForceOffline();
}

let listeners: Map<string, Function> = new Map();

listeners.set('init', init);
listeners.set('exportAux', init);

ctx.addEventListener('message', e => {
    const func = listeners.get(e.data.name);
    if (func) {
        const result = func(...e.data.args);
        if (result && typeof result.then === 'function') {
            result.then((ret: any) => {
                ctx.postMessage({
                    name: e.data.name,
                    value: ret,
                });
            });
        } else {
            ctx.postMessage({
                name: e.data.name,
                value: result,
            });
        }
    }
});
