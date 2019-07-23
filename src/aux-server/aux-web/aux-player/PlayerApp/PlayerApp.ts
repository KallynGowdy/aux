import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { appManager } from '../../shared/AppManager';
import { EventBus } from '../../shared/EventBus';
import ConfirmDialogOptions from '../../shared/ConfirmDialogOptions';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    FilesState,
    UserMode,
    Object,
    getUserMode,
    ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME,
    ON_QR_CODE_SCANNED_ACTION_NAME,
    ON_QR_CODE_SCANNER_OPENED_ACTION_NAME,
    filesInContext,
    isSimulation,
    getFileChannel,
    calculateDestroyFileEvents,
    merge,
    simulationIdToString,
    FileCalculationContext,
    calculateFileValue,
    calculateFormattedFileValue,
    getFileInputTarget,
    getFileInputPlaceholder,
    ShowInputForTagEvent,
    ShowInputOptions,
    ShowInputType,
    ShowInputSubtype,
    File,
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard, navigateToUrl } from '../../shared/SharedUtils';
import LoadApp from '../../shared/vue-components/LoadApp/LoadApp';
import { tap } from 'rxjs/operators';
import { findIndex, flatMap } from 'lodash';
import QRCode from '@chenfengyuan/vue-qrcode';
import CubeIcon from '../public/icons/Cube.svg';
import HexIcon from '../public/icons/Hexagon.svg';
import { QrcodeStream } from 'vue-qrcode-reader';
import { Simulation, AuxUser } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SidebarItem } from '../../shared/vue-components/BaseGameView';
import { Swatches, Chrome, Compact } from 'vue-color';
import { DeviceInfo, ADMIN_ROLE } from '@casual-simulation/causal-trees';

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
        'color-picker-swatches': Swatches,
        'color-picker-advanced': Chrome,
        'color-picker-basic': Compact,
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
     * Whether to show the add simulation dialog.
     */
    showAddSimulation: boolean = false;

    /**
     * Whether to show the confirm remove simulation dialog.
     */
    showRemoveSimulation: boolean = false;

    /**
     * The simulation to remove.
     */
    simulationToRemove: SimulationInfo = null;

    /**
     * The ID of the simulation to add.
     */
    newSimulation: string = '';

    /**
     * The QR Code to show.
     */
    qrCode: string = '';

    inputDialogLabel: string = '';
    inputDialogPlaceholder: string = '';
    inputDialogInput: string = '';
    inputDialogType: ShowInputType = 'text';
    inputDialogSubtype: ShowInputSubtype = 'basic';
    inputDialogInputValue: any = '';
    inputDialogLabelColor: string = '#000';
    inputDialogBackgroundColor: string = '#FFF';
    showInputDialog: boolean = false;
    loginInfo: DeviceInfo = null;

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    private _inputDialogTarget: File = null;
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

    created() {
        this._subs = [];
        this._simulationSubs = new Map();
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
            appManager.whileLoggedIn((user, fileManager) => {
                let subs: SubscriptionLike[] = [];

                this.loggedIn = true;
                this.session = fileManager.parsedId.channel;
                this.context = fileManager.parsedId.context;

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

    logout() {
        appManager.logout();
        this.showNavigation = false;
        this.$router.push({
            name: 'login',
            query: { id: this.session, context: this.context },
        });
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

    addSimulation() {
        this.newSimulation = '';
        this.showAddSimulation = true;
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
        };

        subs.push(
            simulation.login.loginStateChanged.subscribe(state => {
                if (this.$route.name === 'login') {
                    return;
                }

                if (!state.authenticated) {
                    console.log(
                        '[PlayerApp] Not authenticated:',
                        state.authenticationError
                    );
                    if (state.authenticationError) {
                        console.log(
                            '[PlayerApp] Redirecting to login to resolve error.'
                        );
                        this.$router.push({
                            name: 'login',
                            query: {
                                id: simulation.id,
                                reason: state.authenticationError,
                            },
                        });
                    }
                } else {
                    console.log('[PlayerApp] Authenticated!', state.info);
                }

                if (state.authorized) {
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
                if (e.name === 'show_toast') {
                    this.snackbar = {
                        message: e.message,
                        visible: true,
                    };
                } else if (e.name === 'show_qr_code_scanner') {
                    if (this.showQRScanner !== e.open) {
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
                } else if (e.name === 'load_simulation') {
                    this.finishAddSimulation(e.id);
                } else if (e.name === 'unload_simulation') {
                    this.removeSimulationById(e.id);
                } else if (e.name === 'super_shout') {
                    this._superAction(e.eventName, e.argument);
                } else if (e.name === 'show_qr_code') {
                    if (e.open) {
                        this.qrCode = e.code;
                        this.showQRCode = true;
                    } else {
                        this.qrCode = null;
                        this.showQRCode = false;
                    }
                } else if (e.name === 'go_to_context') {
                    appManager.simulationManager.simulations.forEach(sim => {
                        sim.parsedId = {
                            ...sim.parsedId,
                            context: e.context,
                        };
                    });

                    this._updateQuery();
                } else if (e.name === 'go_to_url') {
                    navigateToUrl(e.url, null, 'noreferrer');
                } else if (e.name === 'open_url') {
                    navigateToUrl(e.url, '_blank', 'noreferrer');
                } else if (e.name === 'show_input_for_tag') {
                    setTimeout(() => {
                        this._showInputDialog(simulation, e);
                    });
                }
            }),
            simulation.connection.connectionStateChanged.subscribe(
                connected => {
                    if (!connected) {
                        this._showConnectionLost(info);
                        info.online = false;
                        info.synced = false;
                        info.lostConnection = true;
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
                        info.lostConnection = true;
                        simulation.helper.action('onDisconnected', null);
                    } else {
                        info.synced = true;

                        if (simulation.parsedId.context) {
                            const userFile = simulation.helper.userFile;
                            await simulation.helper.updateFile(userFile, {
                                tags: {
                                    'aux._userContext':
                                        simulation.parsedId.context,
                                },
                            });
                        }
                        simulation.helper.action('onConnected', null);
                    }
                }
            ),
            simulation.login.deviceChanged.subscribe(info => {
                this.loginInfo = info;
            })
        );

        this._simulationSubs.set(simulation, subs);
        this.simulations.push(info);

        this._updateQuery();
    }

    showLoginQRCode() {
        this.qrCode = appManager.user.token;
        this.showQRCode = true;
    }

    // TODO: Move to a shared class/component
    _showInputDialog(simulation: Simulation, event: ShowInputForTagEvent) {
        const calc = simulation.helper.createContext();
        const file = simulation.helper.filesState[event.fileId];
        this._updateLabel(calc, file, event.tag, event.options);
        this._updateColor(calc, file, event.options);
        this._updateInput(calc, file, event.tag, event.options);
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
            await this._inputDialogSimulation.helper.updateFile(
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
        calc: FileCalculationContext,
        file: File,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.backgroundColor !== 'undefined') {
            this.inputDialogBackgroundColor = options.backgroundColor;
        } else {
            this.inputDialogBackgroundColor = '#FFF';
        }
    }

    private _updateLabel(
        calc: FileCalculationContext,
        file: File,
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
        calc: FileCalculationContext,
        file: File,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        this.inputDialogInput = tag;
        this.inputDialogType = options.type || 'text';
        this.inputDialogSubtype = options.subtype || 'basic';
        this._inputDialogTarget = file;
        this.inputDialogInputValue =
            calculateFormattedFileValue(
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
            appManager.simulationManager.primary.parsedId.context ||
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
    private _superAction(eventName: string, arg?: any) {
        appManager.simulationManager.simulations.forEach(sim => {
            sim.helper.action(eventName, null, arg);
        });
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
            } regained. You are back online.`,
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
}
