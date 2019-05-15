import { createJail } from '../jailed/JailProxy';
import { RemoteAsyncSimulation } from './RemoteAsyncSimulation';

export function createSandbox() {
    return createJail<RemoteAsyncSimulation>('abc');
}
