import {
    Bot,
    Object,
    duplicateBot,
    BotCalculationContext,
    BotTags,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';
import { BaseModClickOperation } from '../../../shared/interaction/ClickOperation/BaseModClickOperation';
import { IOperation } from '../../../shared/interaction/IOperation';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { PlayerSimulation3D } from 'aux-web/aux-player/scene/PlayerSimulation3D';
import { PlayerModDragOperation } from '../DragOperation/PlayerModDragOperation';
import { InventorySimulation3D } from 'aux-web/aux-player/scene/InventorySimulation3D';

/**
 * Mod Bot Click Operation handles clicking of mods.
 */
export class PlayerModClickOperation extends BaseModClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerSimulation3D;
    protected _inventory: InventorySimulation3D;

    // protected _allowSelection: boolean;

    constructor(
        simulation: PlayerSimulation3D,
        inventory: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        mod: BotTags,
        vrController: VRController3D | null
        // allowSelection: boolean = false
    ) {
        super(simulation, interaction, mod, vrController);
        this._inventory = inventory;
        // this._allowSelection = allowSelection;
    }

    protected _performClick(calc: BotCalculationContext): void {
        // if (this._allowSelection) {
        //     this._simulation3D.simulation.recent.addBotDiff(this._mod, true);
        //     this._simulation3D.simulation.selection.clearSelection();
        //     this._simulation3D.simulation.botPanel.isOpen = true;
        // }
        // Do nothing by default
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): IOperation {
        this._simulation3D.simulation.botPanel.hideOnDrag(true);

        return new PlayerModDragOperation(
            this._simulation3D,
            this._inventory,
            this._interaction,
            this._mod,
            this._vrController
        );
    }

    protected _canDrag(calc: BotCalculationContext) {
        return true;
    }
}
