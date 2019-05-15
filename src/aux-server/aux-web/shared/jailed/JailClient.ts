import { Application } from 'jailed';
import { JailedClientAPI, JailedClientObservable } from './JailClientAPI';
import { get, invoke } from 'lodash';
import { Observable, SubscriptionLike } from 'rxjs';
import uuid from 'uuid/v4';

export function setupAPI(
    application: Application<any, JailedClientAPI>,
    target: any
) {
    let subs: {
        [key: string]: SubscriptionLike;
    } = {};

    application.setInterface({
        call: (cb, name, args) => {
            try {
                const value = get(target, name);
                if (typeof value === 'function') {
                    // Handle function calls
                    const result = invoke(target, name);
                    if (result && typeof result.then === 'function') {
                        // Handle async/promises
                        result.then(
                            (data: any) => cb(null, data),
                            (err: any) => cb(err)
                        );
                    } else {
                        returnValue(cb, name, result);
                    }
                } else {
                    returnValue(cb, name, value);
                }
            } catch (ex) {
                // Handle errors
                cb(ex);
            }
        },
        subscribe: (cb, ref, onNext) => {
            try {
                const observable: Observable<any> = get(target, ref.path);

                if (observable) {
                    const sub = observable.subscribe(val => onNext(val));
                    let key = uuid();
                    subs[key] = sub;
                    cb(null, <JailedClientObservable>{
                        $ref: true,
                        path: key,
                    });
                } else {
                    cb();
                }
            } catch (ex) {
                cb(ex);
            }
        },
        unsubscribe: (cb, ref) => {
            try {
                const sub = subs[ref.path];
                if (sub) {
                    sub.unsubscribe();
                    delete subs[ref.path];
                }
                cb();
            } catch (ex) {
                cb(ex);
            }
        },
    });
}

function returnValue(cb: Function, name: string, value: any) {
    if (value && typeof value.subscribe === 'function') {
        // Handle observables by returning a reference
        cb(null, <JailedClientObservable>{
            $ref: true,
            path: name,
        });
    } else {
        cb(null, value);
    }
}
