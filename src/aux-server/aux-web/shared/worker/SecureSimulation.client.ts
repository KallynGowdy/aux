import {
    SecureSimulationClientInterface,
    SecureSimulationHostInterface,
    SecureSimulationEvent,
} from './SecureSimulationInterface';
import { Application } from 'jailed';
import { AsyncSimulationWrapper } from './AsyncSimulationWrapper';
import { FileManager } from '../FileManager';
import { Subject, Observable, SubscriptionLike } from 'rxjs';
import { map } from 'rxjs/operators';

declare var application: Application<
    SecureSimulationHostInterface,
    SecureSimulationClientInterface
>;

let wrapper: AsyncSimulationWrapper = null;
let obj: any = null;
let events: Subject<SecureSimulationEvent>;
let subs: SubscriptionLike[] = null;

const api: SecureSimulationClientInterface = {
    createInstance(user, id, config) {
        obj = wrapper = new AsyncSimulationWrapper(
            new FileManager(user, id, config)
        );
        events = new Subject();

        subs = [
            subscribeToEvent(
                wrapper.filePanelOpenChanged,
                'filePanelOpenChanged',
                events
            ),
            subscribeToEvent(
                wrapper.filePanelSearchUpdated,
                'filePanelSearchUpdated',
                events
            ),
            subscribeToEvent(
                wrapper.filePanelUpdated,
                'filePanelUpdated',
                events
            ),
            subscribeToEvent(
                wrapper.filesDiscovered,
                'filesDiscovered',
                events
            ),
            subscribeToEvent(wrapper.filesRemoved, 'filesRemoved', events),
            subscribeToEvent(wrapper.filesUpdated, 'filesUpdated', events),
            subscribeToEvent(wrapper.localEvents, 'localEvents', events),
            subscribeToEvent(wrapper.recentsUpdated, 'recentsUpdated', events),
            subscribeToEvent(
                wrapper.connectionStateChanged,
                'connectionStateChanged',
                events
            ),

            events.subscribe(e => {
                application.remote.event(e.name, e.data);
            }),
        ];
    },

    call: (cb, name, ...args) => {
        try {
            if (typeof obj[name] === 'function') {
                const result = obj[name](...args);
                if (result && typeof result.then === 'function') {
                    result.then(
                        (data: any) => cb(null, data),
                        (err: any) => cb(err)
                    );
                } else {
                    cb(null, result);
                }
            } else {
                const result = obj[name];
                cb(null, result);
            }
        } catch (ex) {
            cb(ex);
        }
    },
};

application.setInterface(api);

function subscribeToEvent(
    event: Observable<any>,
    name: string,
    subject: Subject<SecureSimulationEvent>
) {
    return event.pipe(map(x => ({ name: name, data: x }))).subscribe(subject);
}
