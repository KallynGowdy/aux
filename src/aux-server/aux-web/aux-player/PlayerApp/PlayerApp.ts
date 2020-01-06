import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { appManager } from '../../shared/AppManager';
import { EventBus } from '../../shared/EventBus';
import ConfirmDialogOptions from '../../shared/ConfirmDialogOptions';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    BotsState,
    Object,
    ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME,
    ON_QR_CODE_SCANNED_ACTION_NAME,
    ON_QR_CODE_SCANNER_OPENED_ACTION_NAME,
    botsInDimension,
    isSimulation,
    getBotChannel,
    calculateDestroyBotEvents,
    merge,
    simulationIdToString,
    BotCalculationContext,
    calculateBotValue,
    calculateFormattedBotValue,
    ShowInputForTagAction,
    ShowInputOptions,
    ShowInputType,
    ShowInputSubtype,
    Bot,
    BarcodeFormat,
    ON_BARCODE_SCANNER_OPENED_ACTION_NAME,
    ON_BARCODE_SCANNER_CLOSED_ACTION_NAME,
    ON_BARCODE_SCANNED_ACTION_NAME,
    ON_CHANNEL_SUBSCRIBED_ACTION_NAME,
    ON_CHANNEL_STREAMING_ACTION_NAME,
    ON_CHANNEL_STREAM_LOST_ACTION_NAME,
    ON_CHANNEL_UNSUBSCRIBED_ACTION_NAME,
    parseSimulationId,
    CameraType,
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard, navigateToUrl } from '../../shared/SharedUtils';
import LoadApp from '../../shared/vue-components/LoadApp/LoadApp';
import { tap } from 'rxjs/operators';
import findIndex from 'lodash/findIndex';
import QRCode from '@chenfengyuan/vue-qrcode';
import CubeIcon from '../public/icons/Cube.svg';
import HexIcon from '../public/icons/Hexagon.svg';
import QrcodeStream from 'vue-qrcode-reader/src/components/QrcodeStream';
import { Simulation, AuxUser, LoginState } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SidebarItem } from '../../shared/vue-components/BaseGameView';
import { Swatches, Chrome, Compact } from 'vue-color';
import { DeviceInfo, ADMIN_ROLE } from '@casual-simulation/causal-trees';
import Console from '../../shared/vue-components/Console/Console';
import { recordMessage } from '../../shared/Console';
import Tagline from '../../shared/vue-components/Tagline/Tagline';
import VueBarcode from '../../shared/public/VueBarcode';
import BarcodeScanner from '../../shared/vue-components/BarcodeScanner/BarcodeScanner';
import Checkout from '../Checkout/Checkout';
import LoginPopup from '../../shared/vue-components/LoginPopup/LoginPopup';
import AuthorizePopup from '../../shared/vue-components/AuthorizeAccountPopup/AuthorizeAccountPopup';
import { sendWebhook } from '../../../shared/WebhookUtils';
import HtmlModal from '../../shared/vue-components/HtmlModal/HtmlModal';
import ClipboardModal from '../../shared/vue-components/ClipboardModal/ClipboardModal';
import { loginToSim, generateGuestId } from '../../shared/LoginUtils';
import download from 'downloadjs';
import { writeTextToClipboard } from '../../shared/ClipboardHelpers';

export interface SidebarItem {
    id: string;
    group: string;
    text: string;
    icon: string;
    click: () => void;
}

@Component({
    components: {
        'load-app': LoadApp,
        'qr-code': QRCode,
        'qrcode-stream': QrcodeStream,
        barcode: VueBarcode,
        'barcode-stream': BarcodeScanner,
        'color-picker-swatches': Swatches,
        'color-picker-advanced': Chrome,
        'color-picker-basic': Compact,
        'html-modal': HtmlModal,
        'clipboard-modal': ClipboardModal,
        console: Console,
        tagline: Tagline,
        checkout: Checkout,
        login: LoginPopup,
        authorize: AuthorizePopup,
    },
})
export default class PlayerApp extends Vue {
    showNavigation: boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    updateAvailable: boolean = false;
    snackbar: SnackbarOptions = {
        visible: false,
        message: '',
        duration: 2000,
    };

    /**
     * Whether we had previously lost our connection to the server.
     */
    lostConnection: boolean = false;

    /**
     * Whether the user is logged in.
     */
    loggedIn: boolean = false;

    /**
     * Whether to show the QR Code.
     */
    showQRCode: boolean = false;

    /**
     * Whether to show the QR Code Scanner.
     */
    showQRScanner: boolean = false;

    /**
     * The session.
     */
    session: string = '';

    /**
     * The context.
     */
    context: string = '';

    /**
     * The extra sidebar items shown in the app.
     */
    extraItems: SidebarItem[] = [];

    /**
     * The list of simulations that are in the app.
     */
    simulations: SimulationInfo[] = [];

    /**
     * Whether to show the confirm remove simulation dialog.
     */
    showRemoveSimulation: boolean = false;

    /**
     * The simulation to remove.
     */
    simulationToRemove: SimulationInfo = null;

    /**
     * The QR Code to show.
     */
    qrCode: string = '';

    /**
     * The barcode to display.
     */
    barcode: string = '';

    /**
     * The barcode format to use.
     */
    barcodeFormat: BarcodeFormat = 'code128';

    /**
     * Whether to show the barcode.
     */
    showBarcode: boolean = false;

    /**
     * Whether to show the barcode scanner.
     */
    showBarcodeScanner: boolean = false;

    /**
     * The camera type that should be used for the scanner.
     */
    camera: CameraType;

    /**
     * Whether to show the authorize account popup.
     */
    showAuthorize: boolean = false;

    authorized: boolean = false;

    inputDialogLabel: string = '';
    inputDialogPlaceholder: string = '';
    inputDialogInput: string = '';
    inputDialogType: ShowInputType = 'text';
    inputDialogSubtype: ShowInputSubtype = 'basic';
    inputDialogInputValue: any = '';
    inputDialogLabelColor: string = '#000';
    inputDialogBackgroundColor: string = '#FFF';
    showInputDialog: boolean = false;
    showConsole: boolean = false;
    loginInfo: DeviceInfo = null;
    loginState: LoginState = null;

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    private _inputDialogTarget: Bot = null;
    private _inputDialogSimulation: Simulation = null;
    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, SubscriptionLike[]> = new Map();

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get versionTooltip() {
        return appManager.version.gitCommit;
    }

    get isAdmin() {
        return this.loginInfo && this.loginInfo.roles.indexOf(ADMIN_ROLE) >= 0;
    }

    /**
     * Adds a new sidebar item to the sidebar.
     * @param id
     * @param text
     * @param click
     */
    @Provide()
    addSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon: string = null,
        group: string = null
    ) {
        const index = findIndex(this.extraItems, i => i.id === id);
        if (index >= 0) {
            this.extraItems[index] = {
                id: id,
                group: group,
                text: text,
                icon: icon,
                click: click,
            };
        } else {
            this.extraItems.push({
                id: id,
                group: group,
                text: text,
                icon: icon,
                click: click,
            });
        }
    }

    /**
     * Removes the sidebar item with the given ID.
     * @param id
     */
    @Provide()
    removeSidebarItem(id: string) {
        const index = findIndex(this.extraItems, i => i.id === id);
        if (index >= 0) {
            this.extraItems.splice(index, 1);
        }
    }

    /**
     * Removes all the sidebar items with the given group.
     * @param id
     */
    @Provide()
    removeSidebarGroup(group: string) {
        for (let i = this.extraItems.length - 1; i >= 0; i--) {
            const item = this.extraItems[i];
            if (item.group === group) {
                this.extraItems.splice(i, 1);
            }
        }
    }

    url() {
        return location.href;
    }

    forcedOffline(info: SimulationInfo) {
        const simulation = appManager.simulationManager.simulations.get(
            info.id
        );
        return simulation.connection.forcedOffline;
    }

    closeConsole() {
        this.showConsole = false;
    }

    created() {
        this._subs = [];
        this._simulationSubs = new Map();
        this.camera = null;
        this._subs.push(
            appManager.updateAvailableObservable.subscribe(updateAvailable => {
                if (updateAvailable) {
                    this.updateAvailable = true;
                    this._showUpdateAvailable();
                }
            })
        );

        this._subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._simulationAdded(sim)))
                .subscribe(),
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._simulationRemoved(sim)))
                .subscribe()
        );

        this._subs.push(
            appManager.whileLoggedIn((user, botManager) => {
                let subs: SubscriptionLike[] = [];

                this.loggedIn = true;
                this.session = botManager.parsedId.channel;
                this.context = botManager.parsedId.dimension;

                subs.push(
                    new Subscription(() => {
                        this.loggedIn = false;
                    })
                );

                return subs;
            })
        );

        EventBus.$on('showNavigation', this.onShowNavigation);
        EventBus.$on('showConfirmDialog', this.onShowConfirmDialog);
        EventBus.$on('showAlertDialog', this.onShowAlertDialog);
    }

    copy(text: string) {
        copyToClipboard(text);
        this.snackbar = {
            visible: true,
            message: `Copied '${text}' to the clipboard!`,
        };
    }

    beforeDestroy() {
        this._subs.forEach(s => s.unsubscribe());
    }

    async logout() {
        await loginToSim(
            appManager.simulationManager.primary,
            generateGuestId()
        );
    }

    snackbarClick(action: SnackbarOptions['action']) {
        if (action) {
            switch (action.type) {
                case 'refresh':
                    this.refreshPage();
                    break;
            }
        }
    }

    getUser(): AuxUser {
        return appManager.user;
    }

    menuClicked() {
        this.showNavigation = !this.showNavigation;
    }

    refreshPage() {
        window.location.reload();
    }

    fixConflicts() {
        this.$router.push({
            name: 'merge-conflicts',
            params: { id: this.session },
        });
    }

    toggleOnlineOffline(info: SimulationInfo) {
        let options = new ConfirmDialogOptions();
        const simulation = appManager.simulationManager.simulations.get(
            info.id
        );
        if (simulation.connection.forcedOffline) {
            options.title = 'Enable online?';
            options.body = `Allow ${
                info.displayName
            } to reconnect to the server?`;
            options.okText = 'Go Online';
            options.cancelText = 'Stay Offline';
        } else {
            options.title = 'Force offline mode?';
            options.body = `Prevent ${
                info.displayName
            } from connecting to the server?`;
            options.okText = 'Go Offline';
            options.cancelText = 'Stay Online';
        }
        EventBus.$once(options.okEvent, () => {
            simulation.connection.toggleForceOffline();
            EventBus.$off(options.cancelEvent);
        });
        EventBus.$once(options.cancelEvent, () => {
            EventBus.$off(options.okEvent);
        });
        EventBus.$emit('showConfirmDialog', options);
    }

    async hideQRCodeScanner() {
        this.showQRScanner = false;
    }

    async onQrCodeScannerClosed() {
        this._superAction(ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME);
    }

    async onQRCodeScanned(code: string) {
        this._superAction(ON_QR_CODE_SCANNED_ACTION_NAME, code);
    }

    hideBarcodeScanner() {
        this.showBarcodeScanner = false;
    }

    async onBarcodeScannerClosed() {
        this._superAction(ON_BARCODE_SCANNER_CLOSED_ACTION_NAME);
    }

    onBarcodeScanned(code: string) {
        this._superAction(ON_BARCODE_SCANNED_ACTION_NAME, code);
    }

    async finishAddSimulation(id: string) {
        console.log('[PlayerApp] Add simulation!');
        await appManager.simulationManager.primary.helper.createSimulation(id);
    }

    removeSimulation(info: SimulationInfo) {
        if (appManager.simulationManager.primary.id === info.id) {
            this.snackbar = {
                message: `You cannot remove the primary channel.`,
                visible: true,
            };
        } else {
            this.showRemoveSimulation = true;
            this.simulationToRemove = info;
        }
    }

    finishRemoveSimulation() {
        this.removeSimulationById(this.simulationToRemove.id);
    }

    removeSimulationById(id: string) {
        appManager.simulationManager.simulations.forEach(sim => {
            sim.helper.destroySimulations(id);
        });
    }

    getQRCode(): string {
        return this.qrCode || this.url();
    }

    getLoginCode(): string {
        return appManager.user ? appManager.user.token : '';
    }

    getBarcode() {
        return this.barcode || '';
    }

    getBarcodeFormat() {
        return this.barcodeFormat || '';
    }

    private _simulationAdded(simulation: BrowserSimulation) {
        const index = this.simulations.findIndex(s => s.id === simulation.id);
        if (index >= 0) {
            return;
        }

        let subs: SubscriptionLike[] = [];
        let info: SimulationInfo = {
            id: simulation.id,
            displayName: simulationIdToString(simulation.parsedId),
            online: false,
            synced: false,
            lostConnection: false,
            subscribed: false,
        };

        subs.push(
            simulation.login.loginStateChanged.subscribe(state => {
                this.loginState = state;
                if (!state.authenticated) {
                    console.log(
                        '[PlayerApp] Not authenticated:',
                        state.authenticationError
                    );
                    if (state.authenticationError) {
                        console.log(
                            '[PlayerApp] Redirecting to login to resolve error.'
                        );
                        this.showAuthorize = true;
                    }
                } else {
                    this.showAuthorize = false;
                    console.log('[PlayerApp] Authenticated!', state.info);
                }

                if (state.authorized) {
                    this.authorized = true;
                    console.log('[PlayerApp] Authorized!');
                } else if (state.authorized === false) {
                    console.log('[PlayerApp] Not authorized.');
                    if (state.authorizationError === 'channel_doesnt_exist') {
                        this.snackbar = {
                            message: 'This channel does not exist.',
                            visible: true,
                        };
                    } else {
                        this.snackbar = {
                            message:
                                'You are not authorized to view this channel.',
                            visible: true,
                        };
                    }
                }
            }),
            simulation.localEvents.subscribe(async e => {
                if (e.type === 'show_toast') {
                    this.snackbar = {
                        message: e.message,
                        visible: true,
                        duration: e.duration,
                    };
                } else if (e.type === 'show_qr_code_scanner') {
                    if (this.showQRScanner !== e.open) {
                        this.camera = e.cameraType;
                        this.showQRScanner = e.open;
                        if (e.open) {
                            this._superAction(
                                ON_QR_CODE_SCANNER_OPENED_ACTION_NAME
                            );
                        } else {
                            // Don't need to send an event for closing
                            // because onQrCodeScannerClosed() gets triggered
                            // automatically.
                        }
                    }
                } else if (e.type === 'show_barcode_scanner') {
                    if (this.showBarcodeScanner !== e.open) {
                        this.camera = e.cameraType;
                        this.showBarcodeScanner = e.open;
                        if (e.open) {
                            this._superAction(
                                ON_BARCODE_SCANNER_OPENED_ACTION_NAME
                            );
                        } else {
                            // Don't need to send an event for closing
                            // because onBarcodeScannerClosed() gets triggered
                            // automatically.
                        }
                    }
                } else if (e.type === 'load_simulation') {
                    this.finishAddSimulation(e.id);
                } else if (e.type === 'unload_simulation') {
                    this.removeSimulationById(e.id);
                } else if (e.type === 'super_shout') {
                    this._superAction(e.eventName, e.argument);
                } else if (e.type === 'show_qr_code') {
                    if (e.open) {
                        this._showQRCode(e.code);
                    } else {
                        this._hideQRCode();
                    }
                } else if (e.type === 'show_barcode') {
                    if (e.open) {
                        this._showBarcode(e.code, e.format);
                    } else {
                        this._hideBarcode();
                    }
                } else if (e.type === 'go_to_context') {
                    this.updateTitleContext(e.context);
                    appManager.simulationManager.simulations.forEach(sim => {
                        sim.parsedId = {
                            ...sim.parsedId,
                            dimension: e.context,
                        };
                    });

                    this._updateQuery();
                    this.setTitleToID();
                } else if (e.type === 'go_to_url') {
                    navigateToUrl(e.url, null, 'noreferrer');
                } else if (e.type === 'open_url') {
                    navigateToUrl(e.url, '_blank', 'noreferrer');
                } else if (e.type === 'show_input_for_tag') {
                    setTimeout(() => {
                        this._showInputDialog(simulation, e);
                    });
                } else if (e.type === 'download') {
                    console.log(`[BuilderApp] Downloading ${e.botname}...`);
                    download(e.data, e.botname, e.mimeType);
                } else if (e.type === 'open_console') {
                    this.showConsole = e.open;
                } else if (e.type === 'send_webhook') {
                    sendWebhook(simulation, e);
                }
            }),
            simulation.connection.connectionStateChanged.subscribe(
                connected => {
                    if (!connected) {
                        info.online = false;
                        info.synced = false;
                        if (info.subscribed) {
                            this._showConnectionLost(info);
                            info.lostConnection = true;
                        }
                    } else {
                        info.online = true;
                        if (info.lostConnection) {
                            this._showConnectionRegained(info);
                        }
                        info.lostConnection = false;
                        info.synced = true;
                        if (
                            info.id == appManager.simulationManager.primary.id
                        ) {
                            appManager.checkForUpdates();
                        }
                    }
                }
            ),
            simulation.connection.syncStateChanged.subscribe(
                async connected => {
                    if (!connected) {
                        info.synced = false;
                        if (info.subscribed) {
                            info.lostConnection = true;
                            await this._superAction(
                                ON_CHANNEL_STREAM_LOST_ACTION_NAME,
                                {
                                    channel: simulation.parsedId.channel,
                                }
                            );
                        }
                    } else {
                        info.synced = true;

                        if (simulation.parsedId.dimension) {
                            const userBot = simulation.helper.userBot;
                            await simulation.helper.updateBot(userBot, {
                                tags: {
                                    _auxUserDimension:
                                        simulation.parsedId.dimension,
                                },
                            });
                        }

                        if (simulation.parsedId.dimension) {
                            let id = simulation.id;
                            if (id.includes('/')) {
                                id = id.split('/')[1];
                            }

                            const userBot = simulation.helper.userBot;
                            await simulation.helper.updateBot(userBot, {
                                tags: {
                                    _auxUserChannel: id,
                                },
                            });
                        }

                        if (!info.subscribed) {
                            info.subscribed = true;
                            await this._superAction(
                                ON_CHANNEL_SUBSCRIBED_ACTION_NAME,
                                {
                                    channel: simulation.parsedId.channel,
                                }
                            );

                            for (let info of this.simulations) {
                                if (
                                    info.id === simulation.id ||
                                    !info.subscribed
                                ) {
                                    continue;
                                }
                                const parsedId = parseSimulationId(info.id);
                                if (!parsedId.success) {
                                    continue;
                                }
                                await simulation.helper.action(
                                    ON_CHANNEL_SUBSCRIBED_ACTION_NAME,
                                    null,
                                    {
                                        channel: parsedId.channel,
                                    }
                                );
                            }
                        }

                        await this._superAction(
                            ON_CHANNEL_STREAMING_ACTION_NAME,
                            {
                                channel: simulation.parsedId.channel,
                            }
                        );
                    }
                }
            ),
            simulation.login.deviceChanged.subscribe(info => {
                this.loginInfo = info || this.loginInfo;
            }),
            simulation.consoleMessages.subscribe(m => {
                recordMessage(m);
            }),
            new Subscription(async () => {
                await this._superAction(ON_CHANNEL_UNSUBSCRIBED_ACTION_NAME, {
                    channel: simulation.parsedId.channel,
                });
            })
        );

        this._simulationSubs.set(simulation, subs);
        this.simulations.push(info);

        this._updateQuery();
    }

    private _showQRCode(code: string) {
        this.qrCode = code;
        this.showQRCode = true;
        this._hideBarcode();
    }

    private _hideQRCode() {
        this.qrCode = null;
        this.showQRCode = false;
    }

    private _showBarcode(code: string, format: BarcodeFormat) {
        this.barcode = code;
        this.barcodeFormat = format;
        this.showBarcode = true;
        this._hideQRCode();
    }

    private _hideBarcode() {
        this.barcode = null;
        this.showBarcode = false;
    }

    // TODO: Move to a shared class/component
    _showInputDialog(simulation: Simulation, event: ShowInputForTagAction) {
        const calc = simulation.helper.createContext();
        const bot = simulation.helper.botsState[event.botId];
        this._updateLabel(calc, bot, event.tag, event.options);
        this._updateColor(calc, bot, event.options);
        this._updateInput(calc, bot, event.tag, event.options);
        this._inputDialogSimulation = simulation;
        this.showInputDialog = true;
    }

    setTitleToID() {
        let id: string = '...';

        if (appManager.simulationManager.primary != null) {
            id = appManager.simulationManager.primary.id;
        }

        //document.title = "AUX Player | " + id;
        document.title = id;
    }

    updateTitleContext(newContext: string) {
        let id: string = '...';

        if (appManager.simulationManager.primary != null) {
            let temp = appManager.simulationManager.primary.id.split('/');
            id = '';
            for (let i = 1; i < temp.length; i++) {
                id += temp[i];
            }
            id = newContext + '/' + id;
        }

        appManager.simulationManager.primary.updateID(id);
        document.title = id;
    }

    updateInputDialogColor(newColor: any) {
        if (typeof newColor === 'object') {
            this.inputDialogInputValue = newColor.hex;
        } else {
            this.inputDialogInputValue = newColor;
        }
    }

    async closeInputDialog() {
        if (this.showInputDialog) {
            await this._inputDialogSimulation.helper.action('onCloseInput', [
                this._inputDialogTarget,
            ]);
            this.showInputDialog = false;
        }
    }

    async saveInputDialog() {
        if (this.showInputDialog) {
            let value: any;
            if (
                this.inputDialogType === 'color' &&
                typeof this.inputDialogInputValue === 'object'
            ) {
                value = this.inputDialogInputValue.hex;
            } else {
                value = this.inputDialogInputValue;
            }
            await this._inputDialogSimulation.helper.updateBot(
                this._inputDialogTarget,
                {
                    tags: {
                        [this.inputDialogInput]: value,
                    },
                }
            );
            await this._inputDialogSimulation.helper.action('onSaveInput', [
                this._inputDialogTarget,
            ]);
            await this.closeInputDialog();
        }
    }

    private _updateColor(
        calc: BotCalculationContext,
        bot: Bot,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.backgroundColor !== 'undefined') {
            this.inputDialogBackgroundColor = options.backgroundColor;
        } else {
            this.inputDialogBackgroundColor = '#FFF';
        }
    }

    private _updateLabel(
        calc: BotCalculationContext,
        bot: Bot,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.title !== 'undefined') {
            this.inputDialogLabel = options.title;
        } else {
            this.inputDialogLabel = tag;
        }

        if (typeof options.foregroundColor !== 'undefined') {
            this.inputDialogLabelColor = options.foregroundColor;
        } else {
            this.inputDialogLabelColor = '#000';
        }
    }

    private _updateInput(
        calc: BotCalculationContext,
        bot: Bot,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        this.inputDialogInput = tag;
        this.inputDialogType = options.type || 'text';
        this.inputDialogSubtype = options.subtype || 'basic';
        this._inputDialogTarget = bot;
        this.inputDialogInputValue =
            calculateFormattedBotValue(
                calc,
                this._inputDialogTarget,
                this.inputDialogInput
            ) || '';

        if (typeof options.placeholder !== 'undefined') {
            this.inputDialogPlaceholder = options.placeholder;
        } else {
            this.inputDialogPlaceholder = this.inputDialogInput;
        }
    }

    private _simulationRemoved(simulation: Simulation) {
        const subs = this._simulationSubs.get(simulation);

        if (subs) {
            subs.forEach(s => {
                s.unsubscribe();
            });
        }

        this._simulationSubs.delete(simulation);

        const index = this.simulations.findIndex(s => s.id === simulation.id);
        if (index >= 0) {
            this.simulations.splice(index, 1);
        }

        this._updateQuery();
    }

    private _updateQuery() {
        if (!appManager.simulationManager.primary) {
            return;
        }

        const previousChannel = this.$router.currentRoute.params.id;
        const previousContext = this.$router.currentRoute.params.context;

        const channel =
            appManager.simulationManager.primary.parsedId.channel ||
            previousChannel;
        const context =
            appManager.simulationManager.primary.parsedId.dimension ||
            previousContext;
        if (channel && context) {
            let route = {
                name: 'home',
                params: {
                    id: channel === 'default' ? null : channel,
                    context: context,
                },
                query: {
                    channels: this.simulations
                        .filter(
                            sim =>
                                sim.id !==
                                appManager.simulationManager.primary.id
                        )
                        .map(sim => sim.id),
                },
            };

            // Only add the history if switching contexts or the primary channel
            if (channel !== previousChannel || context !== previousContext) {
                window.history.pushState({}, window.document.title);
            }

            this.$router.replace(route);
        }
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private async _superAction(eventName: string, arg?: any) {
        for (let [id, sim] of appManager.simulationManager.simulations) {
            await sim.helper.action(eventName, null, arg);
        }
    }

    private _showConnectionLost(info: SimulationInfo) {
        this.snackbar = {
            visible: true,
            message: `Connection to ${
                info.displayName
            } lost. You are now working offline.`,
        };
    }

    private _showOffline() {
        this.snackbar = {
            visible: true,
            message:
                'You are offline. Changes will be synced to the server upon reconnection.',
        };
    }

    private _showUpdateAvailable() {
        this.snackbar = {
            visible: true,
            message: 'A new version is available!',
            action: {
                type: 'refresh',
                label: 'Refresh',
            },
        };
    }

    private _showConnectionRegained(info: SimulationInfo) {
        this.snackbar = {
            visible: true,
            message: `Connection to ${
                info.displayName
            } regained. You are connected to the channel.`,
        };
    }

    private _showSynced() {
        this.snackbar = {
            visible: true,
            message: 'Synced!',
        };
    }

    private onShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error(
                '[PlayerApp] Missing expected boolean argument for showNavigation event.'
            );
            return;
        }

        console.log('[PlayerApp] handleShowNavigation: ' + show);
        this.showNavigation = show;
    }

    private onShowConfirmDialog(options: ConfirmDialogOptions) {
        if (options == undefined) {
            console.error(
                '[PlayerApp] Missing expected ConfirmDialogOptions argument for showConfirmDialog event.'
            );
            return;
        }

        this.confirmDialogOptions = options;
        this.showConfirmDialog = true;
        console.log(
            '[PlayerApp] handleShowConfirmDialog ' +
                this.showConfirmDialog +
                ' ' +
                JSON.stringify(this.confirmDialogOptions)
        );
    }

    private onShowAlertDialog(options: AlertDialogOptions) {
        if (options == undefined) {
            console.error(
                '[PlayerApp] Missing expected AlertDialogOptions argument for showAlertDialog event.'
            );
            return;
        }

        this.alertDialogOptions = options;
        this.showAlertDialog = true;
        console.log(
            '[PlayerApp] handleShowAlertDialog ' +
                this.showAlertDialog +
                ' ' +
                JSON.stringify(this.alertDialogOptions)
        );
    }

    /**
     * Click event from App.vue
     */
    private onConfirmDialogOk() {
        if (this.confirmDialogOptions.okEvent != null)
            EventBus.$emit(this.confirmDialogOptions.okEvent);
    }

    /**
     * Click event from App.vue
     */
    private onConfirmDialogCancel() {
        if (this.confirmDialogOptions.cancelEvent != null)
            EventBus.$emit(this.confirmDialogOptions.cancelEvent);
    }
}

export interface SimulationInfo {
    id: string;
    displayName: string;
    online: boolean;
    synced: boolean;
    lostConnection: boolean;
    subscribed: boolean;
}
