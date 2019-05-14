import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch } from 'vue-property-decorator';
import { EventBus } from '../../shared/EventBus';
import {
    AuxObject,
    getShortId,
    formatValue,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';

@Component({
    components: {},
})
export default class FileSearch extends Vue {
    isOpen: boolean = false;
    files: AuxObject[] = [];
    search: string = '';

    async toggleOpen() {
        await appManager.simulationManager.primary.toggleFilePanelOpen();
    }

    @Watch('search')
    async onSearchChanged() {
        await appManager.simulationManager.primary.setSearch(this.search);
    }

    get placeholder() {
        if (this.files.length > 0) {
            return formatValue(this.files);
        } else {
            return 'Search';
        }
    }

    constructor() {
        super();
    }

    mounted() {
        appManager.whileLoggedIn((user, fileManager) => {
            let subs: SubscriptionLike[] = [];
            subs.push(
                fileManager.filePanelUpdated.subscribe(e => {
                    this.files = e.files;
                }),
                fileManager.filePanelOpenChanged.subscribe(open => {
                    this.isOpen = open;
                }),
                fileManager.filePanelSearchUpdated.subscribe(search => {
                    this.search = search;
                })
            );
            return subs;
        });
    }
}
