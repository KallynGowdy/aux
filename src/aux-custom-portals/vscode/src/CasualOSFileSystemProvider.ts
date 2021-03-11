import {
    calculateBotValue,
    calculateStringTagValue,
    getTagValueForSpace,
    tagsOnBot,
    trimPrefixedScript,
} from '@casual-simulation/aux-common/bots/BotCalculations';
import type { Bot } from '@casual-simulation/aux-common';
import type { Simulation } from '@casual-simulation/aux-vm';
import * as vscode from 'vscode';
import { flatMap } from 'lodash';
import {
    IdePortalManager,
    IdeTagNode,
} from '@casual-simulation/aux-vm-browser/managers/IdePortalManager';

// Aux URIs have a pretty simple format:
//  casualos://232ae423-e01b-4c7e-8d7d-c36716f5ae4d/myTag.js
// | scheme | |                id                 || tag |

export function parseUri(
    uri: vscode.Uri
): {
    botId?: string;
    tag?: string;
} {
    if (uri.scheme !== 'casualos') {
        return {
            botId: null,
            tag: null,
        };
    }
    const path = uri.path;
    const extensionIndex = path.lastIndexOf('.');
    const trimmedPath = path.startsWith('/')
        ? path.slice(1, extensionIndex < 0 ? undefined : extensionIndex)
        : path;
    const [tag, botId] = trimmedPath.split('/');
    return {
        botId: !botId ? null : botId,
        tag: !tag ? null : tag,
    };
}

export class File implements vscode.FileStat {
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;
    sha: string;
    data?: Uint8Array;
    botId: string;
    tag: string;

    constructor(botId: string, tag: string, options?: any) {
        this.type = !!tag ? vscode.FileType.File : vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.botId = botId;
        this.tag = tag;
    }
}

export type IdePortalSimulation = Simulation & {
    idePortal: IdePortalManager;
};

export class CasualOSFileSystemProvider implements vscode.FileSystemProvider {
    private _simulation: IdePortalSimulation;
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _rootFile: vscode.FileStat = {
        type: vscode.FileType.Directory,
        ctime: Date.now(),
        mtime: Date.now(),
        size: undefined,
    };
    private _fileStats = new Map<string, vscode.FileStat>();
    private _itemsByTag = new Map<string, IdeTagNode[]>();
    private _tagStats = new Map<string, vscode.FileStat>();
    private _encoder = new TextEncoder();

    constructor(sim: IdePortalSimulation) {
        this._simulation = sim;

        this._simulation.idePortal.itemsAdded.subscribe((items) => {
            for (let item of items) {
                if (item.type === 'tag') {
                    const bot = this._simulation.helper.botsState[item.botId];
                    this._fileStats.set(item.path, this._getItemStat(item));

                    let list = this._itemsByTag.get(item.tag);
                    if (!list) {
                        list = [];
                        this._itemsByTag.set(item.tag, list);
                    }
                    list.push(item);
                }
            }
        });
        this._simulation.idePortal.itemsUpdated.subscribe((items) => {});
        this._simulation.idePortal.itemsRemoved.subscribe((items) => {
            for (let item of items) {
                if (item.type === 'tag') {
                    this._fileStats.delete(item.path);
                    let list = this._itemsByTag.get(item.tag);
                    if (list) {
                        const index = list.indexOf(item);
                        if (index >= 0) {
                            list.splice(index, 1);
                        }
                    }
                }
            }
        });
    }

    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
        return this._emitter.event;
    }

    watch(
        uri: vscode.Uri,
        options: { recursive: boolean; excludes: string[] }
    ): vscode.Disposable {
        console.log('watch', uri, options);
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        console.log('stat', uri);

        if (uri.path === '/') {
            return this._rootFile;
        }

        const fileStat = this._fileStats.get(uri.path);

        if (fileStat) {
            return fileStat;
        }

        const { tag, botId } = parseUri(uri);

        if (tag) {
            const list = this._itemsByTag.get(tag);
            if (list) {
                let lastStat = this._tagStats.get(tag);
                let nextStat: vscode.FileStat;
                if (list.length === 0) {
                    // no tags
                    this._tagStats.delete(tag);
                } else if (list.length === 1) {
                    // only one tag - we can shortcut it to be a file
                    nextStat = this._getItemStat(list[0], lastStat);
                } else {
                    // multiple tags, need a directory
                    nextStat = {
                        ...(lastStat ?? { ctime: Date.now() }),
                        type: vscode.FileType.Directory,
                        mtime: Date.now(),
                        size: undefined,
                    };
                }

                if (nextStat) {
                    this._tagStats.set(tag, nextStat);
                    return nextStat;
                }
            }
        }
        return undefined;
    }

    readDirectory(
        uri: vscode.Uri
    ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        console.log('readDirectory', uri);

        if (uri.path === '/') {
            // list all items
            let result = [] as [string, vscode.FileType][];
            for (let [tag, list] of this._itemsByTag) {
                if (list.length === 1) {
                    result.push([`${tag}.js`, vscode.FileType.File]);
                } else if (list.length >= 2) {
                    result.push([tag, vscode.FileType.Directory]);
                }
            }

            return result;
        }

        const { tag } = parseUri(uri);

        if (tag) {
            // list bots for  tag
            let result = [] as [string, vscode.FileType][];
            const list = this._itemsByTag.get(tag);
            if (list && list.length >= 2) {
                for (let item of list) {
                    result.push([`${item.botId}.js`, vscode.FileType.File]);
                }
                return result;
            }
        }

        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        console.log('createDirectory', uri);
        throw vscode.FileSystemError.NoPermissions(
            'Unable to create directories.'
        );
    }

    readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        console.log('readFile', uri);
        const { botId, tag } = parseUri(uri);

        if (tag) {
            const list = this._itemsByTag.get(tag);
            if (list) {
                let item: IdeTagNode;
                if (list.length === 1) {
                    item = list[0];
                } else if (list.length >= 2) {
                    if (botId) {
                        const botItem = list.find(
                            (item) => item.botId === botId
                        );
                        if (botItem) {
                            item = botItem;
                        } else {
                            throw vscode.FileSystemError.FileNotFound(
                                'Bot not found'
                            );
                        }
                    } else {
                        throw vscode.FileSystemError.FileIsADirectory(uri);
                    }
                }

                if (!item) {
                    throw new Error('Item was null when it should not be.');
                }
                const bot = this._simulation.helper.botsState[item.botId];
                const prefixedScript = getScript(bot, item.tag, null);
                const script = trimPrefixedScript(item.prefix, prefixedScript);

                return this._encoder.encode(script);
            }
        }

        throw vscode.FileSystemError.FileNotFound('Tag not found');
    }

    writeFile(
        uri: vscode.Uri,
        content: Uint8Array,
        options: { create: boolean; overwrite: boolean }
    ): void | Thenable<void> {
        console.log('writeFile', uri, content, options);
        throw vscode.FileSystemError.NoPermissions('Unable to write files');
    }

    delete(
        uri: vscode.Uri,
        options: { recursive: boolean }
    ): void | Thenable<void> {
        console.log('delete', uri, options);
        throw vscode.FileSystemError.NoPermissions('Unable to delete files.');
    }

    rename(
        oldUri: vscode.Uri,
        newUri: vscode.Uri,
        options: { overwrite: boolean }
    ): void | Thenable<void> {
        console.log('rename', oldUri, newUri, options);
        throw vscode.FileSystemError.NoPermissions('Unable to rename files.');
    }

    copy?(
        source: vscode.Uri,
        destination: vscode.Uri,
        options: { overwrite: boolean }
    ): void | Thenable<void> {
        console.log('copy', source, destination, options);
        throw vscode.FileSystemError.NoPermissions('Unable to copy files.');
    }

    // TODO: Maybe Implement
    // open?(resource: vscode.Uri, options: { create: boolean; }): number | Thenable<number> {
    //     console.log('open', resource, options);
    //     throw vscode.FileSystemError.NoPermissions('Unable to copy files.');
    //     throw new Error('Method not implemented.');
    // }

    // close?(fd: number): void | Thenable<void> {
    //     console.log('close', fd);
    //     throw new Error('Method not implemented.');
    // }

    // read?(fd: number, pos: number, data: Uint8Array, offset: number, length: number): number | Thenable<number> {
    //     console.log('read', fd, pos, data, offset, length);
    //     throw new Error('Method not implemented.');
    // }

    // write?(fd: number, pos: number, data: Uint8Array, offset: number, length: number): number | Thenable<number> {
    //     console.log('write', fd, pos, data, offset, length);
    //     throw new Error('Method not implemented.');
    // }

    private _getItemStat(
        item: IdeTagNode,
        oldStat: { ctime: number } = { ctime: Date.now() }
    ): vscode.FileStat {
        const bot = this._simulation.helper.botsState[item.botId];
        return {
            ...oldStat,
            type: vscode.FileType.File,
            mtime: Date.now(),
            size: calculateStringTagValue(null, bot, item.tag, '').length,
        };
    }
}

function getScript(bot: Bot, tag: string, space: string) {
    let val = getTagValueForSpace(bot, tag, space);
    if (typeof val !== 'undefined' && val !== null) {
        let str = val.toString();
        if (typeof val === 'object') {
            str = JSON.stringify(val);
        }
        return str;
    } else {
        return val || '';
    }
}
