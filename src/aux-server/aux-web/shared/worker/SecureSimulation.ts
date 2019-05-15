import { Plugin } from 'jailed';
import {
    SecureSimulationClientInterface,
    SecureSimulationHostInterface,
} from './SecureSimulationInterface';
import { Subject } from 'rxjs';

export class SecureSimulation {
    private _sandbox: Plugin<
        SecureSimulationHostInterface,
        SecureSimulationClientInterface
    >;
    private _events: Subject<any>;

    constructor() {
        this._sandbox = new Plugin<
            SecureSimulationHostInterface,
            SecureSimulationClientInterface
        >('abc', {
            event: (name, data) => {
                this._events.next({
                    name,
                    data,
                });
            },
        });
    }

    createInstance(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        this._sandbox.remote.createInstance(user, id, config);
    }

    request<T>(name: string, ...args: any[]): Promise<T> {
        return new Promise((resolve, reject) => {
            this._sandbox.remote.call(
                (err: any, data: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                },
                name,
                ...args
            );
        });
    }
}
