import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import {
    calculateGridScale,
    getBuilderContextGrid,
    DEFAULT_WORKSPACE_GRID_SCALE,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';
import { Text3D } from '../Text3D';
import { calculateScale } from '../SceneUtils';

export class ScaleDecorator extends AuxFile3DDecorator {
    constructor(file3D: AuxFile3D) {
        super(file3D);
    }

    async fileUpdated(calc: AsyncCalculationContext): Promise<void> {
        const gridScale = await calc.calculateGridScale(
            this.file3D.contextGroup ? this.file3D.contextGroup.file : null
        );
        const scale = await calculateScale(calc, this.file3D.file, gridScale);
        this.file3D.display.scale.set(scale.x, scale.y, scale.z);
    }

    async frameUpdate(calc: AsyncCalculationContext): Promise<void> {}

    dispose(): void {}
}
