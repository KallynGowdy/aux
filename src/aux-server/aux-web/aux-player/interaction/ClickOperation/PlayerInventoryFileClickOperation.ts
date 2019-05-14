import {
    UserMode,
    File,
    Object,
    duplicateFile,
    FileCalculationContext,
    getFileDragMode,
} from '@casual-simulation/aux-common';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import GameView from '../../GameView/GameView';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { PlayerFileDragOperation } from '../DragOperation/PlayerFileDragOperation';
import { InventoryItem } from 'aux-web/aux-player/InventoryContext';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerNewFileDragOperation } from '../DragOperation/PlayerNewFileDragOperation';

/**
 * New File Click Operation handles clicking of files that are in the file queue.
 */
export class PlayerInventoryFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class IGameView
    protected _simulation3D: PlayerSimulation3D;

    // The context that the file was in when click operation began.
    protected _context: string;

    protected _item: InventoryItem;

    constructor(
        simulation: PlayerSimulation3D,
        interaction: PlayerInteractionManager,
        item: InventoryItem
    ) {
        super(simulation, interaction, item.file, null);
        this._item = item;
        this._context = this._item ? this._item.context : null;
    }

    protected async _performClick(): Promise<void> {
        await this._item.simulation.simulation.action('onClick', [this._file]);
    }

    protected async _createDragOperation(): Promise<BaseFileDragOperation> {
        const mode = await this.simulation.getFileDragMode(this._file);
        if (mode === 'clone') {
            return this._createCloneDragOperation();
        }

        return new PlayerFileDragOperation(
            this._simulation3D,
            this._interaction,
            [this._file],
            this._context
        );
    }

    protected _createCloneDragOperation(): BaseFileDragOperation {
        let duplicatedFile = duplicateFile(<File>this._file);
        return new PlayerNewFileDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            this._context
        );
    }

    protected async _canDragFile(file: File): Promise<boolean> {
        return true;
    }
}
