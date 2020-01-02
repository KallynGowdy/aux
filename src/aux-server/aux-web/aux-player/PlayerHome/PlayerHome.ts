import Vue from 'vue';
import Component from 'vue-class-component';
import { Watch, Prop, Provide, Inject } from 'vue-property-decorator';
import {
    goToContext,
    Bot,
    getSelectionMode,
    DEFAULT_SELECTION_MODE,
    SelectionMode,
} from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { appManager } from '../../shared/AppManager';
import { first, tap } from 'rxjs/operators';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    userBotChanged,
    BrowserSimulation,
} from '@casual-simulation/aux-vm-browser';
import { EventBus } from '../../shared/EventBus';
import BotTable from '../../shared/vue-components/BotTable/BotTable';
import { getRenderer, BotRenderer } from '../../shared/scene/BotRenderer';
import PlayerApp from '../PlayerApp/PlayerApp';

@Component({
    components: {
        'game-view': PlayerGameView,
        'bot-table': BotTable,
    },
})
export default class PlayerHome extends Vue {
    @Provide() home = this;
    @Provide() botRenderer: BotRenderer = getRenderer();
    @Inject() playerApp: PlayerApp;

    @Prop() context: string;
    @Prop() channels: string | string[];
    @Prop() primaryChannel: string;

    debug: boolean = false;

    private _simulation: BrowserSimulation;

    bots: Bot[] = [];
    searchResult: any = null;
    isSearch: boolean = false;
    setLargeSheet: boolean = false;
    isDiff: boolean = false;
    updateTime: number = -1;
    selectionMode: SelectionMode = DEFAULT_SELECTION_MODE;
    isOpen: boolean = false;
    isVis: boolean = false;
    isLoading: boolean = false;
    hasToolbar: boolean = false;

    getUIHtmlElements(): HTMLElement[] {
        const table = <BotTable>this.$refs.table;
        if (table) {
            return table.uiHtmlElements();
        }
        return [];
    }

    get user() {
        return appManager.user;
    }

    get botManager() {
        return appManager.simulationManager.primary;
    }

    @Watch('channels')
    async onRouteChanged(
        newChannels: string | string[],
        oldChannels: string | string[]
    ) {
        await this._updateChannels(newChannels);
    }

    @Watch('context')
    async onContextChanged() {
        if (
            appManager.simulationManager.primary.parsedId.context !==
            this.context
        ) {
            await appManager.simulationManager.primary.helper.transaction(
                goToContext(this.context)
            );
        }
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot);
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        const sim = await appManager.setPrimarySimulation(
            `${this.context}/${this.primaryChannel}`
        );

        sim.connection.syncStateChanged
            .pipe(first(synced => synced))
            .subscribe(() => {
                this.isLoading = false;
            });

        // this.isLoading = false;
    }

    async mounted() {
        this._updateChannels(this.channels);

        appManager.whileLoggedIn((user, botManager) => {
            let subs = [];
            this._simulation = appManager.simulationManager.primary;
            this.isOpen = false;
            this.isVis = true;
            this.bots = [];
            this.updateTime = -1;

            subs.push(
                this._simulation.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                    this.isDiff = e.isDiff;
                    this.searchResult = e.searchResult;
                    this.isSearch = e.isSearch;
                    const now = Date.now();
                    this.updateTime = now;
                }),
                this._simulation.botPanel.isOpenChanged.subscribe(open => {
                    this.isOpen = open;
                }),
                this._simulation.botPanel.isVisChanged.subscribe(vis => {
                    this.isVis = vis;
                })
            );

            subs.push(
                userBotChanged(this._simulation)
                    .pipe(
                        tap(bot => {
                            let previousSelectionMode = this.selectionMode;
                            this.selectionMode = getSelectionMode(bot);
                        })
                    )
                    .subscribe()
            );

            this.isLoading = false;
            return subs;
        });

        EventBus.$on('toggleSheetSize', this.toggleSheetSize);
        EventBus.$on('showRunBar', (visible: boolean) => {
            this.hasToolbar = visible;
            this.$nextTick(() => {
                EventBus.$emit('resizeGameView');
            });
        });
    }

    toggleSheetSize() {
        this.setLargeSheet = !this.setLargeSheet;
    }

    private async _updateChannels(newChannels: string | string[]) {
        newChannels = newChannels || [];

        if (!Array.isArray(newChannels)) {
            newChannels = [newChannels];
        }

        for (let i = 0; i < newChannels.length; i++) {
            await appManager.simulationManager.primary.helper.createSimulation(
                newChannels[i]
            );
        }
    }
}
