import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Bot,
    BotCalculationContext,
    calculateFormattedBotValue,
    calculateBotValue,
    isFormula,
    BotLabelAlignment,
    getBotLabelAlignment,
    CLICK_ACTION_NAME,
    onClickArg,
    ANY_CLICK_ACTION_NAME,
    onAnyClickArg,
    hasValue,
    getBotScale,
    calculateStringTagValue,
    calculateNumericalTagValue,
    clamp,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { DimensionItem } from '../DimensionItem';
import { first } from '@casual-simulation/causal-trees';
import { safeParseURL } from '../PlayerUtils';
import PieProgress from '../../shared/vue-components/PieProgress/PieProgress';

@Component({
    components: {
        'pie-progress': PieProgress,
    },
})
export default class MenuBot extends Vue {
    @Prop() item: DimensionItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    labelColor: string = '#000';
    labelAlign: BotLabelAlignment = 'center';
    backgroundColor: string = '#FFF';
    scaleY: number = 1;
    extraStyle: Object = {};
    icon: string = null;
    iconIsURL: boolean = false;
    progress: number = null;
    progressBarForeground: string = null;
    progressBarBackground: string = null;

    get hasProgress() {
        return hasValue(this.progress);
    }

    get hasIcon() {
        return hasValue(this.icon);
    }

    get style(): any {
        return {
            ...this.extraStyle,
            'background-color': this.backgroundColor,
            height: this.scaleY * 40 + 'px',
        };
    }

    @Watch('item')
    private async _botChanged(item: DimensionItem) {
        if (item) {
            const simulation = _simulation(item);
            const calc = simulation.helper.createContext();
            this._updateLabel(calc, item.bot);
            this._updateColor(calc, item.bot);
            this._updateAlignment(calc, item.bot);
            this._updateScale(calc, item.bot);
            this._updateStyle(calc, item.bot);
            this._updateIcon(calc, item.bot);
            this._updateProgress(calc, item.bot);
        } else {
            this.label = '';
            this.labelColor = '#000';
            this.backgroundColor = '#FFF';
            this.scaleY = 1;
            this.extraStyle = {};
            this.icon = null;
            this.iconIsURL = false;
            this.progress = null;
        }
    }

    constructor() {
        super();
    }

    mounted() {
        this._botChanged(this.item);
    }

    async click() {
        const simulation = _simulation(this.item);
        const dimension = first(this.item.dimensions.values());
        simulation.helper.action(
            CLICK_ACTION_NAME,
            [this.item.bot],
            onClickArg(null, dimension)
        );
        simulation.helper.action(
            ANY_CLICK_ACTION_NAME,
            null,
            onAnyClickArg(null, dimension, this.item.bot)
        );
    }

    private _updateColor(calc: BotCalculationContext, bot: Bot) {
        this.backgroundColor = calculateBotValue(calc, bot, 'auxColor');
        if (!hasValue(this.backgroundColor)) {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: BotCalculationContext, bot: Bot) {
        this.label = calculateFormattedBotValue(calc, bot, 'auxLabel');
        if (hasValue(this.label)) {
            this.labelColor = calculateFormattedBotValue(
                calc,
                bot,
                'auxLabelColor'
            );
            if (!hasValue(this.labelColor)) {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }

    private _updateAlignment(calc: BotCalculationContext, bot: Bot) {
        this.labelAlign = getBotLabelAlignment(calc, bot);
    }

    private _updateScale(calc: BotCalculationContext, bot: Bot) {
        const scale = getBotScale(calc, bot, 1);
        this.scaleY = scale.y;
    }

    private _updateStyle(calc: BotCalculationContext, bot: Bot) {
        let style = calculateBotValue(calc, bot, 'menuItemStyle');
        if (typeof style !== 'object') {
            style = null;
        }
        this.extraStyle = style || {};
    }

    private _updateIcon(calc: BotCalculationContext, bot: Bot) {
        const icon = calculateStringTagValue(calc, bot, 'auxFormAddress', null);
        this.icon = icon;
        this.iconIsURL = !!safeParseURL(icon);
    }

    private _updateProgress(calc: BotCalculationContext, bot: Bot) {
        let progress = calculateNumericalTagValue(
            calc,
            bot,
            'auxProgressBar',
            null
        );

        this.progress = hasValue(progress) ? clamp(progress, 0, 1) : null;

        let colorTagValue: any = calculateBotValue(
            calc,
            bot,
            'auxProgressBarColor'
        );
        let bgColorTagValue: any = calculateBotValue(
            calc,
            bot,
            'auxProgressBarBackgroundColor'
        );

        this.progressBarForeground = hasValue(colorTagValue)
            ? colorTagValue
            : '#000';
        this.progressBarBackground = hasValue(bgColorTagValue)
            ? bgColorTagValue
            : '#fff';
    }
}

function _simulation(item: any) {
    return appManager.simulationManager.simulations.get(item.simulationId);
}
