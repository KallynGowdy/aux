import {
    CasualOSFileSystemProvider,
    IdePortalSimulation,
    parseUri,
} from './CasualOSFileSystemProvider';
import { nodeSimulationWithConfig } from '@casual-simulation/aux-vm-node';
import { createBot } from '@casual-simulation/aux-common';
import { IdePortalManager } from '@casual-simulation/aux-vm-browser/managers/IdePortalManager';
import { waitForSync } from '@casual-simulation/aux-vm';
import * as vscode from 'vscode';

const logMock = (console.log = jest.fn());

describe('parseUri()', () => {
    it('should return a null bot ID and tag when the URI has the wrong scheme', () => {
        const { botId, tag } = parseUri(uri('wrong', '/tag/uuid.js'));

        expect(botId).toBe(null);
        expect(tag).toBe(null);
    });

    it('should return a null bot ID and tag when the URI does not have a bot or tag', () => {
        const { botId, tag } = parseUri(uri('casualos', '/'));

        expect(botId).toBe(null);
        expect(tag).toBe(null);
    });

    it('should return a the bot ID in the URI', () => {
        const { botId, tag } = parseUri(uri('casualos', '/tag.js'));

        expect(tag).toBe('tag');
        expect(botId).toBe(null);
    });

    it('should return a the bot ID and tag in the URI', () => {
        const { botId, tag } = parseUri(uri('casualos', '/tag/uuid.js'));

        expect(tag).toBe('tag');
        expect(botId).toBe('uuid');
    });
});

describe('CasualOSFileSystemProvider', () => {
    let simulation: IdePortalSimulation;
    let provider: CasualOSFileSystemProvider;

    beforeEach(async () => {
        simulation = <IdePortalSimulation>(<unknown>nodeSimulationWithConfig(
            {
                id: 'user',
                name: 'user',
                token: 'token',
                username: 'username',
            },
            'test-server',
            {
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        initialState: {
                            test1: createBot('test1', {
                                script: '🔺abc',
                                notScript: '123',
                                duplicate: '🔺qqq',
                            }),
                            test2: createBot('test2', {
                                script2: '🔺def',
                                notScript2: '456',
                                duplicate: '🔺eee',
                            }),
                            test3: createBot('test3', {
                                script3: '🔺ghi',
                                notScript3: '789',
                                duplicate: '🔺fff',
                            }),
                            user: createBot('user', {
                                idePortal: '🔺',
                            }),
                        },
                    },
                },
            }
        ));
        simulation.helper.userId = 'user';

        await simulation.init();
        await waitForSync(simulation);

        simulation.idePortal = new IdePortalManager(
            simulation.watcher,
            simulation.helper,
            false
        );

        provider = new CasualOSFileSystemProvider(simulation);
    });

    afterEach(() => {
        simulation.unsubscribe();
    });

    describe('stat()', () => {
        it('should return a directory for the root file', () => {
            const file = provider.stat(uri('casualos', '/'));

            expect(file).toEqual({
                type: vscode.FileType.Directory,
                mtime: expect.any(Number),
                ctime: expect.any(Number),
                size: undefined,
            });
        });

        it('should return a file for full tag paths', () => {
            const file = provider.stat(uri('casualos', '/script/test1.js'));

            expect(file).toEqual({
                type: vscode.FileType.File,
                mtime: expect.any(Number),
                ctime: expect.any(Number),
                size: simulation.helper.botsState['test1'].tags.script.length,
            });
        });

        it('should return a file for unique tags', () => {
            const file = provider.stat(uri('casualos', '/script.js'));

            expect(file).toEqual({
                type: vscode.FileType.File,
                mtime: expect.any(Number),
                ctime: expect.any(Number),
                size: simulation.helper.botsState['test1'].tags.script.length,
            });
        });

        it('should return a directory for non unique tags', () => {
            const file = provider.stat(uri('casualos', '/duplicate'));

            expect(file).toEqual({
                type: vscode.FileType.Directory,
                mtime: expect.any(Number),
                ctime: expect.any(Number),
                size: undefined,
            });
        });
    });

    describe('readDirectory()', () => {
        it('should return the list of unique and non unique tags for the root directory', () => {
            const list = provider.readDirectory(uri('casualos', '/'));

            expect(list).toEqual([
                ['duplicate', vscode.FileType.Directory],
                ['script.js', vscode.FileType.File],
                ['script2.js', vscode.FileType.File],
                ['script3.js', vscode.FileType.File],
            ]);
        });

        it('should return the list of bot IDs for a tag directory', () => {
            const list = provider.readDirectory(uri('casualos', '/duplicate'));

            expect(list).toEqual([
                ['test1.js', vscode.FileType.File],
                ['test2.js', vscode.FileType.File],
                ['test3.js', vscode.FileType.File],
            ]);
        });

        it('should throw an error if the URI points to a tag that does not have duplicates', () => {
            expect(() => {
                provider.readDirectory(uri('casualos', '/script.js'));
            }).toThrow();
        });
    });

    describe('readFile()', () => {
        let decoder: TextDecoder;

        beforeEach(() => {
            decoder = new TextDecoder();
        });

        it('should return the script for the value', async () => {
            const script = await provider.readFile(
                uri('casualos', '/script.js')
            );

            expect(script instanceof Uint8Array).toBe(true);
            expect(decoder.decode(script)).toEqual('abc');
        });

        it('should return the script for the full tag path', async () => {
            const script = await provider.readFile(
                uri('casualos', '/script/test1.js')
            );

            expect(script instanceof Uint8Array).toBe(true);
            expect(decoder.decode(script)).toEqual('abc');
        });

        it('should be able to get scripts in a list of duplicates', async () => {
            const script = await provider.readFile(
                uri('casualos', '/duplicate/test1.js')
            );

            expect(script instanceof Uint8Array).toBe(true);
            expect(decoder.decode(script)).toEqual('qqq');
        });

        it('should throw an error if trying to read a tag directory', () => {
            expect(() => {
                provider.readFile(uri('casualos', '/duplicate'));
            }).toThrow();
        });
    });
});

function uri(scheme: string, path: string) {
    return {
        scheme,
        path,
        authority: '',
        fragment: '',
        query: '',
        fsPath: null as any,
        toJSON: null as any,
        toString: null as any,
        with: null as any,
    } as const;
}
