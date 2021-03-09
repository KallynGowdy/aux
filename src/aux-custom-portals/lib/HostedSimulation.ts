import { ConnectableAuxVM } from '@casual-simulation/aux-vm-browser/vm/ConnectableAuxVM';
import { Simulation } from '@casual-simulation/aux-vm/managers/Simulation';
import { BaseSimulation } from '@casual-simulation/aux-vm/managers/BaseSimulation';
import { filter } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';

/**
 * Defines a class which represents a simulation that is exposed over a message port.
 */
export class HostedSimulation extends BaseSimulation implements Simulation {
    get consoleMessages() {
        return <Observable<ConsoleMessages>>(
            this._vm.connectionStateChanged.pipe(
                filter(
                    (m) =>
                        m.type === 'log' ||
                        m.type === 'error' ||
                        m.type === 'warn'
                )
            )
        );
    }

    constructor(id: string, port: MessagePort) {
        super(id, null, null, () => new ConnectableAuxVM(id, port));
    }
}
