import {
    Vector2,
    Vector3,
    Intersection,
    Object3D,
    OrthographicCamera,
} from 'three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenuEvent';
import {
    Object,
    AuxBot,
    BotCalculationContext,
    getBotConfigDimensions,
    Bot,
} from '@casual-simulation/aux-common';
import { Physics } from '../scene/Physics';
import flatMap from 'lodash/flatMap';
import union from 'lodash/union';
import remove from 'lodash/remove';
import { CameraControls } from './CameraControls';
import { MouseButtonId, InputType, Input } from '../scene/Input';
import { appManager } from '../AppManager';
import { IOperation } from './IOperation';
import { AuxBot3D } from '../scene/AuxBot3D';
import { GameObject } from '../scene/GameObject';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
    CameraRig,
} from '../scene/CameraRigFactory';
import { TapCodeManager } from './TapCodeManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { DraggableGroup } from './DraggableGroup';
import { isObjectVisible } from '../scene/SceneUtils';
import { CameraRigControls } from './CameraRigControls';
import { Game } from '../scene/Game';
import { WebVRDisplays } from '../WebVRDisplays';
import {
    VRController3D,
    VRController_ClickColor,
    VRController_DefaultColor,
} from '../scene/vr/VRController3D';
import { DimensionGroup3D } from '../scene/DimensionGroup3D';

interface HoveredBot {
    /**
     * The bot that is being hovered on.
     */
    bot: Bot;

    /**
     * The simulation that the hover is occuring in.
     */
    simulation: Simulation;

    /**
     * The last frame that this object was being hovered on.
     */
    frame: number;
}

export abstract class BaseInteractionManager {
    protected _game: Game;
    protected _cameraRigControllers: CameraRigControls[];
    protected _tapCodeManager: TapCodeManager;
    protected _maxTapCodeLength: number;
    protected _hoveredBots: HoveredBot[];
    protected _activeVRControllers: VRController3D[];

    protected _draggableGroups: DraggableGroup[];
    protected _draggableGroupsDirty: boolean;

    private _operations: IOperation[];
    private _overHtmlMixerIFrame: boolean;
    private _pressedBot: AuxBot3D;
    private _contextMenuOpen: boolean = false;

    constructor(game: Game) {
        this._draggableGroupsDirty = true;
        this._game = game;
        this._cameraRigControllers = this._createControlsForCameraRigs();
        this._operations = [];
        this._tapCodeManager = new TapCodeManager();
        this._maxTapCodeLength = 4;
        this._hoveredBots = [];
        this._activeVRControllers = [];

        // Bind event handlers to this instance of the class.
        this._handleBotAdded = this._handleBotAdded.bind(this);
        this._handleBotUpdated = this._handleBotUpdated.bind(this);
        this._handleBotRemoved = this._handleBotRemoved.bind(this);
        this._handleCameraRigTypeChanged = this._handleCameraRigTypeChanged.bind(
            this
        );

        // Listen to bot events from game view.
        this._game.onBotAdded.addListener(this._handleBotAdded);
        this._game.onBotUpdated.addListener(this._handleBotUpdated);
        this._game.onBotRemoved.addListener(this._handleBotRemoved);
        this._game.onCameraRigTypeChanged.addListener(
            this._handleCameraRigTypeChanged
        );
    }

    /**
     * Gets all the camera rig controls.
     */
    get cameraRigControllers() {
        return this._cameraRigControllers;
    }

    get overHtmlMixerIFrame() {
        return this._overHtmlMixerIFrame;
    }

    /**
     * Adds the given operation to the operation list.
     * @param operation The operation to add.
     * @param disableCameraControls Whether to disable the camera controls while the operation is in effect.
     */
    addOperation(
        operation: IOperation,
        disableCameraControls: boolean = false
    ) {
        this._operations.push(operation);
        if (disableCameraControls) {
            this.setCameraControlsEnabled(false);
        }
    }

    update(): void {
        // const calc = appManager.simulationManager.primary.helper.createContext();
        // Update active operations and dispose of any that are finished.
        this._operations = this._operations.filter(o => {
            const calc = o.simulation
                ? o.simulation.helper.createContext()
                : null;
            o.update(calc);

            if (o.isFinished()) {
                o.dispose();
                return false;
            }

            return true;
        });

        if (WebVRDisplays.isPresenting()) {
            //
            // VR Mode interaction.
            //
            const inputVR = this._game.getInputVR();

            // Detect when the an 'active' vr controller is no longer providing primary input.
            // If primary input is released by this controller, then it is no longer 'active'.
            remove(this._activeVRControllers, controller3D => {
                if (!controller3D.getPrimaryButtonHeld()) {
                    controller3D.setColor(VRController_DefaultColor);
                    return true;
                }
            });

            for (let i = 0; i < inputVR.controllerCount; i++) {
                const controller3D = inputVR.getController3D(i);
                let isActiveController =
                    this._activeVRControllers.indexOf(controller3D) !== -1;

                if (!isActiveController) {
                    // Detect when controller provides primary input.
                    // It becomes an 'active' vr controller when it does.
                    if (controller3D.getPrimaryButtonDown()) {
                        isActiveController = true;
                        this._activeVRControllers.push(controller3D);
                        // Change color of controller to indicate that it is active.
                        controller3D.setColor(VRController_ClickColor);
                    }
                }

                const { gameObject, hit } = this.findHoveredGameObjectVR(
                    controller3D
                );

                if (hit) {
                    // Update pointer ray stop distance.
                    controller3D.pointerRay3D.stopDistance = hit.distance;
                    controller3D.pointerRay3D.showCursor = true;

                    // Set bot has being hovered on.
                    this._setHoveredBot(gameObject);
                } else {
                    controller3D.pointerRay3D.stopDistance = 10;
                    controller3D.pointerRay3D.showCursor = false;
                }

                if (controller3D.getPrimaryButtonDown()) {
                    if (gameObject) {
                        // Start game object click operation.
                        const gameObjectClickOperation = this.createGameObjectClickOperation(
                            gameObject,
                            hit,
                            controller3D
                        );
                        if (gameObjectClickOperation !== null) {
                            this._operations.push(gameObjectClickOperation);
                        }

                        if (gameObject instanceof AuxBot3D) {
                            this._pressedBot = gameObject;

                            this.handlePointerDown(
                                gameObject.bot,
                                gameObject.dimensionGroup.simulation3D
                                    .simulation
                            );
                        }
                    } else {
                        const emptyClickOperation = this.createEmptyClickOperation(
                            controller3D
                        );
                        if (emptyClickOperation !== null) {
                            this._operations.push(emptyClickOperation);
                        }
                    }
                }
            }
        } else {
            //
            // Normal browser interaction.
            //
            const input = this._game.getInput();

            // Detect if we are over any html mixer iframe element.
            this._overHtmlMixerIFrame = false;
            const clientPos = input.getMouseClientPos();
            if (clientPos) {
                const htmlMixerContext = this._game.getHtmlMixerContext();
                this._overHtmlMixerIFrame = htmlMixerContext.isOverAnyIFrameElement(
                    clientPos
                );
            }

            const noMouseInput =
                !input.getMouseButtonHeld(MouseButtonId.Left) &&
                !input.getMouseButtonHeld(MouseButtonId.Middle) &&
                !input.getMouseButtonHeld(MouseButtonId.Right);

            if (noMouseInput && input.getTouchCount() === 0) {
                // Always allow the iframes to recieve input when no inputs are being held.
                const webglCanvas = this._game.getRenderer().domElement;
                webglCanvas.style.pointerEvents = 'none';
            }

            if (!noMouseInput) {
                this.hideContextMenu();
            }

            if (this._operations.length === 0) {
                // Enable camera controls when there are no more operations.
                this.setCameraControlsEnabled(true);
            }

            this._cameraRigControllers.forEach(rigControls =>
                rigControls.controls.update()
            );

            // Detect left click.
            if (input.getMouseButtonDown(MouseButtonId.Left)) {
                if (!this._overHtmlMixerIFrame) {
                    this._disableIFramePointerEvents();
                }

                if (
                    input.isMouseButtonDownOnElement(
                        this._game.gameView.gameView
                    )
                ) {
                    const { gameObject, hit } = this.findHoveredGameObject();

                    if (gameObject) {
                        // Start game object click operation.
                        const gameObjectClickOperation = this.createGameObjectClickOperation(
                            gameObject,
                            hit,
                            null
                        );
                        if (gameObjectClickOperation !== null) {
                            this.setCameraControlsEnabled(false);
                            this._operations.push(gameObjectClickOperation);
                        }

                        if (gameObject instanceof AuxBot3D) {
                            this._pressedBot = gameObject;

                            this.handlePointerDown(
                                gameObject.bot,
                                gameObject.dimensionGroup.simulation3D
                                    .simulation
                            );
                        }
                    } else {
                        const emptyClickOperation = this.createEmptyClickOperation(
                            null
                        );
                        if (emptyClickOperation !== null) {
                            this._operations.push(emptyClickOperation);
                        }
                        this.setCameraControlsEnabled(true);
                    }
                } else if (
                    input.isMouseButtonDownOnAnyElements(
                        this._game.getUIHtmlElements()
                    )
                ) {
                    const element = input.getTargetData().inputDown;

                    const elementClickOperation = this.createHtmlElementClickOperation(
                        element,
                        null
                    );
                    if (elementClickOperation !== null) {
                        this._operations.push(elementClickOperation);
                    }
                }
            } else if (input.getMouseButtonUp(MouseButtonId.Left)) {
                if (this._pressedBot != null) {
                    const { gameObject, hit } = this.findHoveredGameObject();

                    if (
                        gameObject instanceof AuxBot3D &&
                        gameObject == this._pressedBot
                    ) {
                        this.handlePointerUp(
                            gameObject.bot,
                            gameObject.dimensionGroup.simulation3D.simulation
                        );
                    }
                    this._pressedBot = null;
                }
            }

            // Middle click or Right click.
            if (
                input.getMouseButtonDown(MouseButtonId.Middle) ||
                input.getMouseButtonDown(MouseButtonId.Right)
            ) {
                if (!this._overHtmlMixerIFrame) {
                    this._disableIFramePointerEvents();
                }

                if (
                    input.isMouseButtonDownOnElement(
                        this._game.gameView.gameView
                    )
                ) {
                    // Always allow camera control with middle clicks.
                    this.setCameraControlsEnabled(true);
                }
            }
            this._tapCodeManager.recordTouches(input.getTouchCount());
            if (input.getKeyHeld('Alt')) {
                for (let i = 1; i <= 9; i++) {
                    if (input.getKeyDown(i.toString())) {
                        this._tapCodeManager.recordTouches(i);
                    }
                }
            }

            if (this._tapCodeManager.code.length >= this._maxTapCodeLength) {
                const code = this._tapCodeManager.code;
                console.log('[BaseInteractionManager] tap code: ', code);
                appManager.simulationManager.simulations.forEach(sim => {
                    sim.helper.action('onTapCode', null, code);
                });
                this._tapCodeManager.trim(this._maxTapCodeLength - 1);
            }

            if (input.currentInputType === InputType.Mouse) {
                const { gameObject } = this.findHoveredGameObject();
                if (gameObject) {
                    // Set bot as being hovered on.
                    this._setHoveredBot(gameObject);
                }
            }

            this._updateAdditionalNormalInputs(input);
        }

        this._updateHoveredBots();
    }

    /**
     * Hover on the given game object if it represents an AuxBot3D.
     * @param gameObject GameObject for bot to start hover on.
     */
    protected _setHoveredBot(gameObject: GameObject): void {
        if (gameObject instanceof AuxBot3D) {
            const bot: Bot = gameObject.bot;
            const simulation: Simulation =
                gameObject.dimensionGroup.simulation3D.simulation;

            let hoveredBot: HoveredBot = this._hoveredBots.find(hoveredBot => {
                return (
                    hoveredBot.bot.id === bot.id &&
                    hoveredBot.simulation.id === simulation.id
                );
            });

            if (hoveredBot) {
                // Update the frame of the hovered bot to the current frame.
                hoveredBot.frame = this._game.getTime().frameCount;
            } else {
                // Create a new hovered bot object and add it to the list.
                hoveredBot = {
                    bot,
                    simulation,
                    frame: this._game.getTime().frameCount,
                };
                this._hoveredBots.push(hoveredBot);
                this._updateHoveredBots();
                this.handlePointerEnter(bot, simulation);
            }
        }
    }

    /**
     * Check all hovered bots and release any that are no longer being hovered on.
     */
    protected _updateHoveredBots(): void {
        const curFrame = this._game.getTime().frameCount;

        this._hoveredBots = this._hoveredBots.filter(hoveredBot => {
            if (hoveredBot.frame < curFrame) {
                // No longer hovering on this bot.
                this.handlePointerExit(hoveredBot.bot, hoveredBot.simulation);
                return false;
            }

            // Still hovering on this bot.
            return true;
        });
    }

    protected _disableIFramePointerEvents(): void {
        // Dont allow iframes to capture input.
        const webglCanvas = this._game.getRenderer().domElement;
        webglCanvas.style.pointerEvents = 'auto';
    }

    /**
     * Handles any additional input events that the input manager might want to process.
     * @param input The input.
     */
    protected _updateAdditionalNormalInputs(input: Input) {}

    /**
     * Gets groups of draggables for input testing.
     */
    getDraggableGroups(): DraggableGroup[] {
        if (this._draggableGroupsDirty) {
            const dimensions = flatMap(
                this._game.getSimulations(),
                s => s.dimensions
            );
            if (dimensions && dimensions.length > 0) {
                let colliders = flatMap(dimensions.filter(c => !!c), f =>
                    f instanceof DimensionGroup3D ? f.colliders : []
                ).filter(c => isObjectVisible(c));

                this._draggableGroups = [
                    {
                        objects: colliders,
                        camera: this._game.getMainCameraRig().mainCamera,
                        viewport: this._game.getMainCameraRig().viewport,
                    },
                ];
            } else {
                this._draggableGroups = [];
            }
            this._draggableGroupsDirty = false;
        }
        return this._draggableGroups;
    }

    /**
     * Find the first game object that is underneath the given page position. If page position is not given, the current 'mouse' page position will be used.
     * @param pagePos [Optional] The page position to test underneath.
     */
    findHoveredGameObject(pagePos?: Vector2) {
        pagePos = !!pagePos ? pagePos : this._game.getInput().getMousePagePos();

        const draggableGroups = this.getDraggableGroups();
        const viewports = this._game.getViewports();

        let hit: Intersection = null;
        let hitObject: GameObject = null;

        // Iterate through draggable groups until we hit an object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const objects = draggableGroups[i].objects;
            const camera = draggableGroups[i].camera;
            const viewport = draggableGroups[i].viewport;

            if (!Input.pagePositionOnViewport(pagePos, viewport, viewports)) {
                // Page position is not on or is being obstructed by other viewports.
                // Ignore this draggable group.
                continue;
            }

            const screenPos = Input.screenPositionForViewport(
                pagePos,
                viewport
            );
            const raycastResult = Physics.raycastAtScreenPos(
                screenPos,
                objects,
                camera
            );
            hit = Physics.firstRaycastHit(raycastResult);
            hitObject = hit ? this.findGameObjectForHit(hit) : null;

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.
                break;
            }
        }

        if (hitObject) {
            return {
                gameObject: hitObject,
                hit: hit,
            };
        } else {
            return {
                gameObject: null,
                hit: null,
            };
        }
    }

    /**
     * Find the first game object that is being pointed at by the given vr controller.
     * @param controller The vr controller to test with.
     */
    findHoveredGameObjectVR(controller: VRController3D) {
        const draggableGroups = this.getDraggableGroups();

        let hit: Intersection = null;
        let hitObject: GameObject = null;

        // Iterate through draggable groups until we hit an object in one of them.
        for (let i = 0; i < draggableGroups.length; i++) {
            const objects = draggableGroups[i].objects;

            const raycastResult = Physics.raycast(
                controller.pointerRay,
                objects
            );
            hit = Physics.firstRaycastHit(raycastResult);
            hitObject = hit ? this.findGameObjectForHit(hit) : null;

            if (hitObject) {
                // We hit a game object in this simulation, stop searching through simulations.
                break;
            }
        }

        if (hitObject) {
            return {
                gameObject: hitObject,
                hit: hit,
            };
        } else {
            return {
                gameObject: null,
                hit: null,
            };
        }
    }

    findGameObjectForHit(hit: Intersection): GameObject {
        if (!hit) {
            return null;
        }

        return this.findGameObjectUpHierarchy(hit.object);
    }

    findGameObjectUpHierarchy(object: Object3D): GameObject {
        if (!object) {
            return null;
        }

        if (object instanceof AuxBot3D) {
            return object;
        } else {
            return this.findGameObjectUpHierarchy(object.parent);
        }
    }

    toggleContextMenu(calc: BotCalculationContext) {
        if (this._contextMenuOpen) {
            this.hideContextMenu();
        } else {
            this.showContextMenu(calc);
        }
    }

    showContextMenu(calc: BotCalculationContext) {
        if (WebVRDisplays.isPresenting()) {
            // Context menu does nothing in VR yet...
            console.log(
                '[BaseInteractionManager] Context menu is not currently supported while in VR.'
            );
            return;
        }

        const input = this._game.getInput();
        const pagePos = input.getMousePagePos();
        const { gameObject, hit } = this.findHoveredGameObject();
        const actions = this._contextMenuActions(calc, gameObject, hit.point);

        if (actions) {
            this._contextMenuOpen = true;
            this.setCameraControlsEnabled(false);

            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = {
                pagePos: pagePos,
                actions: actions,
            };
            this._game.gameView.$emit('onContextMenu', menuEvent);
        }
    }

    hideContextMenu() {
        this._contextMenuOpen = false;
        this._game.gameView.$emit('onContextMenuHide');
    }

    async selectBot(bot: AuxBot3D) {
        bot.dimensionGroup.simulation3D.simulation.botPanel.search = '';
        const shouldMultiSelect = this._game.getInput().getKeyHeld('Control');

        await bot.dimensionGroup.simulation3D.simulation.selection.selectBot(
            <AuxBot>bot.bot,
            shouldMultiSelect,
            bot.dimensionGroup.simulation3D.simulation.botPanel
        );
    }

    async clearSelection() {
        await appManager.simulationManager.primary.selection.clearSelection();
        appManager.simulationManager.primary.botPanel.search = '';
        await appManager.simulationManager.primary.recent.clear();
    }

    isEmptySpace(screenPos: Vector2): boolean {
        const { gameObject } = this.findHoveredGameObject(screenPos);
        return gameObject == null || gameObject == undefined;
    }

    protected _handleBotAdded(bot: AuxBot): void {
        this._markDirty();
    }

    protected _handleBotUpdated(bot: AuxBot): void {
        this._markDirty();
    }

    protected _handleBotRemoved(bot: AuxBot): void {
        this._markDirty();
    }

    protected _handleCameraRigTypeChanged(newCameraRig: CameraRig): void {
        const cameraRigControls = this._cameraRigControllers.find(
            c => c.rig.name === newCameraRig.name
        );

        if (cameraRigControls) {
            cameraRigControls.rig = newCameraRig;

            const viewport = cameraRigControls.controls.viewport;
            cameraRigControls.controls = new CameraControls(
                newCameraRig.mainCamera,
                this._game,
                viewport
            );

            cameraRigControls.controls.minZoom = Orthographic_MinZoom;
            cameraRigControls.controls.maxZoom = Orthographic_MaxZoom;

            if (
                cameraRigControls.rig.mainCamera instanceof OrthographicCamera
            ) {
                cameraRigControls.controls.screenSpacePanning = true;
            }
        }
    }

    /**
     * Set the enabled state of all camera controls that are managed by this interaction manager.
     * @param enabled
     */
    protected setCameraControlsEnabled(enabled: boolean): void {
        this._cameraRigControllers.forEach(
            rigControls => (rigControls.controls.enabled = enabled)
        );
    }

    protected _markDirty() {
        this._draggableGroupsDirty = true;
    }

    //
    // Abstractions
    //

    abstract createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection,
        vrController: VRController3D | null
    ): IOperation;
    abstract createEmptyClickOperation(
        vrController: VRController3D | null
    ): IOperation;
    abstract createHtmlElementClickOperation(
        element: HTMLElement,
        vrController: VRController3D | null
    ): IOperation;
    abstract handlePointerEnter(bot: Bot, simulation: Simulation): void;
    abstract handlePointerExit(bot: Bot, simulation: Simulation): void;
    abstract handlePointerDown(bot: Bot, simulation: Simulation): void;
    abstract handlePointerUp(bot: Bot, simulation: Simulation): void;

    protected abstract _createControlsForCameraRigs(): CameraRigControls[];
    protected abstract _contextMenuActions(
        calc: BotCalculationContext,
        gameObject: GameObject,
        point: Vector3
    ): ContextMenuAction[];
}
