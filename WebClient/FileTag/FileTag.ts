import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { isFilterTag, parseFilterTag } from 'common/Files/FileCalculations';


@Component({
})
export default class FileTag extends Vue {
    @Prop() tag: string;

    get filterData() {
        return parseFilterTag(this.tag);
    }

    get isFilter() {
        return isFilterTag(this.tag);
    }

    get isCombine() {
        if (this.isFilter) {
            const data = this.filterData;
            return data.eventName === '+';
        } else {
            return false;
        }
    }

    constructor() {
        super();
    }
};