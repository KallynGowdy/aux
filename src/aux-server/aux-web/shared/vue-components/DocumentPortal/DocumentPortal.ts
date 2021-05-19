import { Bot } from '@casual-simulation/aux-common';
import { BotDimensionsUpdate, Simulation } from '@casual-simulation/aux-vm';
import { appManager } from 'aux-web/shared/AppManager';
import { DocumentNode, DocumentPortal } from '../../DocumentPortal';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import Vue from 'vue';
import Component from 'vue-class-component';

@Component({})
export default class DocumentPortalComponent extends Vue {
    nodes: DocumentNode[];

    private _simulation: Simulation;

    async created() {
        this.nodes = [];
        appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;

            let subs = [] as SubscriptionLike[];

            let documentPortal = new DocumentPortal(
                appManager.simulationManager,
                ['documentPortal']
            );

            subs.push(
                documentPortal.itemsUpdated.subscribe((items) => {
                    this.nodes = items;
                })
            );

            return subs;
        });
    }

    private _updateDocumentDimensions(
        sim: Simulation,
        update: BotDimensionsUpdate
    ): void {
        for (let event of update.events) {
        }
    }
}
