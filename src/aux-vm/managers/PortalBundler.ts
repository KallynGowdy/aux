import {
    applyUpdates,
    BotIndex,
    BotIndexEvent,
    BotsState,
    calculateBotValue,
    getScriptPrefix,
    hasPortalScript,
    isPortalScript,
    PrecalculatedBot,
    PrecalculatedBotsState,
    OpenCustomPortalOptions,
    stateUpdatedEvent,
    StateUpdatedEvent,
    trimPortalScript,
    trimPrefixedScript,
    Bot,
    RegisterPrefixOptions,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import values from 'lodash/values';
import { isEqual, pick, sortBy } from 'lodash';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type ESBuild from 'esbuild';
import * as esbuild from 'esbuild';

export const DEFAULT_IMPORT_LANGUAGE = 'js';

/**
 * Defines an interface that represents the list of bots and tags that are included in a bundle.
 */
export interface BundleModules {
    [id: string]: Set<string>;
}

/**
 * Defines an interface that represents data about an external module.
 */
export interface ExternalModule {
    /**
     * The ID that was imported.
     */
    id: string;

    /**
     * The URL that was imported.
     */
    url: string;

    /**
     * The URL to the typescript definitions
     */
    typescriptDefinitionsURL: string | null;
}

/**
 * Defines an interface that represents data about an injected library.
 */
export interface LibraryModule {
    /**
     * The ID that was imported.
     */
    id: string;

    /**
     * The source code that was imported.
     */
    source: string;

    /**
     * The language that this module is in.
     */
    language: RegisterPrefixOptions['language'];
}

/**
 * Defines an interface that represents a bundle of code.
 */
export interface CodeBundle {
    /**
     * The tag the bundle was built from.
     */
    tag: string;

    /**
     * The source code that the bundle contains.
     * If an error occurred, then this will be null/undefined.
     */
    source?: string;

    /**
     * The error that occurred while building the bundle.
     * Null/Undefined if an error did not happen.
     */
    error?: string;

    /**
     * The list of warnings that occurred while building the bundle.
     */
    warnings: string[];

    /**
     * The list of modules that the bundle contains.
     */
    modules: BundleModules;

    /**
     * The list of modules that were imported from the web.
     */
    externals: {
        [id: string]: ExternalModule;
    };
}

export interface ScriptPrefix {
    prefix: string;
    language: RegisterPrefixOptions['language'];
    isDefault?: boolean;
}

export const DEFAULT_BASE_MODULE_URL: string = 'https://cdn.skypack.dev';

/**
 * Defines an interface that can bundle AUX code from tags into a single script.
 */
export interface PortalBundler {
    /**
     * Creates a bundle from the given bots.
     * @param state The bots state that the bundle should be created from.
     * @param tag The tag that should be used as the entry point for the bundle.
     * @param prefixes The prefixes that should be used to distinguish tag types.
     */
    bundleTag(
        state: BotsState,
        tag: string,
        prefixes: ScriptPrefix[]
    ): Promise<CodeBundle>;

    /**
     * Adds the given library source under the given name.
     * @param module The module that should be used.
     */
    addLibrary(module: LibraryModule): void;
}

/**
 * Defines a class that is used to bundle scripts for portals.
 * It listens for state updates and is able to asynchrounously emit bundles that should be injected into custom portals.
 */
export class ESBuildPortalBundler implements PortalBundler {
    private _esbuildService: ESBuild.Service;
    private _baseModuleUrl: string = DEFAULT_BASE_MODULE_URL;
    private _httpCache: Map<string, Promise<AxiosResponse<string>>>;
    private _libraries: Map<string, LibraryModule>;
    private _esbuildWasmUrl: string;

    constructor(options: { esbuildWasmUrl?: string } = {}) {
        this._httpCache = new Map();
        this._libraries = new Map();
        this._libraries;
        this._esbuildWasmUrl = options.esbuildWasmUrl || null;
    }

    /**
     * Adds the given library source under the given name.
     * @param source The source code to use.
     */
    addLibrary(module: LibraryModule) {
        this._libraries.set(module.id, module);
    }

    /**
     * Creates a bundle from the given bots that starts with the given tag.
     * @param state The bots state that the bundle should be created from.
     * @param tag The tag that should be bundled.
     * @param prefixes The list of script prefixes.
     */
    async bundleTag(
        state: BotsState,
        tag: string,
        prefixes: ScriptPrefix[]
    ): Promise<CodeBundle> {
        let entryModules = new Set<string>();
        let entryCode = '';
        let scriptPrefixes = prefixes.map((p) => p.prefix);
        let bots = sortBy(values(state), (b) => b.id);
        const entryPrefix = getScriptPrefix(scriptPrefixes, tag);
        const entryPrefixes =
            entryPrefix !== null ? [entryPrefix] : scriptPrefixes;
        tag = entryPrefix !== null ? trimPrefixedScript(entryPrefix, tag) : tag;

        let tagModules = bots
            .map((b) => ({
                prefix: getScriptPrefix(
                    entryPrefixes,
                    calculateBotValue(null, b, tag)
                ),
                tag: tag,
                id: b.id,
                code: calculateBotValue(null, b, tag),
            }))
            .filter((value) => value.prefix !== null)
            .map((m) => ({
                name: auxModuleId(m.prefix, m.id, m.tag),
                code: trimPrefixedScript(m.prefix, m.code),
            }));

        if (tagModules.length <= 0) {
            return null;
        }

        for (let m of tagModules) {
            entryModules.add(m.name);
        }

        for (let name of entryModules) {
            entryCode += `import ${JSON.stringify(name)};\n`;
        }
        return await this._esbuild(tag, entryCode, prefixes, state, bots);
    }

    private async _esbuild(
        tag: string,
        entryCode: string,
        prefixes: ScriptPrefix[],
        state: BotsState,
        bots: Bot[]
    ): Promise<CodeBundle> {
        if (!this._esbuildService) {
            let options: ESBuild.ServiceOptions = {};
            if (this._esbuildWasmUrl) {
                options.wasmURL = this._esbuildWasmUrl;
            }
            this._esbuildService = await esbuild.startService(options);
        }

        let modules: BundleModules = {};
        let externals: CodeBundle['externals'] = {};
        try {
            const result = await this._esbuildService.build({
                entryPoints: ['__entry'],
                bundle: true,
                format: 'iife',
                write: false,
                logLevel: 'silent',
                plugins: [
                    this._esbuildPlugin(
                        prefixes,
                        entryCode,
                        state,
                        bots,
                        modules,
                        externals
                    ),
                ],
            });

            let final = '';
            for (let file of result.outputFiles) {
                final += file.text;
            }

            const warnings = result.warnings.map((w) => w.text);

            return {
                tag,
                source: final,
                warnings,
                modules,
                externals,
            };
        } catch (err) {
            return {
                tag,
                error: err.toString(),
                warnings: [],
                modules,
                externals,
            };
        }
    }

    private _esbuildPlugin(
        prefixes: ScriptPrefix[],
        entryCode: string,
        state: BotsState,
        bots: Bot[],
        modules: BundleModules,
        externals: CodeBundle['externals']
    ): ESBuild.Plugin {
        return {
            name: 'casualos',
            setup: (build) => {
                build.onResolve({ filter: /^__entry$/ }, (args) => ({
                    path: args.path,
                    namespace: 'entry-ns',
                }));

                build.onLoad(
                    { filter: /^__entry$/, namespace: 'entry-ns' },
                    (args) => ({
                        contents: entryCode,
                        loader: 'js',
                    })
                );

                build.onResolve({ filter: /\\?auxmodule$/ }, (args) => ({
                    path: args.path,
                    namespace: 'aux-ns',
                }));

                for (let p of prefixes) {
                    let prefix = p;
                    build.onResolve(
                        { filter: new RegExp(`^${prefix.prefix}`) },
                        (args) => {
                            const tag = trimPrefixedScript(
                                prefix.prefix,
                                args.path
                            );
                            const bot = bots.find((b) =>
                                isPortalScript(
                                    prefix.prefix,
                                    calculateBotValue(null, b, tag)
                                )
                            );

                            if (!bot) {
                                return {
                                    errors: [
                                        {
                                            text: `Unable to resolve "${prefix.prefix}${tag}". No matching script could be found.`,
                                        },
                                    ],
                                };
                            }

                            return {
                                path: auxModuleId(prefix.prefix, bot.id, tag),
                                namespace: 'aux-ns',
                            };
                        }
                    );
                }

                build.onLoad(
                    { filter: /\\?auxmodule$/, namespace: 'aux-ns' },
                    (args) => {
                        const { prefix, botId, tag } = parseAuxModuleId(
                            prefixes,
                            args.path
                        );
                        if (prefix && botId && tag) {
                            const bot = state[botId];
                            if (!bot) {
                                return {
                                    errors: [
                                        {
                                            text: `Unable to import "${prefix.prefix}${tag}". No matching script could be found.`,
                                        },
                                    ],
                                };
                            }
                            let moduleTags = modules[botId];
                            if (!moduleTags) {
                                moduleTags = new Set();
                                modules[botId] = moduleTags;
                            }
                            moduleTags.add(tag);

                            const code = calculateBotValue(null, bot, tag);
                            return {
                                contents: trimPrefixedScript(
                                    prefix.prefix,
                                    code
                                ),
                                loader: this._loaderForLanguage(
                                    prefix.language,
                                    DEFAULT_IMPORT_LANGUAGE
                                ),
                            };
                        }

                        return {
                            errors: [
                                {
                                    text: `Did you forget to use 📖 when importing?`,
                                },
                            ],
                        };
                    }
                );

                build.onResolve({ filter: /^https?/ }, (args) => ({
                    path: args.path,
                    namespace: 'http-ns',
                }));

                build.onResolve({ filter: /.*/ }, (args) => {
                    const importee = args.path;
                    let importer = args.importer;

                    if (this._libraries.has(importee)) {
                        return {
                            path: importee,
                            namespace: 'lib-ns',
                        };
                    }

                    // convert to HTTP(S) import.
                    if (importee.startsWith('/') || importee.startsWith('./')) {
                        // use importer as base URL
                        const importerUrl = new URL(importer);
                        importer = `${importerUrl.origin}${importerUrl.pathname}`;
                        if (!importer.endsWith('/')) {
                            importer = importer + '/';
                        }

                        const url = new URL(importee, importer);
                        return { path: url.href, namespace: 'http-ns' };
                    } else {
                        const url = `${this._baseModuleUrl}/${importee}?dts`;
                        externals[importee] = {
                            id: importee,
                            url,
                            typescriptDefinitionsURL: null,
                        };
                        return {
                            path: url,
                            namespace: 'http-ns',
                        };
                    }
                });

                build.onLoad(
                    { filter: /^https?/, namespace: 'http-ns' },
                    async (args) => {
                        try {
                            const cached = this._httpCache.get(args.path);
                            if (typeof cached !== 'undefined') {
                                return {
                                    contents: handleHttpResponse(
                                        args.path,
                                        await cached,
                                        externals
                                    ),
                                    loader: 'js',
                                };
                            }

                            let promise = axios.get(args.path);

                            this._httpCache.set(args.path, promise);

                            const script = handleHttpResponse(
                                args.path,
                                await promise,
                                externals
                            );
                            return {
                                contents: script,
                                loader: 'js',
                            };
                        } catch (err) {
                            return {
                                errors: [
                                    {
                                        text: `${err}`,
                                    },
                                ],
                            };
                        }
                    }
                );

                build.onLoad(
                    { filter: /.*/, namespace: 'lib-ns' },
                    async (args) => {
                        try {
                            const module = this._libraries.get(args.path);
                            if (module) {
                                return {
                                    contents: module.source,
                                    loader: this._loaderForLanguage(
                                        module.language,
                                        DEFAULT_IMPORT_LANGUAGE
                                    ),
                                };
                            }

                            return {
                                errors: [
                                    {
                                        text: `Unable to find library for ${args.path}`,
                                    },
                                ],
                            };
                        } catch (err) {
                            return {
                                errors: [
                                    {
                                        text: `${err}`,
                                    },
                                ],
                            };
                        }
                    }
                );
            },
        };
    }

    private _loaderForLanguage(
        language: RegisterPrefixOptions['language'],
        defaultLoader: ESBuild.Loader
    ): ESBuild.Loader {
        return language === 'javascript'
            ? 'js'
            : language === 'typescript'
            ? 'ts'
            : language === 'json'
            ? 'json'
            : language === 'jsx'
            ? 'jsx'
            : language === 'tsx'
            ? 'tsx'
            : language === 'text'
            ? 'text'
            : defaultLoader;
    }
}

function handleHttpResponse(
    path: string,
    response: AxiosResponse<string>,
    externals: CodeBundle['externals']
) {
    if (typeof response.data === 'string') {
        const script = response.data;

        const external = values(externals).find((e) => e.url === path);

        if (external) {
            const declarations = response?.headers?.['x-typescript-types'];
            if (typeof declarations === 'string') {
                external.typescriptDefinitionsURL = new URL(
                    declarations,
                    path
                ).href;
            }
        }

        return script;
    } else {
        throw new Error(`The module server did not return a string.`);
    }
}

function auxModuleId(prefix: string, botId: string, tag: string) {
    return `${prefix}${botId}.${tag}?auxmodule`;
}

function parseAuxModuleId(
    prefixes: ScriptPrefix[],
    id: string
): { prefix: ScriptPrefix; botId: string; tag: string } {
    if (isAuxModuleId(id)) {
        for (let prefix of prefixes) {
            if (id.startsWith(prefix.prefix)) {
                id = id.substring(prefix.prefix.length);
                const dotIndex = id.indexOf('.');
                const botId = id.slice(0, dotIndex);
                const tag = id.slice(
                    dotIndex + 1,
                    id.length - '?auxmodule'.length
                );

                return {
                    prefix,
                    botId,
                    tag,
                };
            }
        }
    }
    return { prefix: null, botId: null, tag: null };
}

function isAuxModuleId(id: string) {
    return id.endsWith('?auxmodule');
}
