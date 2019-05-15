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
    File,
} from '@casual-simulation/aux-common';
import { SecureSimulation } from './SecureSimulation';

export class SimulationHelper implements AsyncSimulation {
    closed: boolean;

    private _sim: SecureSimulation;
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
        this._sim = new SecureSimulation();
    }

    get id(): string {
        return this._id;
    }

    init() {
        return this._sim.request<void>(
            'init',
            this._user,
            this._id,
            this._config
        );
    }

    exportAux() {
        return this._sim.request<StoredCausalTree<AuxOp>>('exportAux');
    }

    addState(state: FilesState) {
        return this._sim.request<void>('addState', state);
    }

    action(eventName: string, files: File[], arg?: any): Promise<void> {
        return this._sim.request<void>('action', eventName, files, arg);
    }

    getUserFile(): Promise<AuxObject> {
        return this._sim.request<AuxObject>('getUserFile');
    }

    createSimulation(id: string, fileId?: string): Promise<void> {
        return this._sim.request<void>('createSimulation', id, fileId);
    }

    destroySimulations(id: string): Promise<void> {
        return this._sim.request<void>('destroySimulations', id);
    }

    getParsedId(): Promise<SimulationIdParseSuccess> {
        return this._sim.request<SimulationIdParseSuccess>('getParsedId');
    }

    isForcedOffline(): Promise<boolean> {
        return this._sim.request<boolean>('isForcedOffline');
    }

    toggleForceOffline(): Promise<void> {
        return this._sim.request<void>('toggleForceOffline');
    }

    unsubscribe(): void {
        // if (!this.closed) {
        //     this._worker.terminate();
        //     this._worker = null;
        //     this.closed = true;
        // }
    }
}
