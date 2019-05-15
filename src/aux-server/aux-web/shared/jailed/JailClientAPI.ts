export interface JailedClientAPI {
    /**
     * Calls the function with the given name and arguments.
     * @param cb The callback that contains the result of the function call.
     * @param name The name of the function to call.
     * @param args The arguments to include.
     */
    call(
        cb: (err?: any, value?: any) => void,
        name: string,
        ...args: any[]
    ): void;

    subscribe(
        cb: (err?: any, value?: any) => void,
        ref: JailedClientObservable,
        onValue: Function
    ): void;
    unsubscribe(
        cb: (err?: any, value?: any) => void,
        ref: JailedClientObservable
    ): void;
}

/**
 * Defines a reference to an observable that can be subscribed to.
 */
export interface JailedClientObservable {
    $ref: true;
    path: string;
}
