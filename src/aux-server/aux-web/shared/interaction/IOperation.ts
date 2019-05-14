import { FileCalculationContext } from '@casual-simulation/aux-common';
import { AsyncSimulation } from '../AsyncSimulation';

export interface IOperation {
    simulation: AsyncSimulation;
    isFinished(): boolean;
    update(): Promise<void>;
    dispose(): void;
}
