import {
    LocalActions,
    auxCausalTreeFactory,
    AuxCausalTree,
    GLOBALS_BOT_ID,
    tagsOnBot,
    parseFilterTag,
    ON_ACTION_ACTION_NAME,
    BotTags,
} from '@casual-simulation/aux-common';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    AuxConfig,
    BaseAuxChannel,
    AuxUser,
    AuxChannelOptions,
} from '@casual-simulation/aux-vm';
import {
    SyncedRealtimeCausalTree,
    RemoteAction,
    RealtimeCausalTreeOptions,
} from '@casual-simulation/causal-trees';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import { CausalTreeStore } from '@casual-simulation/causal-trees';

export interface RemoteAuxChannelOptions extends AuxChannelOptions {
    store?: CausalTreeStore;
    crypto?: SigningCryptoImpl;
}

export class RemoteAuxChannel extends BaseAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;

    protected get aux(): SyncedRealtimeCausalTree<AuxCausalTree> {
        return <SyncedRealtimeCausalTree<AuxCausalTree>>this._aux;
    }

    constructor(
        defaultHost: string,
        user: AuxUser,
        config: AuxConfig,
        options: RemoteAuxChannelOptions
    ) {
        super(user, config, options);
        let url = new URL(defaultHost);
        this._socketManager = new SocketManager(
            config.host ? `${url.protocol}//${config.host}` : defaultHost
        );
        this._treeManager = new CausalTreeManager(
            this._socketManager,
            auxCausalTreeFactory(),
            options.store,
            options.crypto
        );
    }

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        const aux = this.aux;
        await aux.channel.connection.sendEvents(events);
    }

    async setUser(user: AuxUser): Promise<void> {
        const aux = this.aux;
        aux.channel.setUser(user);
        await super.setUser(user);
    }

    async setGrant(grant: string): Promise<void> {
        const aux = this.aux;
        aux.channel.setGrant(grant);
    }

    async forkAux(newId: string) {
        console.log('[RemoteAuxChannel] Forking AUX');
        const aux = await this._treeManager.forkTree(this.aux, newId);

        const globals = aux.tree.value[GLOBALS_BOT_ID];
        if (globals) {
            console.log('[RemoteAuxChannel] Cleaning Config bot.');
            let badTags = tagsOnBot(globals).filter(tag => {
                let parsed = parseFilterTag(tag);
                return (
                    parsed.success && parsed.eventName === ON_ACTION_ACTION_NAME
                );
            });
            let tags: BotTags = {};
            for (let tag of badTags) {
                console.log(`[RemoteAuxChannel] Removing ${tag} tag.`);
                console.log('');
                tags[tag] = null;
            }

            await aux.tree.updateBot(globals, {
                tags: tags,
            });
        }
        console.log('[RemoteAuxChannel] Finished');
    }

    protected async _createRealtimeCausalTree(
        options: RealtimeCausalTreeOptions
    ) {
        await this._socketManager.init();
        await this._treeManager.init();
        const tree = await this._treeManager.getTree<AuxCausalTree>(
            {
                id: this._config.treeName,
                type: 'aux',
            },
            this.user,
            {
                ...options,
                garbageCollect: true,

                // TODO: Allow reusing site IDs without causing multiple tabs to try and
                //       be the same site.
                alwaysRequestNewSiteId: true,
            }
        );

        return tree;
    }

    protected _handleError(error: any) {
        if (error instanceof Error) {
            super._handleError({
                type: 'general',
                message: error.toString(),
            });
        } else {
            super._handleError(error);
        }
    }

    protected _handleLocalEvents(e: LocalActions[]) {
        for (let event of e) {
            if (event.type === 'set_offline_state') {
                this._socketManager.forcedOffline = event.offline;
            }
        }
        super._handleLocalEvents(e);
    }
}
