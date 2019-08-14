import { NodeAuxChannel } from './NodeAuxChannel';
import { AuxCausalTree, GLOBALS_FILE_ID } from '@casual-simulation/aux-common';
import {
    storedTree,
    site,
    ADMIN_ROLE,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';

let logMock = (console.log = jest.fn());

describe('NodeAuxChannel', () => {
    let tree: AuxCausalTree;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();
    });

    function createChannel(id: string) {
        return new NodeAuxChannel(
            tree,
            {
                id: 'server',
                isGuest: false,
                name: 'Server',
                token: 'token',
                username: 'server',
            },
            {
                claims: {
                    [USERNAME_CLAIM]: 'server',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [SERVER_ROLE],
            },
            {
                config: { isBuilder: false, isPlayer: false },
                host: 'any',
                id: id,
                treeName: id,
            }
        );
    }

    it('should create the globals file with aux.whitelist.roles set to admin if the channel is the admin channel', async () => {
        const channel = createChannel('aux-admin');

        await channel.initAndWait();

        const globals = channel.helper.filesState[GLOBALS_FILE_ID];
        expect(globals.tags['aux.whitelist.roles']).toEqual([ADMIN_ROLE]);
    });

    // describe('say_hello', () => {
    //     it('should print "hello" to the console', async () => {
    //         const channel = createChannel('aux-admin');

    //         await channel.initAndWait();

    //         await channel.sendEvents([sayHello('abc')]);

    //         expect(logMock).toBeCalledWith('User abc says "Hello!"');
    //     });
    // });
});