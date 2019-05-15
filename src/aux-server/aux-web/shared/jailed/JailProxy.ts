import { Plugin } from 'jailed';
import { JailedClientAPI } from './JailClientAPI';
import { Observable, Observer } from 'rxjs';

type FunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? K : never
}[keyof T];
type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>;

export function createJail<T>(script: string): FunctionProperties<T> {
    const jail = new Plugin<any, JailedClientAPI>(script, {});

    return <any>new Proxy(jail, {
        get(obj, prop) {
            return function() {
                return new Promise<any>((resolve, reject) => {
                    obj.remote.call(
                        (err, val) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            if (val.$ref === true) {
                                resolve(
                                    Observable.create(
                                        (observer: Observer<any>) => {
                                            let subRef: any = null;
                                            let unsubbbed = false;
                                            obj.remote.subscribe(
                                                (err, s) => {
                                                    if (unsubbbed) {
                                                        obj.remote.unsubscribe(
                                                            () => {},
                                                            s
                                                        );
                                                    }
                                                    subRef = s;
                                                },
                                                val,
                                                (value: any) =>
                                                    observer.next(value)
                                            );

                                            return () => {
                                                unsubbbed = true;
                                                if (subRef) {
                                                    obj.remote.unsubscribe(
                                                        () => {},
                                                        subRef
                                                    );
                                                }
                                            };
                                        }
                                    )
                                );
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
}
