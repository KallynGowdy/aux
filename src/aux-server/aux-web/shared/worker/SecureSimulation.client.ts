import {
    SecureSimulationClientInterface,
    SecureSimulationHostInterface,
} from './SecureSimulationInterface';
import { Application } from 'jailed';
import { RemoteAsyncSimulationWrapper } from './RemoteAsyncSimulationWrapper';
import { FileManager } from '../FileManager';
import { Subject, Observable, SubscriptionLike } from 'rxjs';
import { map } from 'rxjs/operators';
import { SimulationEvents } from './RemoteAsyncSimulation';
import { AuxObject } from '@casual-simulation/aux-common';

declare var application: Application<
    SecureSimulationHostInterface,
    SecureSimulationClientInterface
>;

let wrapper: RemoteAsyncSimulationWrapper = null;
let obj: any = null;

const api: SecureSimulationClientInterface = {
    createInstance(user, id, config) {
        obj = wrapper = new RemoteAsyncSimulationWrapper(
            new FileManager(user, id, config)
        );
    },
    registerListener(key: string, callback: (event: SimulationEvents) => void) {
        wrapper.registerListener(key, callback);
    },
    unregisterListener(key: string): void {
        wrapper.unregisterListener(key);
    },
    watchFile(
        key: string,
        id: string,
        callback: (event: AuxObject) => void
    ): void {
        wrapper.watchFile(key, id, callback);
    },
    unwatchFile(key: string, id: string): void {
        wrapper.unwatchFile(key, id);
    },

    call: (cb, name, ...args) => {},
};

application.setInterface(api);
