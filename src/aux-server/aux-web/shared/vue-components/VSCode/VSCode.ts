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
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { IdeNode } from '@casual-simulation/aux-vm-browser';
import {
    initVSCode,
    fetchBuiltinExtensions,
    IDisposable,
    IScannedBuiltinExtension,
} from '@casual-simulation/libvscode';
const CasualOSPackageJSON = require('@casual-simulation/aux-custom-portals/vscode/package.json');

@Component({
    components: {},
})
export default class VSCode extends Vue {
    private _simulation: BrowserSimulation;
    private _disposable: IDisposable;

    constructor() {
        super();
    }

    async mounted() {
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
        this._disposable = await initVSCode({
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
        });
    }

    beforeDestroy() {
        if (this._disposable) {
            this._disposable.dispose();
        }
    }
}
