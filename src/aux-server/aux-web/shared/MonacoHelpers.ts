import * as monaco from './MonacoLibs';
import {
    Bot,
    isFilterTag,
    tagsOnBot,
    isFormula,
    Transpiler,
    KNOWN_TAGS,
    isScript,
} from '@casual-simulation/aux-common';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import { calculateFormulaDefinitions } from './FormulaHelpers';
import { lib_es2015_dts } from 'monaco-editor/esm/vs/language/typescript/lib/lib.js';
import { SimpleEditorModelResolverService } from 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';
import { SubscriptionLike, Subscription } from 'rxjs';
import { skip, flatMap, filter, first, takeWhile } from 'rxjs/operators';
import { Simulation } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import { propertyInsertText } from './CompletionHelpers';

export function setup() {
    // Tell monaco how to create the web workers
    (<any>self).MonacoEnvironment = {
        getWorker: function(moduleId: string, label: string) {
            if (label === 'typescript' || label === 'javascript') {
                return new TypescriptWorker();
            }
            return new EditorWorker();
        },
    };

    // Set diagnostics
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
    });

    // Set compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2015,

        // Auto-import the given libraries
        lib: ['defaultLib:lib.es2015.d.ts', 'file:///formula-lib.d.ts'],

        allowJs: true,
        alwaysStrict: true,
        checkJs: true,
        newLine: monaco.languages.typescript.NewLineKind.LineFeed,
        noEmit: true,
    });

    // Eagerly sync models to get intellisense for all models
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    // Register the ES2015 core library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        lib_es2015_dts,
        'defaultLib:lib.es2015.d.ts'
    );

    // Register the formula library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        calculateFormulaDefinitions(),
        'file:///formula-lib.d.ts'
    );

    /**
     * Monkeypatch to make 'Find All References' work across multiple files
     * https://github.com/Microsoft/monaco-editor/issues/779#issuecomment-374258435
     */
    SimpleEditorModelResolverService.prototype.findModel = function(
        editor: monaco.editor.IStandaloneCodeEditor,
        resource: any
    ) {
        return monaco.editor
            .getModels()
            .find(model => model.uri.toString() === resource.toString());
    };
}

interface ModelInfo {
    botId: string;
    tag: string;
    decorators: string[];
    isFormula: boolean;
    isScript: boolean;
    model: monaco.editor.ITextModel;
    sub: Subscription;
}

let subs: SubscriptionLike[] = [];
let activeModel: monaco.editor.ITextModel = null;
let models: Map<string, ModelInfo> = new Map();
let transpiler = new Transpiler();

/**
 * The model that should be marked as active.
 * @param model The model.
 */
export function setActiveModel(model: monaco.editor.ITextModel) {
    activeModel = model;
}

/**
 * Watches the given simulation for changes and updates the corresponding models.
 * @param simulation The simulation to watch.
 */
export function watchSimulation(simulation: BrowserSimulation) {
    let sub = simulation.watcher.botsDiscovered
        .pipe(flatMap(f => f))
        .subscribe(f => {
            for (let tag of tagsOnBot(f)) {
                if (
                    shouldKeepModelWithTagLoaded(tag) ||
                    isFormula(f.tags[tag])
                ) {
                    loadModel(simulation, f, tag);
                }
            }
        });

    let referencesDisposable = monaco.languages.registerReferenceProvider(
        'javascript',
        {
            async provideReferences(
                model: monaco.editor.ITextModel,
                position: monaco.Position,
                context: monaco.languages.ReferenceContext,
                token: monaco.CancellationToken
            ): Promise<monaco.languages.Location[]> {
                const line = model.getLineContent(position.lineNumber);
                let startIndex = position.column;
                let endIndex = position.column;
                for (; startIndex >= 0; startIndex -= 1) {
                    if (
                        line[startIndex] === '"' ||
                        line[startIndex] === "'" ||
                        line[startIndex] === '`'
                    ) {
                        break;
                    }
                }
                for (; endIndex < line.length; endIndex += 1) {
                    if (
                        line[endIndex] === '"' ||
                        line[endIndex] === "'" ||
                        line[endIndex] === '`'
                    ) {
                        break;
                    }
                }

                const word = line.substring(startIndex + 1, endIndex);
                if (word) {
                    const result = await simulation.code.getReferences(word);
                    let locations: monaco.languages.Location[] = [];
                    for (let id in result.references) {
                        for (let tag of result.references[id]) {
                            const bot = simulation.helper.botsState[id];
                            let m = loadModel(simulation, bot, tag);
                            locations.push(
                                ...m
                                    .findMatches(
                                        result.tag,
                                        true,
                                        false,
                                        true,
                                        null,
                                        false
                                    )
                                    .map(r => ({
                                        range: r.range,
                                        uri: m.uri,
                                    }))
                            );
                        }
                    }
                    return locations;
                }

                return [];
            },
        }
    );

    let completionDisposable = monaco.languages.registerCompletionItemProvider(
        'javascript',
        {
            triggerCharacters: ['#', '.'],
            async provideCompletionItems(
                model,
                position,
                context,
                token
            ): Promise<monaco.languages.CompletionList> {
                const lineText = model.getLineContent(position.lineNumber);
                const textBeforeCursor = lineText.substring(0, position.column);
                let tagIndex = textBeforeCursor.lastIndexOf('#');
                let offset = '#'.length;

                // TODO: Allow configuring which variables tag autocomplete shows up for
                if (tagIndex < 0) {
                    tagIndex = textBeforeCursor.lastIndexOf('tags.');
                    offset = 'tags.'.length;
                }

                if (tagIndex < 0) {
                    return {
                        suggestions: [],
                    };
                }

                const usedTags = await simulation.code.getTags();
                const knownTags = KNOWN_TAGS;
                const allTags = sortBy(union(usedTags, knownTags)).filter(
                    t => !/[()]/g.test(t)
                );

                const tagColumn = tagIndex + offset;
                const completionStart = tagColumn + 1;

                return {
                    suggestions: allTags.map(
                        t =>
                            <monaco.languages.CompletionItem>{
                                kind: monaco.languages.CompletionItemKind.Field,
                                label: t,
                                insertText: propertyInsertText(t),
                                additionalTextEdits: [
                                    {
                                        text: '',
                                        range: new monaco.Range(
                                            position.lineNumber,
                                            tagColumn,
                                            position.lineNumber,
                                            tagColumn + 1
                                        ),
                                        forceMoveMarkers: true,
                                    },
                                ],
                                range: new monaco.Range(
                                    position.lineNumber,
                                    completionStart,
                                    position.lineNumber,
                                    position.column
                                ),
                            }
                    ),
                };
            },
        }
    );

    sub.add(() => {
        referencesDisposable.dispose();
        completionDisposable.dispose();
    });

    return sub;
}

/**
 * Clears the currently loaded models.
 */
export function clearModels() {
    for (let sub of subs) {
        sub.unsubscribe();
    }
    subs = [];
    for (let model of monaco.editor.getModels()) {
        model.dispose();
    }
}

/**
 * Loads the model for the given tag.
 * @param simulation The simulation that the bot is in.
 * @param bot The bot.
 * @param tag The tag.
 */
export function loadModel(
    simulation: BrowserSimulation,
    bot: Bot,
    tag: string
) {
    const uri = getModelUri(bot, tag);
    let model = monaco.editor.getModel(uri);
    if (!model) {
        let script = getScript(bot, tag);
        model = monaco.editor.createModel(
            script,
            tagScriptLanguage(tag, bot.tags[tag]),
            uri
        );

        watchModel(simulation, model, bot, tag);
    }

    return model;
}

function tagScriptLanguage(tag: string, script: any): string {
    return isFilterTag(tag) || isFormula(script) || isScript(script)
        ? 'javascript'
        : 'plaintext';
}

/**
 * Unloads and disposes of the given model.
 * @param model The model that should be unloaded.
 */
export function unloadModel(model: monaco.editor.ITextModel) {
    const uri = model.uri;
    let m = models.get(uri.toString());
    if (m) {
        m.sub.unsubscribe();
        models.delete(uri.toString());
        const index = subs.indexOf(m.sub);
        if (index >= 0) {
            subs.splice(index, 1);
        }
    }
    model.dispose();
}

/**
 * Determines if the given model should be kept alive.
 * @param model The model to check.
 */
export function shouldKeepModelLoaded(
    model: monaco.editor.ITextModel
): boolean {
    let info = models.get(model.uri.toString());
    if (info) {
        return shouldKeepModelWithTagLoaded(info.tag) || info.isFormula;
    } else {
        return true;
    }
}

function shouldKeepModelWithTagLoaded(tag: string): boolean {
    return isFilterTag(tag) || isScript(tag);
}

function watchModel(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    bot: Bot,
    tag: string
) {
    let sub = new Subscription();
    let info: ModelInfo = {
        botId: bot.id,
        tag: tag,
        decorators: [],
        isFormula: false,
        isScript: false,
        model: model,
        sub: sub,
    };

    sub.add(
        simulation.watcher
            .botTagsChanged(bot.id)
            .pipe(
                skip(1),
                takeWhile(update => update !== null)
            )
            .subscribe(update => {
                bot = update.bot;
                if (model === activeModel || !update.tags.has(tag)) {
                    return;
                }
                let script = getScript(bot, tag);
                let value = model.getValue();
                if (script !== value) {
                    model.setValue(script);
                }
                updateLanguage(model, tag, bot.tags[tag]);
            })
    );

    sub.add(
        toSubscription(
            model.onDidChangeContent(async e => {
                if (e.isFlush) {
                    return;
                }
                let val = model.getValue();
                if (info.isFormula) {
                    val = '=' + val;
                } else if (info.isScript) {
                    if (val.indexOf('@') !== 0) {
                        val = '@' + val;
                    }
                }
                updateLanguage(model, tag, val);
                await simulation.editBot(bot, tag, val);
            })
        )
    );

    sub.add(
        simulation.watcher.botsRemoved
            .pipe(
                flatMap(f => f),
                first(id => id === bot.id)
            )
            .subscribe(f => {
                unloadModel(model);
            })
    );

    models.set(model.uri.toString(), info);
    updateDecorators(model, info, bot.tags[tag]);
    subs.push(sub);
}

function updateLanguage(
    model: monaco.editor.ITextModel,
    tag: string,
    value: string
) {
    const info = models.get(model.uri.toString());
    if (!info) {
        return;
    }
    const currentLanguage = model.getModeId();
    const nextLanguage = tagScriptLanguage(tag, value);
    if (nextLanguage !== currentLanguage) {
        monaco.editor.setModelLanguage(model, nextLanguage);
    }
    updateDecorators(model, info, value);
}

function updateDecorators(
    model: monaco.editor.ITextModel,
    info: ModelInfo,
    value: string
) {
    if (isFormula(value)) {
        const wasFormula = info.isFormula;
        info.isFormula = true;
        info.isScript = false;
        if (!wasFormula) {
            const text = model.getValue();
            if (text.indexOf('=') === 0) {
                // Delete the first character from the model cause
                // it is a formula marker
                model.applyEdits([
                    {
                        range: new monaco.Range(1, 1, 1, 2),
                        text: '',
                    },
                ]);
            }
        }

        info.decorators = model.deltaDecorations(info.decorators, [
            {
                range: new monaco.Range(1, 1, 1, 1),
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName: 'formula-marker',
                },
            },
        ]);
    } else if (isScript(value)) {
        const wasScript = info.isScript;
        info.isScript = true;
        info.isFormula = false;

        if (!wasScript) {
            const text = model.getValue();
            if (text.indexOf('@') === 0) {
                // Delete the first character from the model cause
                // it is a script marker
                model.applyEdits([
                    {
                        range: new monaco.Range(1, 1, 1, 2),
                        text: '',
                    },
                ]);
            }
        }

        info.decorators = model.deltaDecorations(info.decorators, [
            {
                range: new monaco.Range(1, 1, 1, 1),
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName: 'script-marker',
                },
            },
        ]);
    } else {
        info.decorators = model.deltaDecorations(info.decorators, []);
        info.isFormula = false;
        info.isScript = false;
    }
}

function getModelUri(bot: Bot, tag: string) {
    return getModelUriFromId(bot.id, tag);
}

function getModelUriFromId(id: string, tag: string) {
    return monaco.Uri.parse(encodeURI(`file:///${id}/${tag}.js`));
}

export function getScript(bot: Bot, tag: string) {
    let val = bot.tags[tag];
    if (typeof val !== 'undefined' && val !== null) {
        let str = val.toString();
        if (typeof val === 'object') {
            str = JSON.stringify(val);
        }
        if (isFormula(str)) {
            return transpiler.replaceMacros(str);
        } else {
            return str;
        }
    } else {
        return val || '';
    }
}

function toSubscription(disposable: monaco.IDisposable) {
    return new Subscription(() => disposable.dispose());
}
