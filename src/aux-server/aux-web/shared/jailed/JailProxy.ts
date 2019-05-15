import { Plugin } from 'jailed';
import { JailedClientAPI, JailedClientObservable } from './JailClientAPI';
import { Observable, Observer } from 'rxjs';
import { JailedHostAPI } from './JailHostAPI';

type FunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? K : never
}[keyof T];

type ObservablePropertyNames<T> = {
    [K in keyof T]: T[K] extends Observable<any> ? K : never
}[keyof T];

// type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>;
// type ObservableProperties<T> = Pick<T, ObservablePropertyNames<T>>;
type FunctionObservableProperties<T> = Pick<
    T,
    FunctionPropertyNames<T> | ObservablePropertyNames<T>
>;

export function createJail<T>(
    script: string
): Promise<FunctionObservableProperties<T>> {
    return new Promise(resolve => {
        let observables: string[] = [];
        const jail = new Plugin<JailedHostAPI, JailedClientAPI>(script, {
            setObservablePropertyNames(props) {
                observables = props;
            },
        });

        jail.whenConnected(() => {
            const proxy = <any>new Proxy(jail, {
                get(obj, prop: string) {
                    const index = observables.indexOf(prop);
                    if (index >= 0) {
                        return createObservable(obj, {
                            $ref: true,
                            path: prop,
                        });
                    }

                    return function() {
                        return new Promise<any>((resolve, reject) => {
                            obj.remote.call(
                                (err, val) => {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }

                                    if (val.$ref === true) {
                                        resolve(createObservable(obj, val));
                                    }

                                    resolve(val);
                                },
                                <any>prop,
                                ...arguments
                            );
                        });
                    };
                },
            });

            resolve(proxy);
        });
    });
}

function createObservable(
    obj: Plugin<JailedHostAPI, JailedClientAPI>,
    ref: JailedClientObservable
): Observable<any> {
    return Observable.create((observer: Observer<any>) => {
        let subRef: any = null;
        let unsubbbed = false;
        obj.remote.subscribe(
            (err, s) => {
                if (unsubbbed) {
                    obj.remote.unsubscribe(() => {}, s);
                }
                subRef = s;
            },
            ref,
            (value: any) => observer.next(value)
        );
        return () => {
            unsubbbed = true;
            if (subRef) {
                obj.remote.unsubscribe(() => {}, subRef);
            }
        };
    });
}
