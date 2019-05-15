import { User } from '../User';
import { SimulationEvents } from './RemoteAsyncSimulation';
import { AuxObject } from '@casual-simulation/aux-common';

/**
 * Defines the API that the secure simulation client provides to the host.
 */
export interface SecureSimulationClientInterface {
    createInstance(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ): void;

    registerListener(
        key: string,
        callback: (event: SimulationEvents) => void
    ): void;
    unregisterListener(key: string): void;

    watchFile(
        key: string,
        id: string,
        callback: (event: AuxObject) => void
    ): void;
    unwatchFile(key: string, id: string): void;

    /**
     * Issues an async call to the given function name with the given arguments.
     * @param cb The function that should be called with the results of the call.
     * @param name The name of the function to call.
     * @param args The arguments to provide.
     */
    call(
        cb: (err: any, data?: any) => void,
        name: string,
        ...args: any[]
    ): void;
}

/**
 * Defines the API that the secure simulation host provides to the client.
 */
export interface SecureSimulationHostInterface {}
