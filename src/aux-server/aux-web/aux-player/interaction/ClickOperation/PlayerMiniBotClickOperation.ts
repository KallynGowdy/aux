import {
    Bot,
    BotCalculationContext,
    AuxObject,
} from '@casual-simulation/aux-common';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { PlayerNewBotClickOperation } from './PlayerNewBotClickOperation';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { InventorySimulation3D } from 'aux-web/aux-player/scene/InventorySimulation3D';

export class PlayerMiniBotClickOperation extends PlayerNewBotClickOperation {
    constructor(
        simulation3D: PlayerSimulation3D,
        inventory3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        bot: AuxObject,
        vrController: VRController3D | null
    ) {
        super(simulation3D, inventory3D, interaction, bot, vrController);
    }

    protected _performClick(calc: BotCalculationContext): void {
        this.simulation.botPanel.toggleOpen();
    }
}
