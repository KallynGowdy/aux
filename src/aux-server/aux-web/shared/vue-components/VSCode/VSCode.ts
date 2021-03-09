import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    ON_SHEET_TAG_CLICK,
    ON_SHEET_BOT_ID_CLICK,
    ON_SHEET_BOT_CLICK,
    toast,
    tweenTo,
    SHEET_PORTAL,
    CLICK_ACTION_NAME,
    onClickArg,
    IDE_PORTAL,
} from '@casual-simulation/aux-common';
import {
    BotManager,
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subject, SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { IdeNode } from '@casual-simulation/aux-vm-browser';
import {
    initVSCode,
    fetchBuiltinExtensions,
    IDisposable,
    IScannedBuiltinExtension,
} from '@casual-simulation/libvscode';
import { merge } from 'lodash';
const CasualOSPackageJSON = require('@casual-simulation/aux-custom-portals/vscode/package.json');

let onMessagePort = new Subject<[string, MessagePort]>();

merge(window, {
    vscode: {
        registerMessagePort(name: string, port: MessagePort) {
            onMessagePort.next([name, port]);
        },
    },
});

@Component({
    components: {},
})
export default class VSCode extends Vue {
    private _simulation: BotManager;
    private _subscriptions: SubscriptionLike[];

    constructor() {
        super();
    }

    async mounted() {
        this._simulation = appManager.simulationManager.primary;
        this._subscriptions = [];

        this._subscriptions.push(
            onMessagePort.subscribe(async ([name, port]) => {
                console.log('registerMessagePort():', name, port);
                if (name === 'casualos' && this._simulation.vm.createEndpoint) {
                    const endpoint = await this._simulation.vm.createEndpoint();
                    port.postMessage(
                        {
                            type: 'init',
                            port: endpoint,
                        },
                        [endpoint]
                    );
                }
            })
        );

        const el = this.$refs.vscodeElement as HTMLElement;
        const publicPath = '/vscode';
        const builtinExtensions = await fetchBuiltinExtensions(publicPath);
        const allExtensions: IScannedBuiltinExtension[] = [
            ...builtinExtensions,
            {
                extensionPath: `../../extensions/casualos`,
                packageJSON: CasualOSPackageJSON,
            },
        ];

        this._subscriptions.push(
            toSubscription(
                await initVSCode({
                    container: el,
                    publicPath: publicPath,
                    builtinExtensions: allExtensions,
                    workbench: {
                        folderUri: {
                            scheme: 'casualos',
                            authority: '',
                            path: '/',
                            fragment: '',
                            query: '',
                        },
                    },
                })
            )
        );
    }

    beforeDestroy() {
        for (let sub of this._subscriptions) {
            sub.unsubscribe();
        }
    }
}

function toSubscription(disposable: IDisposable): SubscriptionLike {
    let closed = false;
    return {
        unsubscribe() {
            if (!closed) {
                closed = true;
                disposable.dispose();
            }
        },
        get closed() {
            return closed;
        },
    };
}
