import { Vector2, Vector3, Intersection, Ray, Raycaster } from 'three';
import { ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import {
    File,
    FileCalculationContext,
    calculateGridScale,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_GRID_SCALE,
} from '@casual-simulation/aux-common';
import { IOperation } from '../../shared/interaction/IOperation';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import GameView from '../GameView/GameView';
import { GameObject } from '../../shared/scene/GameObject';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { PlayerFileClickOperation } from './ClickOperation/PlayerFileClickOperation';
import { PlayerGrid } from '../PlayerGrid';
import { Physics } from '../../shared/scene/Physics';
import { Input } from '../../shared/scene/Input';
import InventoryFile from '../InventoryFile/InventoryFile';
import { PlayerInventoryFileClickOperation } from './ClickOperation/PlayerInventoryFileClickOperation';
import { PlayerSimulation3D } from '../scene/PlayerSimulation3D';
import { AsyncSimulation } from '@casual-simulation/aux-vm';
import { Simulation3D } from '../../shared/scene/Simulation3D';

export class PlayerInteractionManager extends BaseInteractionManager {
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _grid: PlayerGrid;

    constructor(gameView: GameView) {
        super(gameView);
        let gridScale = DEFAULT_WORKSPACE_SCALE * DEFAULT_WORKSPACE_GRID_SCALE;
        this._grid = new PlayerGrid(gridScale);
    }

    createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection
    ): IOperation {
        if (gameObject instanceof AuxFile3D) {
            let faceValue: string = 'Unknown Face';

            // Based on the normals of the file the raycast hit, determine side of the cube
            if (hit.face.normal.x != 0) {
                if (hit.face.normal.x > 0) {
                    faceValue = 'left';
                } else {
                    faceValue = 'right';
                }
            } else if (hit.face.normal.y != 0) {
                if (hit.face.normal.y > 0) {
                    faceValue = 'top';
                } else {
                    faceValue = 'bottom';
                }
            } else if (hit.face.normal.z != 0) {
                if (hit.face.normal.z > 0) {
                    faceValue = 'front';
                } else {
                    faceValue = 'back';
                }
            }

            let fileClickOp = new PlayerFileClickOperation(
                <PlayerSimulation3D>gameObject.contextGroup.simulation,
                this,
                gameObject,
                faceValue
            );
            return fileClickOp;
        } else {
            return null;
        }
    }

    handlePointerEnter(file: File, simulation: AsyncSimulation): IOperation {
        simulation.action('onPointerEnter', [file]);
        return null;
    }

    handlePointerExit(file: File, simulation: AsyncSimulation): IOperation {
        simulation.action('onPointerExit', [file]);
        return null;
    }

    handlePointerDown(file: File, simulation: AsyncSimulation): IOperation {
        simulation.action('onPointerDown', [file]);
        return null;
    }

    createEmptyClickOperation(): IOperation {
        return null;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        const vueElement: any = Input.getVueParent(element);
        if (vueElement instanceof InventoryFile) {
            if (vueElement.item) {
                let inventoryClickOperation = new PlayerInventoryFileClickOperation(
                    vueElement.item.simulation,
                    this,
                    vueElement.item
                );
                return inventoryClickOperation;
            }
        }

        return null;
    }

    /**
     * Calculates the grid location that the given ray intersects with.
     * @param ray The ray to test.
     */
    pointOnGrid(ray: Ray) {
        let planeHit = Physics.pointOnPlane(
            ray,
            this._gameView.getGroundPlane()
        );
        // We need to flip the sign of the z coordinate here.
        planeHit.z = -planeHit.z;

        if (planeHit) {
            let gridTile = this._grid.getTileFromPosition(planeHit);
            if (gridTile) {
                return {
                    good: true,
                    gridTile: gridTile,
                };
            }
        }

        return {
            good: false,
        };
    }

    protected _findHoveredFile(input: Input): [File, AsyncSimulation] {
        if (input.isMouseFocusingAny(this._gameView.getUIHtmlElements())) {
            const element = input.getTargetData().inputOver;
            const vueElement = Input.getVueParent(element);

            if (vueElement instanceof InventoryFile) {
                // handle hover
                if (vueElement.file) {
                    return [
                        vueElement.file,
                        vueElement.item.simulation.simulation,
                    ];
                } else {
                    return [null, null];
                }
            }
        }
        return super._findHoveredFile(input);
    }

    protected async _contextMenuActions(
        simulation: Simulation3D,
        gameObject: GameObject,
        point: Vector3,
        pagePos: Vector2
    ): Promise<ContextMenuAction[]> {
        return null;
    }
}
