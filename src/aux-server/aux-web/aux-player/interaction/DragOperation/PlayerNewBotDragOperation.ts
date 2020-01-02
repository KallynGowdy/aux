import { Physics } from '../../../shared/scene/Physics';
import {
    Bot,
    PartialBot,
    botAdded,
    BotAction,
    BotTags,
} from '@casual-simulation/aux-common/bots';
import {
    createBot,
    BotCalculationContext,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { merge } from '@casual-simulation/aux-common/utils';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';
import { IOperation } from '../../../shared/interaction/IOperation';
import { BaseBotDragOperation } from 'aux-web/shared/interaction/DragOperation/BaseBotDragOperation';
import { PlayerBotDragOperation } from './PlayerBotDragOperation';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerInteractionManager } from '../PlayerInteractionManager';

/**
 * New Bot Drag Operation handles dragging of new bots from the bot queue.
 */
export class PlayerNewBotDragOperation extends PlayerBotDragOperation {
    public static readonly FreeDragDistance: number = 6;

    private _botAdded: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: PlayerSimulation3D,
        inventory3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        duplicatedBot: Bot,
        originalBot: Bot,
        vrController: VRController3D | null,
        fromCoord: Vector2
    ) {
        super(
            simulation3D,
            inventory3D,
            interaction,
            [duplicatedBot],
            null,
            vrController,
            fromCoord,
            false
        );
    }

    protected _createBotDragOperation(bot: Bot): IOperation {
        return null;
    }

    protected _createModDragOperation(mod: BotTags): IOperation {
        return null;
    }

    protected _updateBot(bot: Bot, data: PartialBot): BotAction {
        if (!this._botAdded) {
            // Add the duplicated bot.
            this._bot = merge(this._bot, data || {});
            this._bot = createBot(undefined, this._bot.tags);
            this._bots = [this._bot];
            this._botAdded = true;

            return botAdded(this._bot);
        } else {
            return super._updateBot(this._bot, data);
        }
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        this.simulation.helper.action(CREATE_ACTION_NAME, this._bots);
        super._onDragReleased(calc);
    }
}
