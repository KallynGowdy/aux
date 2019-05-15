declare module 'jailed' {
    interface PluginBase<TAPI> {
        remote: TAPI;
        whenConnected(callback: Function): void;
    }

    class Plugin<THost, TClient> implements PluginBase<TClient> {
        constructor(path: string, api: THost);
        remote: TClient;
        whenConnected(callback: Function): void;
    }

    class DynamicPlugin<THost, TClient> implements PluginBase<TClient> {
        constructor(code: string, api: THost);
        remote: TClient;
        whenConnected(callback: Function): void;
    }

    interface Application<THost, TClient> {
        remote: THost;
        setInterface(api: TClient): void;
    }
}
