import {
    Bot,
    Object,
    duplicateBot,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { InventorySimulation3D } from 'aux-web/aux-player/scene/InventorySimulation3D';
import { PlayerNewBotDragOperation } from '../DragOperation/PlayerNewBotDragOperation';

/**
 * New Bot Click Operation handles clicking of bots that are in the bot queue.
 */
export class PlayerNewBotClickOperation extends BaseBotClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerSimulation3D;
    protected _inventory3D: InventorySimulation3D;

    constructor(
        simulation: PlayerSimulation3D,
        inventory3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        bot: Bot,
        vrController: VRController3D | null
    ) {
        super(simulation, interaction, bot, null, vrController);
        this._inventory3D = inventory3D;
    }

    protected _performClick(calc: BotCalculationContext): void {
        // Do nothing by default
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        let duplicatedBot = duplicateBot(calc, <Object>this._bot);

        this._simulation3D.simulation.botPanel.hideOnDrag(true);

        return new PlayerNewBotDragOperation(
            this._simulation3D,
            this._inventory3D,
            this._interaction,
            duplicatedBot,
            this._bot,
            this._vrController,
            fromCoord
        );
    }

    protected _canDrag(calc: BotCalculationContext) {
        return true;
    }
}
