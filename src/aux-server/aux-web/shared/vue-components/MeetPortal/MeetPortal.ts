import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    MEET_PORTAL,
    PrecalculatedBot,
    calculateBotValue,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { SubscriptionLike, Subscription, Observable } from 'rxjs';
import JitsiMeet from '../JitsiMeet/JitsiMeet';
import { Simulation } from '@casual-simulation/aux-vm';
import { tap } from 'rxjs/operators';
import {
    BotManager,
    watchPortalConfigBot,
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';

@Component({
    components: {
        'jitsi-meet': JitsiMeet,
    },
})
export default class MeetPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<Simulation, Subscription> = new Map();
    private _portals: Map<Simulation, string> = new Map();

    private _currentSim: Simulation;

    currentMeet: string = null;
    get hasPortal(): boolean {
        return hasValue(this.currentMeet);
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            userBotChanged(sim)
                .pipe(tap(user => this._onUserBotUpdated(sim, user)))
                .subscribe()
        );
        sub.add(
            watchPortalConfigBot(sim, MEET_PORTAL)
                .pipe(
                    tap(bot => {
                        // TODO: Update options
                    })
                )
                .subscribe()
        );
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        this._portals.delete(sim);
        this._updateCurrentPortal();
    }

    private _onUserBotUpdated(sim: BrowserSimulation, user: PrecalculatedBot) {
        const portal = calculateBotValue(null, user, MEET_PORTAL);
        if (hasValue(portal)) {
            this._portals.set(sim, portal);
        } else {
            this._portals.delete(sim);
        }
        this._updateCurrentPortal();
    }

    /**
     * Updates the current simulation and portal.
     */
    private _updateCurrentPortal() {
        // If the current sim still exists, then keep it.
        if (this._currentSim && this._portals.has(this._currentSim)) {
            return;
        }

        // Use the first meet
        this._currentSim = null;
        this.currentMeet = null;
        for (let [sim, meet] of this._portals) {
            this._currentSim = sim;
            this.currentMeet = meet;
            break;
        }
    }
}