import { AuxFile3D } from './AuxFile3D';
import { AsyncCalculationContext } from '@casual-simulation/aux-common';

export abstract class AuxFile3DDecorator {
    /**
     * The aux file 3d that this decorator belongs to.
     */
    file3D: AuxFile3D;

    constructor(file3D: AuxFile3D) {
        this.file3D = file3D;
    }

    abstract fileUpdated(calc: AsyncCalculationContext): void;
    abstract frameUpdate(calc: AsyncCalculationContext): void;
    abstract dispose(): void;
}
