import { User } from '../User';

/**
 * Defines the API that the secure simulation client provides to the host.
 */
export interface SecureSimulationClientInterface {
    createInstance(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ): void;

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
export interface SecureSimulationHostInterface {
    event(name: string, data: any): void;
}

export interface SecureSimulationEvent {
    name: string;
    data: any;
}
