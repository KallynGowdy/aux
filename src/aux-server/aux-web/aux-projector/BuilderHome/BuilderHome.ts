import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch, Provide, Prop } from 'vue-property-decorator';
import { Bot, isBot, goToDimension } from '@casual-simulation/aux-common';
import BotTable from '../../shared/vue-components/BotTable/BotTable';
import ColorPicker from '../ColorPicker/ColorPicker';
import { ContextMenuEvent } from '../../shared/interaction/ContextMenuEvent';
import TagEditor from '../../shared/vue-components/TagEditor/TagEditor';
import { SubscriptionLike } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { EventBus } from '../../shared/EventBus';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../shared/AppManager';
import { BotRenderer, getRenderer } from '../../shared/scene/BotRenderer';

@Component({
    components: {
        'bot-table': BotTable,
        'color-picker': ColorPicker,
        'tag-editor': TagEditor,
    },
})
export default class BuilderHome extends Vue {
    @Provide() home = this;

    debug: boolean = false;

    contextMenuStyle: any = {
        left: '0px',
        top: '0px',
    };

    @Prop() channelId: string;
    @Prop() dimension: string;

    contextMenuVisible: boolean = false;
    contextMenuEvent: ContextMenuEvent = null;
    status: string = '';
    bots: Bot[] = [];
    setLargeSheet: boolean = true;
    isDiff: boolean = false;
    tags: string[] = [];
    updateTime: number = -1;
    isLoading: boolean = false;
    progress: number = 0;
    progressMode: 'indeterminate' | 'determinate' = 'determinate';
    private _simulation: BrowserSimulation;

    @Provide() botRenderer: BotRenderer = getRenderer();

    getUIHtmlElements(): HTMLElement[] {
        const table = <BotTable>this.$refs.table;
        if (table) {
            return table.uiHtmlElements();
        }
        return [];
    }

    get hasBots() {
        return this.bots && this.bots.length > 0;
    }

    toggleSheetSize() {
        this.setLargeSheet = !this.setLargeSheet;
    }

    getSheetStyleEditor(): any {
        if (this.setLargeSheet) return { 'max-height': '100% !important' };
        else return {};
    }

    getSheetStyleCard(): any {
        if (this.setLargeSheet) return { 'max-width': '100% !important' };
        else return {};
    }

    handleContextMenu(event: ContextMenuEvent) {
        // Force the component to disable current context menu.
        this.contextMenuEvent = null;
        this.contextMenuVisible = false;

        // Wait for the DOM to update with the above values and then show context menu again.
        this.$nextTick(() => {
            this.contextMenuEvent = event;
            this.contextMenuStyle.left = event.pagePos.x + 'px';
            this.contextMenuStyle.top = event.pagePos.y + 'px';
            this.contextMenuVisible = true;
        });
    }

    hideContextMenu() {
        this.contextMenuVisible = false;
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot);
    }

    constructor() {
        super();
    }

    @Watch('channelId')
    async channelIdChanged() {
        await appManager.setPrimarySimulation(
            `${this.dimension || '*'}/${this.channelId}`
        );
    }

    @Watch('dimension')
    async onDimensionChanged() {
        if (this._simulation.parsedId.dimension !== this.dimension) {
            await this._simulation.helper.transaction(
                goToDimension(this.dimension)
            );
        }
    }

    async created() {
        this.isLoading = true;
        await appManager.setPrimarySimulation(
            `${this.dimension || '*'}/${this.channelId}`
        );

        appManager.whileLoggedIn((user, botManager) => {
            let subs = [];
            this._simulation = appManager.simulationManager.primary;
            this.bots = [];
            this.tags = [];
            this.updateTime = -1;

            subs.push(
                this._simulation.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                    this.isDiff = e.isDiff;
                    const now = Date.now();
                    this.updateTime = now;
                })
            );

            subs.push(
                this._simulation.localEvents.subscribe(e => {
                    if (e.type === 'go_to_dimension') {
                        this._simulation.helper.updateBot(
                            this._simulation.helper.userBot,
                            {
                                tags: {
                                    auxPagePortal: e.dimension || false,
                                },
                            }
                        );
                    }
                })
            );

            this.isLoading = false;
            this._setStatus('Waiting for input...');
            return subs;
        });

        EventBus.$on('toggleSheetSize', this.toggleSheetSize);
    }

    destroyed() {}

    private _setStatus(status: string) {
        this.status = status;
        console.log('[BuilderHome] Status:', status);
    }
}
