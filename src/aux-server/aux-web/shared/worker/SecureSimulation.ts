import { createJail } from '../jailed/JailProxy';
import { AsyncSimulation } from '../AsyncSimulation';
// import PluginUrl from './Simulation.plugin.ts';

export function createSandbox() {
    return createJail<AsyncSimulation>('worker.js');
}
