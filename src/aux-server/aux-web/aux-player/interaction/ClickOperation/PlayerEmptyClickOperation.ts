import { Input } from '../../../shared/scene/Input';
import { Ray } from 'three';
import { appManager } from '../../../shared/AppManager';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { Physics } from '../../../shared/scene/Physics';
import { PlayerGame } from '../../scene/PlayerGame';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import { BaseEmptyClickOperation } from '../../../shared/interaction/ClickOperation/BaseEmptyClickOperation';
import { BotCalculationContext } from '@casual-simulation/aux-common';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class PlayerEmptyClickOperation extends BaseEmptyClickOperation {
    protected _game: PlayerGame;
    protected _interaction: PlayerInteractionManager;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: PlayerGame,
        interaction: PlayerInteractionManager,
        vrController: VRController3D | null
    ) {
        super(game, interaction, vrController);
        this._game = game;
        this._interaction = interaction;
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    protected _performClick(calc: BotCalculationContext): void {
        this._sendOnGridClickEvent(calc);
    }

    private _sendOnGridClickEvent(calc: BotCalculationContext) {
        const simulation3Ds = this._game.getSimulations();

        for (const sim3D of simulation3Ds) {
            if (sim3D instanceof PlayerSimulation3D) {
                let inputDimension: string;
                let inputRay: Ray;

                // Calculate input ray.
                if (this._vrController) {
                    inputRay = this._vrController.pointerRay;
                    inputDimension = sim3D.dimension;
                } else {
                    const pagePos = this._game.getInput().getMousePagePos();
                    const inventoryViewport = this._game.getInventoryViewport();
                    const isInventory = Input.pagePositionOnViewport(
                        pagePos,
                        inventoryViewport
                    );

                    if (isInventory) {
                        const inventory = this._game.findInventorySimulation3D(
                            sim3D.simulation
                        );
                        inputRay = Physics.screenPosToRay(
                            Input.screenPositionForViewport(
                                pagePos,
                                inventoryViewport
                            ),
                            inventory.getMainCameraRig().mainCamera
                        );
                        inputDimension = inventory.inventoryDimension;
                    } else {
                        inputRay = Physics.screenPosToRay(
                            this._game.getInput().getMouseScreenPos(),
                            sim3D.getMainCameraRig().mainCamera
                        );
                        inputDimension = sim3D.dimension;
                    }
                }

                // Get grid tile that intersects with input ray.
                const gridTile = sim3D.grid3D.getTileFromRay(inputRay);

                if (gridTile) {
                    sim3D.simulation.helper.action('onGridClick', null, {
                        dimension: inputDimension,
                        position: {
                            x: gridTile.tileCoordinate.x,
                            y: gridTile.tileCoordinate.y,
                        },
                    });
                }
            }
        }
    }
}
