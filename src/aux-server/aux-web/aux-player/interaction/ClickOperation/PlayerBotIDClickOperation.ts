import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';

import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import BotTable from '../../../shared/vue-components/BotTable/BotTable';
import { Vector2 } from 'three';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { PlayerBotDragOperation } from '../DragOperation/PlayerBotDragOperation';
import { InventorySimulation3D } from 'aux-web/aux-player/scene/InventorySimulation3D';
import { PlayerSimulation3D } from 'aux-web/aux-player/scene/PlayerSimulation3D';

export class PlayerBotIDClickOperation extends BaseBotClickOperation {
    botTable: BotTable;

    protected _interaction: PlayerInteractionManager;
    protected _simulation3D: PlayerSimulation3D;
    protected _inventory3D: InventorySimulation3D;

    constructor(
        simulation3D: PlayerSimulation3D,
        inventory3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        bot: Bot,
        vrController: VRController3D | null,
        table?: BotTable
    ) {
        super(simulation3D, interaction, bot, null, vrController);
        this._inventory3D = inventory3D;
        this.botTable = table;
    }

    protected _performClick(calc: BotCalculationContext): void {
        if (this.botTable != null) {
            this.botTable.toggleBot(this._bot);
        }
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        this._simulation3D.simulation.botPanel.hideOnDrag(true);

        return new PlayerBotDragOperation(
            this._simulation3D,
            this._inventory3D,
            this._interaction,
            [this._bot],
            this._simulation3D.context,
            this._vrController,
            fromCoord
        );
    }
}
