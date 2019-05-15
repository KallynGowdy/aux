import { createJail } from '../jailed/JailProxy';
import { AsyncSimulation } from '../AsyncSimulation';
import PluginUrl from 'file-loader!./SimulationPlugin.ts';

export function createSandbox() {
    return createJail<AsyncSimulation>(PluginUrl);
}
