import {
    Scene,
    WebGLRenderer,
    Color,
    Texture,
    Vector3,
    Matrix4,
    Quaternion,
    Math as ThreeMath,
    PerspectiveCamera,
    ArrayCamera,
    AxesHelper,
    LineBasicMaterial,
    NoColors,
    Box3Helper,
    BoxHelper,
    Box3,
    Object3D,
    Vector2,
} from 'three';
import { IGameView } from '../vue-components/IGameView';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import {
    Bot,
    DEFAULT_SCENE_BACKGROUND_COLOR,
} from '@casual-simulation/aux-common';
import {
    CameraRig,
    CameraType,
    resizeCameraRig,
    createCameraRig,
    resetCameraRigToDefaultPosition,
} from './CameraRigFactory';
import { Time } from './Time';
import { Input, InputType } from './Input';
import { InputVR } from './vr/InputVR';
import { BaseInteractionManager } from '../interaction/BaseInteractionManager';
import { Viewport } from './Viewport';
import { HtmlMixer } from './HtmlMixer';
import { GridChecker } from './grid/GridChecker';
import { Simulation3D } from './Simulation3D';
import { AuxBotVisualizer } from './AuxBotVisualizer';
import { SubscriptionLike, Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TweenCameraToOperation } from '../interaction/TweenCameraToOperation';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
    createHtmlMixerContext,
    disposeHtmlMixerContext,
} from './SceneUtils';
import find from 'lodash/find';
import flatMap from 'lodash/flatMap';
import { EventBus } from '../EventBus';
import { AuxBotVisualizerFinder } from '../AuxBotVisualizerFinder';
import { WebVRDisplays } from '../WebVRDisplays';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';
import Bowser from 'bowser';
import { AuxBot3D } from './AuxBot3D';

/**
 * The Game class is the root of all Three Js activity for the current AUX session.
 * It houses all the core systems for interacting with AUX Web, such as rendering 3d elements to the canvas,
 * handling input, tracking time, and enabling VR and AR.
 */
export abstract class Game implements AuxBotVisualizerFinder {
    /**
     * The game view component that this game is parented to.
     */
    gameView: IGameView;

    protected mainScene: Scene;
    protected renderer: WebGLRenderer;
    protected time: Time;
    protected input: Input;
    protected inputVR: InputVR;
    protected interaction: BaseInteractionManager;
    protected gridChecker: GridChecker;
    protected htmlMixerContext: HtmlMixer.Context;
    protected currentCameraType: CameraType;
    protected subs: SubscriptionLike[];
    protected disposed: boolean = false;

    mainCameraRig: CameraRig = null;
    mainViewport: Viewport = null;
    showMainCameraHome: boolean;

    xrDisplay: any = null;
    xrSession: any = null;
    xrSessionInitParameters: any = null;

    onBotAdded: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotUpdated: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotRemoved: ArgEvent<Bot> = new ArgEvent<Bot>();
    onCameraRigTypeChanged: ArgEvent<CameraRig> = new ArgEvent<CameraRig>();

    abstract get botsMode(): boolean;
    abstract get workspacesMode(): boolean;

    private _onUpdate: Subject<void> = new Subject<void>();

    constructor(gameView: IGameView) {
        this.gameView = gameView;
    }

    async setup() {
        console.log('[Game] Setup');
        this.onBotAdded.invoke = this.onBotAdded.invoke.bind(this.onBotAdded);
        this.onBotRemoved.invoke = this.onBotRemoved.invoke.bind(
            this.onBotRemoved
        );
        this.onBotUpdated.invoke = this.onBotUpdated.invoke.bind(
            this.onBotUpdated
        );

        DebugObjectManager.init();

        this.time = new Time();
        this.subs = [];
        this.setupRenderer();
        this.setupScenes();
        this.input = new Input(this);
        this.inputVR = new InputVR(this);
        this.interaction = this.setupInteraction();

        await this.setupWebVR();
        await this.setupWebXR();

        this.onCenterCamera = this.onCenterCamera.bind(this);
        this.setCameraType = this.setCameraType.bind(this);

        EventBus.$on('centerCamera', this.onCenterCamera);
        EventBus.$on('changeCameraType', this.setCameraType);

        await this.onBeforeSetupComplete();

        this.frameUpdate = this.frameUpdate.bind(this);
        this.renderer.setAnimationLoop(this.frameUpdate);
    }

    protected async onBeforeSetupComplete() {}

    dispose(): void {
        if (this.disposed) {
            return;
        }
        console.log('[Game] Dispose');
        this.disposed = true;

        this.renderer.setAnimationLoop(null);
        disposeHtmlMixerContext(this.htmlMixerContext, this.gameView.gameView);
        this.removeSidebarItem('enable_xr');
        this.removeSidebarItem('disable_xr');
        this.input.dispose();

        if (this.subs) {
            this.subs.forEach(sub => {
                sub.unsubscribe();
            });
            this.subs = [];
        }

        EventBus.$off('changeCameraType', this.setCameraType);
    }

    getTime() {
        return this.time;
    }
    getInput() {
        return this.input;
    }
    getInputVR() {
        return this.inputVR;
    }
    getInteraction() {
        return this.interaction;
    }
    getScene() {
        return this.mainScene;
    }
    getRenderer() {
        return this.renderer;
    }
    getMainCameraRig(): CameraRig {
        return this.mainCameraRig;
    }
    getMainViewport(): Viewport {
        return this.mainViewport;
    }
    getHtmlMixerContext(): HtmlMixer.Context {
        return this.htmlMixerContext;
    }
    getGridChecker(): GridChecker {
        return this.gridChecker;
    }

    abstract getBackground(): Color | Texture;

    /**
     * Get all of the current viewports.
     */
    abstract getViewports(): Viewport[];

    /**
     * Get all of the current camera rigs.
     */
    abstract getCameraRigs(): CameraRig[];

    /**
     * Gets the list of simulations that this game view contains.
     */
    abstract getSimulations(): Simulation3D[];

    /**
     * Gets the HTML elements that the interaction manager should be able to handle events for.
     */
    abstract getUIHtmlElements(): HTMLElement[];

    abstract findBotsById(id: string): AuxBotVisualizer[];

    /**
     * Sets the visibility of the bot grids.
     */
    abstract setGridsVisible(visible: boolean): void;

    /**
     * Sets the visibility of the world grid.
     * @param visible Whether the grid is visible.
     */
    abstract setWorldGridVisible(visible: boolean): void;

    abstract setupInteraction(): BaseInteractionManager;

    /**
     * Adds a new sidebar item to the sidebar.
     * @param id
     * @param text
     * @param click
     */
    abstract addSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon?: string,
        group?: string
    ): void;

    /**
     * Removes the sidebar item with the given ID.
     * @param id
     */
    abstract removeSidebarItem(id: string): void;

    /**
     * Removes all the sidebar items with the given group.
     * @param id
     */
    abstract removeSidebarGroup(group: string): void;

    onWindowResize(width: number, height: number): void {
        this.mainViewport.setSize(width, height);

        // Resize html view and the webgl renderer.
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize(width, height);

        // Resize html mixer css3d renderer.
        if (this.htmlMixerContext) {
            this.htmlMixerContext.rendererCss.setSize(width, height);
        }

        // Resize cameras.
        if (this.mainCameraRig) {
            resizeCameraRig(this.mainCameraRig);
        }
    }

    setCameraType(type: CameraType) {
        if (this.currentCameraType === type) return;

        // Clean up current cameras if they exists.
        if (this.mainCameraRig) {
            this.mainScene.remove(this.mainCameraRig.mainCamera);
            this.mainCameraRig = null;
        }

        this.currentCameraType = type;

        this.mainCameraRig = createCameraRig(
            'main',
            this.currentCameraType,
            this.mainScene,
            this.mainViewport
        );

        // Update side bar item.
        this.removeSidebarItem('toggle_camera_type');
        if (this.currentCameraType === 'orthographic') {
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

        if (this.htmlMixerContext) {
            this.htmlMixerContext.setupCssCamera(this.mainCameraRig.mainCamera);
        }

        this.onCameraRigTypeChanged.invoke(this.mainCameraRig);
    }

    onCenterCamera(cameraRig: CameraRig): void {
        if (!cameraRig) return;

        let controls = this.interaction.cameraRigControllers.find(
            c => c.rig.name === cameraRig.name
        );

        if (cameraRig.name != 'main') {
            controls.controls.resetRot = true;
            controls.controls.update();
        }

        this.tweenCameraToPosition(cameraRig, new Vector3(0, 0, 0));
    }

    /**
     * Tweens the camera to view the bot.
     * @param cameraRig The camera rig to tween.
     * @param botId The ID of the bot to view.
     * @param zoomValue The zoom value to use.
     * @param duration The time that the tween should last.
     */
    tweenCameraToBot(
        cameraRig: CameraRig,
        botId: string,
        zoomValue?: number,
        rotationValue?: Vector2,
        duration?: number
    ) {
        // find the bot with the given ID
        const sims = this.getSimulations();
        const bots = flatMap(sims, s => s.bots);
        console.log(this.constructor.name, 'tweenCameraToBot all bots:', bots);
        const matches = this.findBotsById(botId);
        console.log(
            this.constructor.name,
            'tweenCameraToBot matching bots:',
            matches
        );
        if (matches.length > 0) {
            const bot = matches[0];
            const targetPosition = new Vector3();
            if (bot instanceof AuxBot3D) {
                bot.display.getWorldPosition(targetPosition);

                this.tweenCameraToPosition(
                    cameraRig,
                    targetPosition,
                    zoomValue,
                    rotationValue,
                    duration
                );
            }
        }
    }

    /**
     * Animates the main camera to the given position.
     * @param cameraRig The camera rig to tween.
     * @param position The position to animate to.
     * @param zoomValue The zoom value to use.
     */
    tweenCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number,
        rotationValue?: Vector2,
        duration?: number
    ) {
        this.interaction.addOperation(
            new TweenCameraToOperation(
                cameraRig,
                this.interaction,
                position,
                zoomValue,
                rotationValue,
                duration
            )
        );
    }

    /**
     * Instantly sets the main camera to the given position.
     * @param cameraRig The camera rig to tween.
     * @param position The position to animate to.
     * @param zoomValue The zoom value to use.
     */
    setCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number,
        rotationValue?: Vector2
    ) {
        this.interaction.addOperation(
            new TweenCameraToOperation(
                cameraRig,
                this.interaction,
                position,
                zoomValue,
                rotationValue,
                0
            )
        );
    }

    protected mainSceneBackgroundUpdate() {
        const background = this.getBackground();
        if (background) {
            this.mainScene.background = background;
        } else {
            this.mainScene.background = new Color(
                DEFAULT_SCENE_BACKGROUND_COLOR
            );
        }
    }

    protected setupRenderer() {
        const webGlRenderer = (this.renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
        }));
        webGlRenderer.autoClear = false;
        webGlRenderer.shadowMap.enabled = false;

        this.mainViewport = new Viewport('main', null, this.gameView.container);
        this.mainViewport.layer = 0;

        this.gameView.gameView.appendChild(this.renderer.domElement);
    }

    protected setupScenes() {
        //
        // [Main scene]
        //
        this.mainScene = new Scene();
        this.mainScene.autoUpdate = false;

        // Main scene camera.
        this.setCameraType('orthographic');

        // Main scene ambient light.
        const ambient = baseAuxAmbientLight();
        this.mainScene.add(ambient);

        // Main scene directional light.
        const directional = baseAuxDirectionalLight();
        this.mainScene.add(directional);

        //
        // [Html Mixer Context]
        //
        this.htmlMixerContext = createHtmlMixerContext(
            this.renderer,
            this.mainCameraRig.mainCamera,
            this.gameView.gameView
        );
    }

    protected async setupWebVR() {
        this.handleVRDisplayConnect = this.handleVRDisplayConnect.bind(this);
        this.handleVRDisplayDisconnect = this.handleVRDisplayDisconnect.bind(
            this
        );
        this.handleVRDisplayActivate = this.handleVRDisplayActivate.bind(this);
        this.handleVRDisplayDeactivate = this.handleVRDisplayDeactivate.bind(
            this
        );
        this.handleVRDisplayBlur = this.handleVRDisplayBlur.bind(this);
        this.handleVRDisplayFocus = this.handleVRDisplayFocus.bind(this);
        this.handleVRDisplayPresentChange = this.handleVRDisplayPresentChange.bind(
            this
        );

        WebVRDisplays.onVRDisplayConnect.addListener(
            this.handleVRDisplayConnect
        );
        WebVRDisplays.onVRDisplayDisconnect.addListener(
            this.handleVRDisplayDisconnect
        );
        WebVRDisplays.onVRDisplayActivate.addListener(
            this.handleVRDisplayActivate
        );
        WebVRDisplays.onVRDisplayDeactivate.addListener(
            this.handleVRDisplayDeactivate
        );
        WebVRDisplays.onVRDisplayBlur.addListener(this.handleVRDisplayBlur);
        WebVRDisplays.onVRDisplayFocus.addListener(this.handleVRDisplayFocus);
        WebVRDisplays.onVRDisplayPresentChange.addListener(
            this.handleVRDisplayPresentChange
        );

        await WebVRDisplays.init();

        if (WebVRDisplays.mainVRDisplay()) {
            // When being used on a vr headset, force the normal input module to use touch instead of mouse.
            // Touch seems to work better for 2d browsers on vr headsets (like the Oculus Go).
            this.input.currentInputType = InputType.Touch;
        }

        // We want to control when the frame gets sent to the VRDisplay so we nullify the core WebVRManager.submitFrame
        // function and will call submitFrame on the VRDisplay manually in order to have better flow control over VR frame rendering.
        this.renderer.vr.submitFrame = (): void => {
            // Do absolutely nothing.
        };
    }

    // TODO: All this needs to be reworked to use the right WebXR polyfill
    // - Use this one: https://github.com/immersive-web/webxr-polyfill
    // - instead of this one: https://github.com/mozilla/webxr-polyfill
    protected async setupWebXR() {
        const win = <any>window;
        const navigator = <any>win.navigator;
        const xr = navigator.XR;

        if (typeof xr === 'undefined') {
            console.log('[Game] WebXR Not Supported.');
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
        if (matchingDisplay && this.isRealAR(matchingDisplay)) {
            this.xrDisplay = matchingDisplay;
            this.addSidebarItem('enable_xr', 'Enable AR', () => {
                this.toggleXR();
            });
            console.log('[Game] WebXR Supported!');
        }
    }

    protected frameUpdate(xrFrame?: any) {
        DebugObjectManager.update();

        this.input.update();
        this.inputVR.update();
        this.interaction.update();

        const simulations = this.getSimulations();
        if (simulations) {
            for (let i = 0; i < simulations.length; i++) {
                simulations[i].frameUpdate();
            }
        }

        if (this.htmlMixerContext) {
            this.htmlMixerContext.update();
        }

        this.renderUpdate(xrFrame);
        this.time.update();

        if (this.xrSession) {
            this.xrSession.requestFrame((nextXRFrame: any) =>
                this.frameUpdate(nextXRFrame)
            );
        }

        this._onUpdate.next();
    }

    private renderUpdate(xrFrame?: any) {
        if (this.xrSession && xrFrame) {
            this.mainScene.background = null;
            this.renderer.setClearColor('#000', 0);

            for (const view of xrFrame.views) {
                // Each XRView has its own projection matrix, so set the main camera to use that
                const matrix = new Matrix4();
                matrix.fromArray(view.viewMatrix);

                const position = new Vector3();
                position.setFromMatrixPosition(matrix);
                position.multiplyScalar(10);

                // Move the player up about a foot above the world.
                position.add(new Vector3(0, 2, 3));
                this.mainCameraRig.mainCamera.position.copy(position);

                const rotation = new Quaternion();
                rotation.setFromRotationMatrix(matrix);
                this.mainCameraRig.mainCamera.setRotationFromQuaternion(
                    rotation
                );

                this.mainCameraRig.mainCamera.projectionMatrix.fromArray(
                    view.projectionMatrix
                );

                this.mainCameraRig.mainCamera.updateMatrixWorld(true);

                // Set up the _renderer to the XRView's viewport and then render
                const viewport = view.getViewport(this.xrSession.baseLayer);

                this.renderer.setViewport(
                    viewport.x,
                    viewport.y,
                    viewport.width,
                    viewport.height
                );

                this.renderXR();
            }
        } else if (WebVRDisplays.isPresenting()) {
            this.renderVR();

            if (this.renderer.vr.enabled) {
                // Submit the final rendered frame to the active VRDisplay.
                const vrDisplay = this.renderer.vr.getDevice();
                if (vrDisplay.isPresenting) {
                    vrDisplay.submitFrame();
                }
            }
        } else {
            this.renderBrowser();
        }
    }

    /**
     * Render the current frame for the default browser mode.
     */
    protected renderBrowser() {
        //
        // [Main scene]
        //

        this.renderer.setSize(
            this.mainViewport.width,
            this.mainViewport.height
        );

        this.mainCameraRig.mainCamera.updateMatrixWorld(true);

        this.renderer.setScissorTest(false);

        // Render the main scene with the main camera.
        this.renderer.clear();
        this.mainSceneBackgroundUpdate();
        this.renderer.render(this.mainScene, this.mainCameraRig.mainCamera);

        // Render debug object manager if it's enabled.
        if (DebugObjectManager.enabled) {
            DebugObjectManager.render(
                this.renderer,
                this.mainCameraRig.mainCamera
            );
        }
    }

    /**
     * Render the current frame for XR (AR mode).
     */
    protected renderXR() {
        //
        // [Main scene]
        //

        this.mainCameraRig.mainCamera.updateMatrixWorld(true);

        this.renderer.setScissorTest(false);

        // Render the main scene with the main camera.
        this.renderer.clear();
        this.renderer.render(this.mainScene, this.mainCameraRig.mainCamera);

        // Render debug object manager if it's enabled.
        if (DebugObjectManager.enabled) {
            DebugObjectManager.render(
                this.renderer,
                this.mainCameraRig.mainCamera
            );
        }
    }

    /**
     * Render the current frame for VR.
     */
    protected renderVR() {
        //
        // [Main scene]
        //

        this.mainCameraRig.mainCamera.updateMatrixWorld(true);

        // Render the main scene with the main camera.
        this.renderer.clear();
        this.mainSceneBackgroundUpdate();
        this.renderer.render(this.mainScene, this.mainCameraRig.mainCamera);

        // Render debug object manager if it's enabled.
        if (DebugObjectManager.enabled) {
            DebugObjectManager.render(
                this.renderer,
                this.mainCameraRig.mainCamera
            );
        }
    }

    watchCameraRigDistanceSquared(cameraRig: CameraRig): Observable<number> {
        let rigControls = this.interaction.cameraRigControllers.find(
            rigControls => rigControls.rig === cameraRig
        );

        return this._onUpdate.pipe(
            map(() => {
                const target = rigControls.controls.target.clone();
                return target.distanceToSquared(new Vector3(0, 0, 0));
            })
        );
    }

    // private _showHomeButtonForCameraRig(cameraRig: CameraRig, distance: number): boolean {

    //     if (rigControls) {
    //         if (distance > 0) {
    //             const target = rigControls.controls.target.clone();
    //             const distSqr = target.distanceToSquared(
    //                 new Vector3(0, 0, 0)
    //             );

    //             return distSqr >= distance;
    //         } else {
    //             // Always show the button.
    //             return true;
    //         }
    //     } else {
    //         return false;
    //     }
    // }

    protected async toggleXR() {
        console.log('[Game] Toggle XR');
        if (this.xrDisplay) {
            if (this.xrSession) {
                this.removeSidebarItem('disable_xr');
                this.addSidebarItem('enable_xr', 'Enable AR', () => {
                    this.toggleXR();
                });

                await this.xrSession.end();
                this.xrSession = null;

                // Restart the regular animation update loop.
                this.renderer.setAnimationLoop(this.frameUpdate);
                // Go back to the orthographic camera type when exiting XR.
                this.setCameraType('orthographic');
            } else {
                this.removeSidebarItem('enable_xr');
                this.addSidebarItem('disable_xr', 'Disable AR', () => {
                    this.toggleXR();
                });

                // XR requires that we be using a perspective camera.
                this.setCameraType('perspective');
                // Remove the camera toggle from the menu while in XR.
                this.removeSidebarItem('toggle_camera_type');

                document.documentElement.classList.add('ar-app');
                this.xrSession = await this.xrDisplay.requestSession(
                    this.xrSessionInitParameters
                );
                this.xrSession.near = 0.1;
                this.xrSession.far = 1000;

                this.xrSession.addEventListener('focus', (ev: any) =>
                    this.handleXRSessionFocus()
                );
                this.xrSession.addEventListener('blur', (ev: any) =>
                    this.handleXRSessionBlur()
                );
                this.xrSession.addEventListener('end', (ev: any) =>
                    this.handleXRSessionEnded()
                );

                this.startXR();

                // Stop regular animation update loop and use the one from the xr session.
                this.renderer.setAnimationLoop(null);
                this.xrSession.requestFrame((nextXRFrame: any) =>
                    this.frameUpdate(nextXRFrame)
                );
            }
        }
    }

    protected startXR() {
        const win = <any>window;
        if (this.xrSession === null) {
            throw new Error('Cannot start presenting without a xrSession');
        }

        // Set the xrSession's base layer into which the app will render
        this.xrSession.baseLayer = new win.XRWebGLLayer(
            this.xrSession,
            this.renderer.context
        );

        // Handle layer focus events
        this.xrSession.baseLayer.addEventListener('focus', (ev: any) => {
            this.handleXRLayerFocus();
        });
        this.xrSession.baseLayer.addEventListener('blur', (ev: any) => {
            this.handleXRLayerBlur();
        });
    }

    protected handleXRSessionFocus() {
        console.log('[Game] handleXRSessionFocus');
    }

    protected handleXRSessionBlur() {
        console.log('[Game] handleXRSessionBlur');
    }

    protected handleXRSessionEnded() {
        console.log('[Game] handleXRSessionEnded');
    }

    protected handleXRLayerFocus() {
        console.log('[Game] handleXRLayerFocus');
    }

    protected handleXRLayerBlur() {
        console.log('[Game] handleXRLayerBlur');
    }

    protected isRealAR(xrDisplay: any): boolean {
        // The worst hack of all time.
        // Basically does the check that the webxr polyfill does
        // to see it the device really supports Web XR.
        const arSupported =
            typeof (<any>window).webkit !== 'undefined' ||
            xrDisplay._reality._vrDisplay;
        const bowser = Bowser.parse(navigator.userAgent);
        // Also we're gonna limit this to Safari only for now. (The mozilla webxr viewer reports itself as Safari).
        return bowser.browser.name == 'Safari' && arSupported;
    }

    protected updateVRToggle(): void {
        this.removeSidebarItem('toggle_vr');

        if (WebVRDisplays.vrCapable && WebVRDisplays.mainVRDisplay()) {
            const buttonText: string = WebVRDisplays.mainVRDisplay()
                .isPresenting
                ? 'Exit VR'
                : 'Enter VR';
            const buttonIcon: string = undefined;

            const onClick = () => {
                if (WebVRDisplays.mainVRDisplay().isPresenting) {
                    this.renderer.vr.enabled = false;
                    this.renderer.vr.setDevice(null);
                    WebVRDisplays.mainVRDisplay().exitPresent();
                } else {
                    this.setCameraType('perspective'); // Setting camera to perspective allows the VR user to be properly displayed in scene.
                    this.renderer.vr.enabled = true;
                    this.renderer.vr.setDevice(WebVRDisplays.mainVRDisplay());
                    WebVRDisplays.mainVRDisplay().requestPresent([
                        { source: this.renderer.domElement },
                    ]);
                }
            };

            this.addSidebarItem('toggle_vr', buttonText, onClick, buttonIcon);
        }
    }

    protected handleVRDisplayConnect(display: VRDisplay): void {
        this.updateVRToggle();
    }
    protected handleVRDisplayDisconnect(display: VRDisplay): void {
        this.updateVRToggle();
        this.inputVR.disconnectControllers();
    }
    protected handleVRDisplayActivate(display: VRDisplay): void {
        this.updateVRToggle();
    }
    protected handleVRDisplayDeactivate(display: VRDisplay): void {
        this.updateVRToggle();
        this.inputVR.disconnectControllers();
    }
    protected handleVRDisplayBlur(display: VRDisplay): void {
        this.updateVRToggle();
    }
    protected handleVRDisplayFocus(display: VRDisplay): void {
        this.updateVRToggle();
    }
    protected handleVRDisplayPresentChange(display: VRDisplay): void {
        this.updateVRToggle();

        if (WebVRDisplays.mainVRDisplay().isPresenting) {
            this.renderer.vr.enabled = true;
            this.renderer.vr.setDevice(WebVRDisplays.mainVRDisplay());
        } else {
            this.renderer.vr.enabled = false;
            this.renderer.vr.setDevice(null);
            this.inputVR.disconnectControllers();
            // reset camera back to default position.
            resetCameraRigToDefaultPosition(this.mainCameraRig);
        }
    }
}
