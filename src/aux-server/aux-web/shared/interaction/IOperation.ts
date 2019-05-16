import { AsyncSimulation } from '@casual-simulation/aux-vm';

export interface IOperation {
    simulation: AsyncSimulation;
    isFinished(): boolean;
    update(): Promise<void>;
    dispose(): void;
}
