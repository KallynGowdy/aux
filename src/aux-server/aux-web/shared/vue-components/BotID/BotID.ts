import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import { AuxBot, Bot } from '@casual-simulation/aux-common';
import { copyToClipboard } from '../../SharedUtils';

@Component({
    components: {},
})
export default class BotID extends Vue {
    @Prop() tag: string;

    /**
     * Whether the tag is allowed to be dragged from the bot table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    @Prop()
    shortID: string;

    @Prop()
    bots: AuxBot;

    constructor() {
        super();
    }

    copyID() {
        copyToClipboard(this.bots.id);
    }
}
