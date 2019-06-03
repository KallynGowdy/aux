import {
    Scene,
    Color,
    PerspectiveCamera,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight,
    Math as ThreeMath,
    PCFSoftShadowMap,
    HemisphereLight,
    Plane,
    Vector3,
    Quaternion,
    Matrix4,
    Texture,
    OrthographicCamera,
    MeshToonMaterial,
    Mesh,
} from 'three';

import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import * as webvrui from 'webvr-ui';

import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Provide, Prop, Watch } from 'vue-property-decorator';
import { SubscriptionLike } from 'rxjs';
import { concatMap, tap, flatMap as rxFlatMap } from 'rxjs/operators';

import {
    Object,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    AuxFile,
    AuxObject,
    hasValue,
    getFilesStateFromStoredTree,
} from '@casual-simulation/aux-common';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { Time } from '../../shared/scene/Time';
import { Input, InputType } from '../../shared/scene/Input';
import { InputVR } from '../../shared/scene/InputVR';
import { appManager } from '../../shared/AppManager';
import { find, flatMap, uniqBy } from 'lodash';
import PlayerApp from '../PlayerApp/PlayerApp';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { IGameView } from '../../shared/vue-components/IGameView';
import { LayersHelper } from '../../shared/scene/LayersHelper';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { DebugObjectManager } from '../../shared/scene/DebugObjectManager';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import MenuFile from '../MenuFile/MenuFile';
import {
    CameraType,
    resizeCameraRig,
    createCameraRig,
    CameraRig,
} from '../../shared/scene/CameraRigFactory';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
    createHtmlMixerContext,
    createCube,
    createSphere,
} from '../../shared/scene/SceneUtils';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { PlayerSimulation3D } from '../scene/PlayerSimulation3D';
import { Simulation } from '../../shared/Simulation';
import { MenuItem } from '../MenuContext';
import SimulationItem from '../SimulationContext';
import { HtmlMixer } from '../../shared/scene/HtmlMixer';
import { InventorySimulation3D } from '../scene/InventorySimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import CameraHome from '../../shared/vue-components/CameraHome/CameraHome';
import { default as CameraTypeVue } from '../../shared/vue-components/CameraType/CameraType';
import { EventBus } from '../../shared/EventBus';

@Component({
    components: {
        'menu-file': MenuFile,
        'camera-home': CameraHome,
        'camera-type': CameraTypeVue,
    },
})
export default class PlayerGameView extends Vue implements IGameView {
    private _mainScene: Scene;
    private _inventoryScene: Scene;
    private _renderer: WebGLRenderer;

    private _enterVr: any;
    private _vrControls: any;
    private _vrEffect: any;

    private _time: Time;
    private _input: Input;
    private _inputVR: InputVR;
    private _interaction: PlayerInteractionManager;
    private _cameraType: CameraType;
    private _htmlMixerContext: HtmlMixer.Context;

    public onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onCameraRigTypeChanged: ArgEvent<CameraRig> = new ArgEvent<
        CameraRig
    >();

    private playerSimulations: PlayerSimulation3D[] = [];
    private inventorySimulations: InventorySimulation3D[] = [];

    private _fileSubs: SubscriptionLike[];
    private _decoratorFactory: AuxFile3DDecoratorFactory;

    mainCameraRig: CameraRig = null;
    mainViewport: Viewport = null;
    inventoryCameraRig: CameraRig = null;
    inventoryViewport: Viewport = null;
    xrCapable: boolean = false;
    xrDisplay: any = null;
    xrSession: any = null;
    xrSessionInitParameters: any = null;
    vrDisplay: VRDisplay = null;
    vrCapable: boolean = false;

    menuExpanded: boolean = true;

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];
    @Prop() context: string;

    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    get gameView(): HTMLElement {
        return <HTMLElement>this.$refs.gameView;
    }
    get dev(): boolean {
        return !PRODUCTION;
    }
    get filesMode(): boolean {
        console.error('AUX Player does not implement filesMode.');
        return false;
    }
    get workspacesMode(): boolean {
        console.error('AUX Player does not implement workspacesMode.');
        return false;
    }

    get menu() {
        let items: MenuItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.menuContext) {
                items.push(...sim.menuContext.items);
            }
        });
        return items;
    }

    // get fileManager() {
    //     return appManager.simulationManager.primary;
    // }

    constructor() {
        super();
        this.playerSimulations = [];
    }

    public findFilesById(id: string): AuxFile3D[] {
        return flatMap(flatMap(this.playerSimulations, s => s.contexts), c =>
            c.getFiles().filter(f => f.file.id === id)
        );
    }

    /**
     * Find Inventory Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    public findInventorySimulation3D(sim: Simulation): InventorySimulation3D {
        return this.inventorySimulations.find(s => s.simulation === sim);
    }

    /**
     * Find Player Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    public findPlayerSimulation3D(sim: Simulation): PlayerSimulation3D {
        return this.playerSimulations.find(s => s.simulation === sim);
    }

    public getTime() {
        return this._time;
    }
    public getInput() {
        return this._input;
    }
    public getInputVR() {
        return this._inputVR;
    }
    public getInteraction() {
        return this._interaction;
    }
    public getScene() {
        return this._mainScene;
    }
    public getRenderer() {
        return this._renderer;
    }
    public getMainCameraRig(): CameraRig {
        return this.mainCameraRig;
    }
    public getMainViewport(): Viewport {
        return this.mainViewport;
    }
    public getInventoryViewport(): Viewport {
        return this.inventoryViewport;
    }
    public getInventoryCameraRig(): CameraRig {
        return this.inventoryCameraRig;
    }
    public getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.inventory];
    }
    public getHtmlMixerContext(): HtmlMixer.Context {
        return this._htmlMixerContext;
    }
    public getDecoratorFactory(): AuxFile3DDecoratorFactory {
        return this._decoratorFactory;
    }
    public getGridChecker(): GridChecker {
        return null;
    }
    public getViewports(): Viewport[] {
        return [this.mainViewport, this.inventoryViewport];
    }
    public getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig, this.inventoryCameraRig];
    }
    public getSimulations(): Simulation3D[] {
        return [...this.playerSimulations, ...this.inventorySimulations];
        // return [...this.playerSimulations];
        // return [...this.inventorySimulations];
    }
    public getBackground(): Color | Texture {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];
            if (sim.backgroundColor) {
                return sim.backgroundColor;
            }
        }

        return null;
    }

    public setGridsVisible(visible: boolean) {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }

    public setWorldGridVisible(visible: boolean) {}

    public setCameraType(type: CameraType) {
        if (this._cameraType === type) return;

        // Clean up current cameras if they exists.
        if (this.mainCameraRig) {
            this._mainScene.remove(this.mainCameraRig.mainCamera);
            this.mainCameraRig = null;
        }

        this._cameraType = type;

        this.mainCameraRig = createCameraRig(
            'main',
            this._cameraType,
            this._mainScene,
            this.mainViewport
        );

        // Update side bar item.
        this.removeSidebarItem('toggle_camera_type');
        if (this._cameraType === 'orthographic') {
            this.addSidebarItem(
                'toggle_camera_type',
                'Enable Perspective Camera',
                () => {
                    this.setCameraType('perspective');
                },
                'videocam'
            );
        } else {
            this.addSidebarItem(
                'toggle_camera_type',
                'Disable Perspective Camera',
                () => {
                    this.setCameraType('orthographic');
                },
                'videocam_off'
            );
        }

        if (this._htmlMixerContext) {
            this._htmlMixerContext.setupCssCamera(
                this.mainCameraRig.mainCamera
            );
        }

        this.onCameraRigTypeChanged.invoke(this.mainCameraRig);
    }

    public async mounted() {
        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
        window.addEventListener('vrdisplaypresentchange', this._handleResize);

        this.onFileAdded.invoke = this.onFileAdded.invoke.bind(
            this.onFileAdded
        );
        this.onFileRemoved.invoke = this.onFileRemoved.invoke.bind(
            this.onFileRemoved
        );
        this.onFileUpdated.invoke = this.onFileUpdated.invoke.bind(
            this.onFileUpdated
        );

        this._time = new Time();
        this._decoratorFactory = new AuxFile3DDecoratorFactory(this);
        this._fileSubs = [];
        this.playerSimulations = [];
        this.inventorySimulations = [];
        this._setupRenderer();
        this._setupScenes();
        DebugObjectManager.init(this._time, this._mainScene);
        this._input = new Input(this);
        this._inputVR = new InputVR(this);
        this._interaction = new PlayerInteractionManager(this);

        this._setupWebVR();
        await this._setupWebXR();
        this._handleResize();

        this._fileSubs.push(
            appManager.simulationManager.simulationAdded
                .pipe(
                    tap(sim => {
                        this._simulationAdded(sim);
                    })
                )
                .subscribe()
        );

        this._fileSubs.push(
            appManager.simulationManager.simulationRemoved
                .pipe(
                    tap(sim => {
                        this._simulationRemoved(sim);
                    })
                )
                .subscribe()
        );

        this._frameUpdate();

        EventBus.$on('centerCamera', this.onCenterCamera);
        EventBus.$on('changeCameraType', this.setCameraType);
    }

    private _simulationAdded(sim: Simulation) {
        const playerSim3D = new PlayerSimulation3D(this.context, this, sim);
        playerSim3D.init();
        playerSim3D.onFileAdded.addListener(this.onFileAdded.invoke);
        playerSim3D.onFileRemoved.addListener(this.onFileRemoved.invoke);
        playerSim3D.onFileUpdated.addListener(this.onFileUpdated.invoke);

        this._fileSubs.push(
            playerSim3D.simulationContext.itemsUpdated.subscribe(() => {
                this._onSimsUpdated();
            })
        );

        this._fileSubs.push(
            playerSim3D.simulation.helper.localEvents.subscribe(e => {
                if (e.name === 'go_to_context') {
                    this.playerSimulations.forEach(s => {
                        s.setContext(e.context);
                    });
                } else if (e.name === 'import_aux') {
                    this._importAUX(sim, e.url);
                }
            })
        );

        this.playerSimulations.push(playerSim3D);
        this._mainScene.add(playerSim3D);

        //
        // Create Inventory Simulation
        //
        const inventorySim3D = new InventorySimulation3D(this, sim);
        inventorySim3D.init();
        inventorySim3D.onFileAdded.addListener(this.onFileAdded.invoke);
        inventorySim3D.onFileRemoved.addListener(this.onFileRemoved.invoke);
        inventorySim3D.onFileUpdated.addListener(this.onFileUpdated.invoke);

        this.inventorySimulations.push(inventorySim3D);
        this._inventoryScene.add(inventorySim3D);
    }

    private _simulationRemoved(sim: Simulation) {
        //
        // Remove Player Simulation
        //
        const playerSimIndex = this.playerSimulations.findIndex(
            s => s.simulation.id === sim.id
        );
        if (playerSimIndex >= 0) {
            const removed = this.playerSimulations.splice(playerSimIndex, 1);
            removed.forEach(s => {
                s.onFileAdded.removeListener(this.onFileAdded.invoke);
                s.onFileRemoved.removeListener(this.onFileRemoved.invoke);
                s.onFileUpdated.removeListener(this.onFileUpdated.invoke);
                s.unsubscribe();
                this._mainScene.remove(s);
            });
        }

        //
        // Remove Inventory Simulation
        //
        const invSimIndex = this.inventorySimulations.findIndex(
            s => s.simulation.id == sim.id
        );

        if (invSimIndex >= 0) {
            const removed = this.inventorySimulations.splice(invSimIndex, 1);
            removed.forEach(s => {
                s.onFileAdded.removeListener(this.onFileAdded.invoke);
                s.onFileRemoved.removeListener(this.onFileRemoved.invoke);
                s.onFileUpdated.removeListener(this.onFileUpdated.invoke);
                s.unsubscribe();
                this._inventoryScene.remove(s);
            });
        }
    }

    private async _importAUX(sim: Simulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getFilesStateFromStoredTree(stored);
        await sim.helper.addState(state);
    }

    private _onSimsUpdated() {
        let items: SimulationItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.simulationContext) {
                for (let i = 0; i < sim.simulationContext.items.length; i++) {
                    items[i] = sim.simulationContext.items[i];
                }
            }
        });

        items = uniqBy(items, i => i.simulationToLoad);
        appManager.simulationManager.updateSimulations([
            appManager.user.channelId,
            ...items.map(i => i.simulationToLoad),
        ]);
    }

    public beforeDestroy() {
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener(
            'vrdisplaypresentchange',
            this._handleResize
        );
        this.removeSidebarItem('enable_xr');
        this.removeSidebarItem('disable_xr');
        this.removeSidebarItem('debug_mode');
        this.removeSidebarGroup('simulations');
        this._input.dispose();

        if (this._fileSubs) {
            this._fileSubs.forEach(sub => {
                sub.unsubscribe();
            });
            this._fileSubs = [];
        }

        EventBus.$off('centerCamera', this.onCenterCamera);
        EventBus.$off('changeCameraType', this.setCameraType);
    }

    onCenterCamera(cameraRig: CameraRig): void {
        if (!cameraRig) return;
        this.tweenCameraToPosition(cameraRig, new Vector3(0, 0, 0));
    }

    public tweenCameraToFile(
        cameraRig: CameraRig,
        fileId: string,
        zoomValue?: number
    ) {
        console.log('[PlayerGameView] Tween to file: ', fileId);

        // find the file with the given ID
        const files = this.findFilesById(fileId);
        if (files.length > 0) {
            const file = files[0];
            const targetPosition = new Vector3();
            file.display.getWorldPosition(targetPosition);

            this.tweenCameraToPosition(cameraRig, targetPosition, zoomValue);
        }
    }

    public tweenCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number
    ) {
        this._interaction.addOperation(
            new TweenCameraToOperation(
                cameraRig,
                this._interaction,
                position,
                zoomValue
            )
        );
    }

    private _frameUpdate(xrFrame?: any) {
        DebugObjectManager.update();

        // let calc = this.fileManager.helper.createContext();

        this._input.update();
        this._inputVR.update();
        this._interaction.update();

        this.playerSimulations.forEach(s => {
            s.frameUpdate();
        });
        this.inventorySimulations.forEach(s => {
            s.frameUpdate();
        });

        if (this._htmlMixerContext) {
            this._htmlMixerContext.update();
        }

        this._cameraUpdate();

        this._renderUpdate(xrFrame);
        this._time.update();

        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this.vrDisplay.requestAnimationFrame(() => this._frameUpdate());
        } else if (this.xrSession) {
            this.xrSession.requestFrame((nextXRFrame: any) =>
                this._frameUpdate(nextXRFrame)
            );
        } else {
            requestAnimationFrame(() => this._frameUpdate());
        }
    }

    private _cameraUpdate() {
        // Keep camera zoom levels in sync.
        if (
            this.mainCameraRig.uiWorldCamera.zoom !==
            this.mainCameraRig.mainCamera.zoom
        ) {
            this.mainCameraRig.uiWorldCamera.zoom = this.mainCameraRig.mainCamera.zoom;
            this.mainCameraRig.uiWorldCamera.updateProjectionMatrix();
        }

        if (
            this.inventoryCameraRig.uiWorldCamera.zoom !==
            this.inventoryCameraRig.mainCamera.zoom
        ) {
            this.inventoryCameraRig.uiWorldCamera.zoom = this.inventoryCameraRig.mainCamera.zoom;
            this.inventoryCameraRig.uiWorldCamera.updateProjectionMatrix();
        }
    }

    private _renderUpdate(xrFrame?: any) {
        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this._vrControls.update();
            this._renderCore();
            this._vrEffect.render(
                this._mainScene,
                this.mainCameraRig.mainCamera
            );
        } else if (this.xrSession && xrFrame) {
            this._mainScene.background = null;
            this._renderer.setSize(
                this.xrSession.baseLayer.framebufferWidth,
                this.xrSession.baseLayer.framebufferHeight,
                false
            );
            this._renderer.setClearColor('#000', 0);

            this.mainCameraRig.mainCamera.matrixAutoUpdate = false;

            for (const view of xrFrame.views) {
                // Each XRView has its own projection matrix, so set the main camera to use that
                let matrix = new Matrix4();
                matrix.fromArray(view.viewMatrix);

                let position = new Vector3();
                position.setFromMatrixPosition(matrix);
                position.multiplyScalar(10);

                // Move the player up about a foot above the world.
                position.add(new Vector3(0, 2, 3));
                this.mainCameraRig.mainCamera.position.copy(position);

                let rotation = new Quaternion();
                rotation.setFromRotationMatrix(matrix);
                this.mainCameraRig.mainCamera.setRotationFromQuaternion(
                    rotation
                );

                this.mainCameraRig.mainCamera.updateMatrix();
                this.mainCameraRig.mainCamera.updateMatrixWorld(false);

                this.mainCameraRig.mainCamera.projectionMatrix.fromArray(
                    view.projectionMatrix
                );

                // Set up the _renderer to the XRView's viewport and then render
                const viewport = view.getViewport(this.xrSession.baseLayer);
                this._renderer.setViewport(
                    viewport.x,
                    viewport.y,
                    viewport.width,
                    viewport.height
                );

                this._renderCore();
            }
        } else {
            this.mainCameraRig.mainCamera.matrixAutoUpdate = true;
            this._renderCore();
        }
    }

    private _renderCore(): void {
        //
        // [Main scene]
        //

        this._renderer.setSize(
            this.mainViewport.width,
            this.mainViewport.height
        );
        this._renderer.setScissorTest(false);

        // Render the main scene with the main camera.
        this._renderer.clear();
        this._renderer.render(this._mainScene, this.mainCameraRig.mainCamera);

        // Set the background color to null when rendering with the ui world camera.
        this._mainScene.background = null;

        // Render the main scene with the ui world camera.
        this._renderer.clearDepth(); // Clear depth buffer so that ui world appears above objects that were just rendererd.
        this._renderer.render(
            this._mainScene,
            this.mainCameraRig.uiWorldCamera
        );

        this._mainSceneBackgroundUpdate();

        //
        // [Inventory scene]
        //

        this._renderer.clearDepth(); // Clear depth buffer so that inventory scene always appears above the main scene.

        if (this._mainScene.background instanceof Color) {
            this._inventorySceneBackgroundUpdate(this._mainScene.background);
        }

        this._renderer.setViewport(
            this.inventoryViewport.x,
            this.inventoryViewport.y,
            this.inventoryViewport.width,
            this.inventoryViewport.height
        );
        this._renderer.setScissor(
            this.inventoryViewport.x,
            this.inventoryViewport.y,
            this.inventoryViewport.width,
            this.inventoryViewport.height
        );
        this._renderer.setScissorTest(true);

        // Render the inventory scene with the inventory main camera.
        this._renderer.render(
            this._inventoryScene,
            this.inventoryCameraRig.mainCamera
        );

        this._inventoryScene.background = null;

        // Render the inventory scene with the inventory ui world camera.
        this._renderer.clearDepth(); // Clear depth buffer so that ui objects dont use it.
        this._renderer.render(
            this._inventoryScene,
            this.inventoryCameraRig.uiWorldCamera
        );
    }

    private _mainSceneBackgroundUpdate() {
        const background = this.getBackground();
        if (background) {
            this._mainScene.background = background;
        } else {
            this._mainScene.background = new Color(
                DEFAULT_SCENE_BACKGROUND_COLOR
            );
        }
    }

    private _inventorySceneBackgroundUpdate(colorToOffset: Color) {
        if (!colorToOffset) return;

        let invColor = colorToOffset.clone();
        invColor.offsetHSL(0, -0.02, -0.04);
        this._inventoryScene.background = invColor;
    }

    private _setupRenderer() {
        const webGlRenderer = (this._renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
        }));
        webGlRenderer.autoClear = false;
        webGlRenderer.shadowMap.enabled = false;

        this.mainViewport = new Viewport('main', null, this._container);
        this.mainViewport.layer = 0;
        this.inventoryViewport = new Viewport('inventory', this.mainViewport);
        this.inventoryViewport.layer = 1;

        this.gameView.appendChild(this._renderer.domElement);
    }

    private _setupScenes() {
        //
        // [Main scene]
        //
        this._mainScene = new Scene();

        // Main scene camera.
        this.setCameraType('orthographic');

        // Main scene ambient light.
        const ambient = baseAuxAmbientLight();
        this._mainScene.add(ambient);

        // Main scene directional light.
        const directional = baseAuxDirectionalLight();
        this._mainScene.add(directional);

        //
        // [Inventory scene]
        //
        this._inventoryScene = new Scene();

        // Inventory camera.
        this.inventoryCameraRig = createCameraRig(
            'inventory',
            'orthographic',
            this._inventoryScene,
            this.inventoryViewport
        );
        this.inventoryCameraRig.mainCamera.zoom = 50;
        this._inventoryScene.add(this.inventoryCameraRig.mainCamera);

        // Inventory ambient light.
        const invAmbient = baseAuxAmbientLight();
        this._inventoryScene.add(invAmbient);

        // Inventory direction light.
        const invDirectional = baseAuxDirectionalLight();
        this._inventoryScene.add(invDirectional);

        //
        // [Html Mixer Context]
        //
        this._htmlMixerContext = createHtmlMixerContext(
            this._renderer,
            this.mainCameraRig.mainCamera,
            this.gameView
        );
    }

    private _setupWebVR() {
        let onBeforeEnter = () => {
            console.log('[PlayerGameView] vr on before enter');

            this._renderer.vr.enabled = true;

            // VR controls
            this._vrControls = new VRControlsModule(
                this.mainCameraRig.mainCamera
            );
            this._vrControls.standing = true;

            // Create VR Effect rendering in stereoscopic mode
            this._vrEffect = new VREffectModule(this._renderer);
            this._renderer.setPixelRatio(window.devicePixelRatio);

            return new Promise(resolve => {
                resolve(null);
            });
        };

        this.vrDisplay = null;

        // WebVR enable button.
        let vrButtonOptions = {
            color: 'black',
            beforeEnter: onBeforeEnter,
        };

        this._enterVr = new webvrui.EnterVRButton(
            this._renderer.domElement,
            vrButtonOptions
        );

        // Event handlers for the vr button.
        this._handleReadyVR = this._handleReadyVR.bind(this);
        this._handleEnterVR = this._handleEnterVR.bind(this);
        this._handleExitVR = this._handleExitVR.bind(this);
        this._handleErrorVR = this._handleErrorVR.bind(this);

        this._enterVr.on('ready', this._handleReadyVR);
        this._enterVr.on('enter', this._handleEnterVR);
        this._enterVr.on('exit', this._handleExitVR);
        this._enterVr.on('error', this._handleErrorVR);

        let vrButtonContainer = document.getElementById('vr-button-container');
        vrButtonContainer.appendChild(this._enterVr.domElement);
    }

    // TODO: All this needs to be reworked to use the right WebXR polyfill
    // - Use this one: https://github.com/immersive-web/webxr-polyfill
    // - instead of this one: https://github.com/mozilla/webxr-polyfill

    private async _setupWebXR() {
        const win = <any>window;
        const navigator = <any>win.navigator;
        const xr = navigator.XR;

        if (typeof xr === 'undefined') {
            console.log('[PlayerGameView] WebXR Not Supported.');
            return;
        }

        const displays = await xr.getDisplays();
        this.xrSessionInitParameters = {
            exclusive: false,
            type: win.XRSession.AUGMENTATION,
            videoFrames: false, //computer_vision_data
            alignEUS: true,
            worldSensing: false,
        };
        const matchingDisplay = find(displays, d =>
            d.supportsSession(this.xrSessionInitParameters)
        );
        if (matchingDisplay && this._isRealAR(matchingDisplay)) {
            this.xrCapable = true;
            this.xrDisplay = matchingDisplay;
            this.addSidebarItem('enable_xr', 'Enable AR', () => {
                this._toggleXR();
            });
            console.log('[PlayerGameView] WebXR Supported!');
        }
    }

    private async _toggleXR() {
        console.log('toggle XR');
        if (this.xrDisplay) {
            if (this.xrSession) {
                this.removeSidebarItem('disable_xr');
                this.addSidebarItem('enable_xr', 'Enable AR', () => {
                    this._toggleXR();
                });

                await this.xrSession.end();
                this.xrSession = null;
                document.documentElement.classList.remove('ar-app');
            } else {
                this.removeSidebarItem('enable_xr');
                this.addSidebarItem('disable_xr', 'Disable AR', () => {
                    this._toggleXR();
                });

                document.documentElement.classList.add('ar-app');
                this.xrSession = await this.xrDisplay.requestSession(
                    this.xrSessionInitParameters
                );
                this.xrSession.near = 0.1;
                this.xrSession.far = 1000;

                this.xrSession.addEventListener('focus', (ev: any) =>
                    this._handleXRSessionFocus()
                );
                this.xrSession.addEventListener('blur', (ev: any) =>
                    this._handleXRSessionBlur()
                );
                this.xrSession.addEventListener('end', (ev: any) =>
                    this._handleXRSessionEnded()
                );

                this._startXR();

                setTimeout(() => {
                    this._handleResize();
                }, 1000);
            }
        }
    }

    private _startXR() {
        const win = <any>window;
        if (this.xrSession === null) {
            throw new Error('Can not start presenting without a xrSession');
        }

        // Set the xrSession's base layer into which the app will render
        this.xrSession.baseLayer = new win.XRWebGLLayer(
            this.xrSession,
            this._renderer.context
        );

        // Handle layer focus events
        this.xrSession.baseLayer.addEventListener('focus', (ev: any) => {
            this._handleXRLayerFocus();
        });
        this.xrSession.baseLayer.addEventListener('blur', (ev: any) => {
            this._handleXRLayerBlur();
        });

        // this.xrSession.requestFrame(this._boundHandleFrame)
    }

    private _handleXRSessionFocus() {}

    private _handleXRSessionBlur() {}

    private _handleXRSessionEnded() {}

    private _handleXRLayerFocus() {}

    private _handleXRLayerBlur() {}

    private _isRealAR(xrDisplay: any): boolean {
        // The worst hack of all time.
        // Basically does the check that the webxr polyfill does
        // to see it the device really supports Web XR.
        return (
            typeof (<any>window).webkit !== 'undefined' ||
            xrDisplay._reality._vrDisplay
        );
    }

    private _handleReadyVR(display: VRDisplay) {
        console.log('[PlayerGameView] vr display is ready.');
        console.log(display);
        this.vrDisplay = display;

        // When being used on a vr headset, force the normal input module to use touch instead of mouse.
        // Touch seems to work better for 2d browsers on vr headsets (like the Oculus Go).
        this._input.currentInputType = InputType.Touch;
    }

    private _handleEnterVR(display: any) {
        console.log('[PlayerGameView] enter vr.');
        console.log(display);
        this.vrDisplay = display;
    }

    private _handleExitVR(display: any) {
        console.log('[PlayerGameView] exit vr.');
        console.log(display);

        this._renderer.vr.enabled = false;

        this._inputVR.disconnectControllers();

        this._vrControls.dispose();
        this._vrControls = null;

        this._vrEffect.dispose();
        this._vrEffect = null;

        // reset camera back to default position.
        this.mainCameraRig.mainCamera.position.z = 5;
        this.mainCameraRig.mainCamera.position.y = 3;
        this.mainCameraRig.mainCamera.rotation.x = ThreeMath.degToRad(-30);
        this.mainCameraRig.mainCamera.updateMatrixWorld(false);
    }

    private _handleErrorVR() {
        // console.error('error vr');
        // console.error(error);
    }

    private _handleResize() {
        const width = window.innerWidth;
        const height =
            window.innerHeight - this._container.getBoundingClientRect().top;

        this.mainViewport.setSize(width, height);

        // Resize html view and the webgl renderer.
        this._renderer.setPixelRatio(window.devicePixelRatio || 1);
        this._renderer.setSize(width, height);
        this._container.style.height = this.gameView.style.height = this._renderer.domElement.style.height;
        this._container.style.width = this.gameView.style.width = this._renderer.domElement.style.width;

        // Resize html mixer css3d renderer.
        if (this._htmlMixerContext) {
            this._htmlMixerContext.rendererCss.setSize(width, height);
        }

        const invHeightScale = height < 850 ? 0.25 : 0.2;
        this.inventoryViewport.setScale(null, invHeightScale);

        // Resize cameras.
        if (this.mainCameraRig) {
            resizeCameraRig(this.mainCameraRig);
        }
        if (this.inventoryCameraRig) {
            resizeCameraRig(this.inventoryCameraRig);
        }

        // Resize VR effect.
        if (this._vrEffect) {
            const vrWidth = window.innerWidth;
            const vrHeight = window.innerHeight;
            this._vrEffect.setSize(vrWidth, vrHeight);
        }
    }

    private get _container() {
        return <HTMLElement>this.$refs.container;
    }
}