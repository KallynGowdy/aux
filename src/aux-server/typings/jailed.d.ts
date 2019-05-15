declare module 'jailed' {
    interface PluginBase<TAPI> {
        remote: TAPI;
    }

    class Plugin<THost, TClient> implements PluginBase<TClient> {
        constructor(path: string, api: THost);
        remote: TClient;
    }

    class DynamicPlugin<THost, TClient> implements PluginBase<TClient> {
        constructor(code: string, api: THost);
        remote: TClient;
    }

    interface Application<THost, TClient> {
        remote: THost;
        setInterface(api: TClient): void;
    }
}
