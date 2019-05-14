import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import {
    FileCalculationContext,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';

/**
 * Defines a AuxFile3D decorator that updates the file's world matrix.
 */
export class UpdateMaxtrixDecorator extends AuxFile3DDecorator {
    constructor(file3D: AuxFile3D) {
        super(file3D);
    }

    async fileUpdated(calc: AsyncCalculationContext): Promise<void> {
        const userContext = this.file3D.context;
        if (userContext) {
            this.file3D.updateMatrixWorld(true);
        }
    }

    async frameUpdate(calc: AsyncCalculationContext): Promise<void> {}

    dispose(): void {}
}
