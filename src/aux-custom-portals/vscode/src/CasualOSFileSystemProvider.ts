import {
    getTagValueForSpace,
    tagsOnBot,
} from '@casual-simulation/aux-common/bots/BotCalculations';
import type { Bot } from '@casual-simulation/aux-common';
import type { Simulation } from '@casual-simulation/aux-vm';
import * as vscode from 'vscode';

// Aux URIs have a pretty simple format:
//  casualos://232ae423-e01b-4c7e-8d7d-c36716f5ae4d/myTag.js
// | scheme | |                id                 || tag |

function parseUri(
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
    const tagAndExtension = uri.path;
    const lastDotIndex = tagAndExtension.lastIndexOf('.');
    const tag =
        lastDotIndex >= 0
            ? tagAndExtension.slice(0, lastDotIndex)
            : tagAndExtension;
    return {
        botId: !uri.authority ? null : uri.authority,
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
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.botId = botId;
        this.tag = tag;
    }
}

export class CasualOSFileSystemProvider implements vscode.FileSystemProvider {
    private _simulation: Simulation;
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _rootFile = new File(null, null);
    private _encoder = new TextEncoder();

    constructor(sim: Simulation) {
        this._simulation = sim;
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
        const { botId, tag } = parseUri(uri);

        if (!botId) {
            // Stat-ing the root directory
            return this._rootFile;
        } else if (!tag) {
            // Stat-ing a bot
            return new File(botId, null);
        }
        // Stat-ing a tag
        return new File(botId, tag);
    }

    readDirectory(
        uri: vscode.Uri
    ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        console.log('readDirectory', uri);
        const { botId, tag } = parseUri(uri);
        if (!botId) {
            // list all bots
            const bots = this._simulation.helper.objects;
            const files = bots.map((b) => [
                b.id,
                vscode.FileType.Directory,
            ]) as [string, vscode.FileType][];
            return files;
        } else if (!tag) {
            // list all tags for the bot
            const bot = this._simulation.helper.botsState[botId];
            if (bot) {
                const tags = tagsOnBot(bot);
                const files = tags.map((t) => [t, vscode.FileType.File]) as [
                    string,
                    vscode.FileType
                ][];
                return files;
            }
        }
        // not a directory
        return [];
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

        if (!botId || !tag) {
            throw vscode.FileSystemError.FileNotFound('Tag not found');
        }

        const bot = this._simulation.helper.botsState[botId];

        if (!bot) {
            throw vscode.FileSystemError.FileNotFound('Bot not found.');
        }

        // TODO: Support tag masks
        const script = getScript(bot, tag, null);

        return this._encoder.encode(script);
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
