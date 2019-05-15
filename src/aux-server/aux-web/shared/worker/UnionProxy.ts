export function union<T, T2>(target: T, other: T2): T & T2 {
    return <any>new Proxy(<any>target, {
        get(obj, prop) {
            const val = obj[prop];

            if (typeof val === 'undefined') {
                return (<any>other)[prop];
            }

            return val;
        },
    });
}
