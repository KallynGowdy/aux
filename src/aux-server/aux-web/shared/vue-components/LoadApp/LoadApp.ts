import Vue from 'vue';
import { appManager } from '../../AppManager';
import Component from 'vue-class-component';
import Loading from '../Loading/Loading';
import { ProgressMessage } from '@casual-simulation/causal-trees';
import { switchMap, tap } from 'rxjs/operators';
import Console from '../Console/Console';
import { messages } from '../../Console';
import { fromEvent } from 'rxjs';

@Component({
    components: {
        loading: Loading,
        console: Console,
    },
})
export default class LoadApp extends Vue {
    loading: boolean;
    loadingState: ProgressMessage = null;
    showConsole: boolean;

    clickCount: number;

    constructor() {
        super();
        this.loading = true;
    }

    created() {
        this.loading = true;
        this.showConsole = false;
        this.clickCount = 0;
        this.loadingState = {
            type: 'progress',
            message: 'Starting...',
            progress: 0,
        };

        // Track the console messages while loading.
        const sub = messages.subscribe();

        const clickSub = fromEvent(window, 'click')
            .pipe(tap(() => this.click()))
            .subscribe();

        appManager.loadingProgress
            .pipe(
                tap((state) => {
                    if (state && state.error) {
                        this.loadingState = null;
                    } else {
                        this.loadingState = state;
                    }
                })
            )
            .subscribe();

        appManager.init().then(
            () => {
                sub.unsubscribe();
                clickSub.unsubscribe();
                this.loading = false;
            },
            (err) => {
                console.error('[LoadApp] Loading errored:', err);
                this.loading = false;
            }
        );
    }

    dismissLoading() {
        this.loadingState = null;
    }

    closeConsole() {
        this.showConsole = false;
    }

    click() {
        this.clickCount += 1;
        if (this.clickCount >= 10) {
            this.showConsole = true;
        }
    }
}
