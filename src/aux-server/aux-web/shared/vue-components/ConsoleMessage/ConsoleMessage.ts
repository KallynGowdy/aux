import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { messages } from '../../Console';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Prop } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class ConsoleMessage extends Vue {
    @Prop() message: ConsoleMessages;

    get type() {
        return this.message.type;
    }

    get messages() {
        return this.message.messages;
    }

    constructor() {
        super();
    }

    mounted() {
        this.$el.scrollIntoView(false);
    }
}
