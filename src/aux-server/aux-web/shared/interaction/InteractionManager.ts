import { GameObject } from '../scene/GameObject';
import { boolean } from '@hapi/joi';
import { CameraRigControls } from './CameraRigControls';
import { IOperation } from './IOperation';
import { DraggableGroup } from './DraggableGroup';
import { Vector2, Intersection, Object3D } from 'three';
import { VRController3D } from '../scene/vr/VRController3D';
import { AuxBot3D } from '../scene/AuxBot3D';
import { BotCalculationContext } from '@casual-simulation/aux-common';

export interface InteractionManager {
    /**
     * Gets all the camera rig controls.
     */
    cameraRigControllers: CameraRigControls[];

    overHtmlMixerIFrame: boolean;

    /**
     * Adds the given operation to the operation list.
     * @param operation The operation to add.
     * @param disableCameraControls Whether to disable the camera controls while the operation is in effect.
     */
    addOperation(operation: IOperation, disableCameraControls?: boolean): void;

    update(): void;

    /**
     * Gets groups of draggables for input testing.
     */
    getDraggableGroups(): DraggableGroup[];

    /**
     * Find the first game object that is underneath the given page position. If page position is not given, the current 'mouse' page position will be used.
     * @param pagePos [Optional] The page position to test underneath.
     */
    findHoveredGameObject(
        pagePos?: Vector2
    ): { gameObject: GameObject; hit: Intersection };

    /**
     * Find the first game object that is being pointed at by the given vr controller.
     * @param controller The vr controller to test with.
     */
    findHoveredGameObjectVR(
        controller: VRController3D
    ): { gameObject: GameObject; hit: Intersection };
    findGameObjectForHit(hit: Intersection): GameObject;
    findGameObjectUpHierarchy(object: Object3D): GameObject;
    toggleContextMenu(calc: BotCalculationContext): void;
    showContextMenu(calc: BotCalculationContext): void;
    hideContextMenu(): void;
    selectBot(bot: AuxBot3D): Promise<void>;
    clearSelection(): Promise<void>;
    isEmptySpace(screenPos: Vector2): boolean;
}
