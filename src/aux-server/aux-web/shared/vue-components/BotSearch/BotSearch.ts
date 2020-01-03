import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch, Provide } from 'vue-property-decorator';
import {
    Bot,
    getShortId,
    formatValue,
    tagsOnBot,
    hasValue,
    runScript,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { SubscriptionLike } from 'rxjs';
import MiniBot from '../MiniBot/MiniBot';
import { BotRenderer, getRenderer } from '../../scene/BotRenderer';
import Cube from '../../public/icons/Cube.svg';
import CubeSearch from '../../public/icons/CubeSearch.svg';

@Component({
    components: {
        'mini-bot': MiniBot,
        'cube-icon': Cube,
        'cubeSearch-icon': CubeSearch,
    },
})
export default class BotSearch extends Vue {
    isOpen: boolean = false;
    bots: Bot[] = [];
    recentBot: Bot = null;
    search: string = '';

    @Prop({ default: null }) prefill: string;

    @Provide() botRenderer: BotRenderer = getRenderer();

    toggleOpen() {
        appManager.simulationManager.primary.botPanel.toggleOpen();
    }

    async executeSearch() {
        await appManager.simulationManager.primary.helper.transaction(
            runScript(this.search)
        );
    }

    setPrefill(prefill: string) {
        if (!prefill) {
            return;
        }
        if (!hasValue(this.search)) {
            this.search = prefill;
        }
    }

    get placeholder() {
        if (this.bots.length > 0) {
            if (this.hasRealBots) {
                let val = formatValue(this.bots);
                if (val.length > 50) {
                    val = val.substring(0, 50) + '..';
                }
                return val;
            } else {
                return 'Run';
            }
        } else {
            return 'Run';
        }
    }

    get hasRealBots() {
        return (
            this.bots.length > 0 && !this.bots.every(f => this.isEmptyOrDiff(f))
        );
    }

    constructor() {
        super();
    }

    get botsLength() {
        let num = 0;
        let temp = this.bots.length;
        if (temp !== 1) {
            num = this.bots.length;
        } else {
            if (this.isEmptyOrDiff(this.bots[0])) {
                num = 0;
            } else {
                num = 1;
            }
        }

        return num;
    }

    uiHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.botQueue];
    }

    mounted() {
        appManager.whileLoggedIn((user, botManager) => {
            this.recentBot = botManager.recent.bot;

            let subs: SubscriptionLike[] = [];
            subs.push(
                botManager.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                }),
                botManager.botPanel.isOpenChanged.subscribe(open => {
                    this.isOpen = open;
                }),
                botManager.botPanel.searchUpdated.subscribe(search => {
                    this.search = search;
                }),
                botManager.recent.onUpdated.subscribe(() => {
                    this.recentBot = botManager.recent.bot;
                })
                // botManager.selection.userChangedSelection
            );
            return subs;
        });

        this.setPrefill(this.prefill);
    }

    isEmptyOrDiff(f: Bot): boolean {
        return tagsOnBot(f).length === 0 || f.id === 'mod';
    }

    startSearch() {
        const search = <Vue>this.$refs.searchInput;
        if (search) {
            search.$el.focus();
        }
    }
}
