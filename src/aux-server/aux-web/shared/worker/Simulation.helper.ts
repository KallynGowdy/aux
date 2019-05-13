import SimulationWorker from 'worker-loader!./Simulation.worker';
import { Subject, Observable } from 'rxjs';
import { User } from '../User';
import { Simulation } from '../Simulation';
import { AsyncSimulation } from '../AsyncSimulation';
import { StoredCausalTree } from '@casual-simulation/causal-trees';
import {
    AuxOp,
    FilesState,
    LocalEvents,
    SimulationIdParseSuccess,
    AuxObject,
} from '@casual-simulation/aux-common';

export class SimulationHelper implements AsyncSimulation {
    // TODO:
    localEvents: Observable<LocalEvents>;
    connectionStateChanged: Observable<boolean>;

    closed: boolean;

    private _worker: Worker;
    private _requests: WorkerRequest[];
    private _user: User;
    private _id: string;
    private _config: { isBuilder: boolean; isPlayer: boolean };

    constructor(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        this._user = user;
        this._id = id;
        this._config = config;
        this._worker = new SimulationWorker();
        this._requests = [];

        this._worker.onmessage = e => {
            for (let i = 0; i < this._requests.length; i++) {
                let req = this._requests[i];
                if (req.name === e.data.name) {
                    req.resolve(e.data.value);
                    this._requests.splice(i, 1);
                    break;
                }
            }
        };
    }

    get id(): string {
        return this._id;
    }

    init() {
        return this._request<void>('init', this._user, this._id, this._config);
    }

    exportAux() {
        return this._request<StoredCausalTree<AuxOp>>('exportAux');
    }

    addState(state: FilesState) {
        return this._request<void>('addState', state);
    }

    action(eventName: string, files: File[], arg?: any): Promise<void> {
        return this._request<void>('action', eventName, files, arg);
    }

    getUserFile(): Promise<AuxObject> {
        return this._request<AuxObject>('getUserFile');
    }
    createSimulation(id: string, fileId?: string): Promise<void> {
        return this._request<void>('createSimulation', id, fileId);
    }

    destroySimulations(id: string): Promise<void> {
        return this._request<void>('destroySimulations', id);
    }

    getParsedId(): Promise<SimulationIdParseSuccess> {
        return this._request<SimulationIdParseSuccess>('getParsedId');
    }

    isForcedOffline(): Promise<boolean> {
        return this._request<boolean>('isForcedOffline');
    }

    toggleForceOffline(): Promise<void> {
        return this._request<void>('toggleForceOffline');
    }

    unsubscribe(): void {
        if (!this.closed) {
            this._worker.terminate();
            this._worker = null;
            this.closed = true;
        }
    }

    private _request<T>(name: string, ...args: any[]): Promise<T> {
        return new Promise<T>(resolve => {
            const req = {
                name: name,
                resolve,
            };
            this._requests.push(req);

            this._worker.postMessage({
                name: req.name,
                args: args,
            });
        });
    }
}

interface WorkerRequest {
    name: string;
    resolve: Function;
}
