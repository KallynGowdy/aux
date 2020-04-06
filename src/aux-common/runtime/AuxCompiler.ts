import { Transpiler } from '../Formulas/Transpiler';
import { isFormula, isScript, parseScript } from '../bots';
import flatMap from 'lodash/flatMap';

/**
 * Defines a class that can compile scripts and formulas
 * into functions.
 */
export class AuxCompiler {
    private _transpiler = new Transpiler();

    /**
     * Compiles the given script into a function.
     * @param script The script to compile.
     * @param options The options that should be used to compile the script.
     */
    compile<T>(
        script: string,
        options?: AuxCompileOptions<T>
    ): AuxCompiledScript {
        let { func, scriptLineOffset } = this._compileFunction(
            script,
            options || {}
        );

        const scriptFunction = func;

        if (options) {
            if (options.before || options.after || options.onError) {
                const before = options.before || (() => {});
                const after = options.after || (() => {});
                const onError =
                    options.onError ||
                    (err => {
                        throw err;
                    });

                const scriptFunc = func;
                const context = options.context;
                func = function(...args: any[]) {
                    before(context);
                    try {
                        return scriptFunc(...args);
                    } catch (ex) {
                        onError(ex, context);
                    } finally {
                        after(context);
                    }
                };
            }
        }

        const final = func as AuxCompiledScript;
        final.metadata = {
            scriptFunction,
            scriptLineOffset,
        };

        return final;
    }

    private _parseScript(script: string): string {
        return script;
    }

    private _compileFunction<T>(
        script: string,
        options: AuxCompileOptions<T>
    ): {
        func: Function;
        scriptLineOffset: number;
    } {
        // Yes this code is super ugly.
        // Some day we will engineer this into a real
        // compiler, but for now this ad-hoc method
        // seems to work.

        let formula = false;
        if (isFormula(script)) {
            script = script.substring(1);
            formula = true;
        } else if (isScript(script)) {
            script = parseScript(script);
        }
        script = this._parseScript(script);
        let scriptLineOffset = 0;

        let constantsCode = '';
        if (options.constants) {
            const lines = Object.keys(options.constants)
                .filter(v => v !== 'this')
                .map(v => `const ${v} = constants["${v}"];`);
            constantsCode = lines.join('\n') + '\n';
        }

        let variablesCode = '';
        if (options.variables) {
            const lines = Object.keys(options.variables)
                .filter(v => v !== 'this')
                .map(v => `const ${v} = variables["${v}"](context);`);
            variablesCode = '\n' + lines.join('\n');
            scriptLineOffset += 1 + (lines.length - 1);
        }

        let argumentsCode = '';
        if (options.arguments) {
            const lines = flatMap(
                options.arguments
                    .filter(v => v !== 'this')
                    .map((v, i) =>
                        Array.isArray(v)
                            ? ([v, i] as const)
                            : ([[v] as string[], i] as const)
                    ),
                ([v, i]) => v.map(name => `const ${name} = args[${i}];`)
            );
            argumentsCode = '\n' + lines.join('\n');
            scriptLineOffset += 1 + (lines.length - 1);
        }

        let scriptCode: string;
        if (formula) {
            scriptCode = `\nreturn eval(_script)`;
        } else {
            scriptCode = `\n { \n${script}\n }`;
            scriptLineOffset += 2;
        }

        // Function needs a name because acorn doesn't understand
        // that this function is allowed to be anonymous.
        const functionCode = `function _(...args) { ${argumentsCode}${variablesCode}${scriptCode}\n }`;
        const transpiled = formula
            ? functionCode
            : this._transpiler.transpile(functionCode);

        const finalCode = `${constantsCode}return ${transpiled};`;

        let func = _buildFunction(
            finalCode,
            options,
            formula ? this._transpiler.transpile(script) : null
        );

        if (options.variables) {
            if ('this' in options.variables) {
                func = func.bind(options.variables['this'](options.context));
            }
        }

        return { func, scriptLineOffset };
    }
}

function _buildFunction<T>(
    finalCode: string,
    options: AuxCompileOptions<T>,
    script?: string
) {
    if (script) {
        return Function(
            'constants',
            'variables',
            'context',
            '_script',
            finalCode
        )(options.constants, options.variables, options.context, script);
    } else {
        return Function('constants', 'variables', 'context', finalCode)(
            options.constants,
            options.variables,
            options.context
        );
    }
}

/**
 * A script that has been compiled.
 */
export interface AuxCompiledScript {
    (...args: any[]): any;

    /**
     * The metadata for the script.
     */
    metadata: AuxScriptMetadata;
}

/**
 * Metadata about the script.
 */
export interface AuxScriptMetadata {
    /**
     * The function that directly wraps the script.
     */
    scriptFunction: Function;

    /**
     * The number of lines that the user's script is offset inside the returned function source.
     */
    scriptLineOffset: number;
}

/**
 * The set of options that a script should be compiled with.
 */
export interface AuxCompileOptions<T> {
    /**
     * The context that should be used.
     */
    context?: T;

    /**
     * The variables that should be made available to the script.
     */
    variables?: {
        [name: string]: (context?: T) => any;
    };

    /**
     * The constant values that should be made available to the script.
     */
    constants?: {
        [name: string]: any;
    };

    /**
     * The names that each argument should be assigned.
     */
    arguments?: (string | string[])[];

    /**
     * A function that should be called before the compiled function is executed.
     */
    before?: (context?: T) => void;

    /**
     * A function that should be called after the compiled function is executed.
     */
    after?: (context?: T) => void;

    /**
     * A function that should be called when an error occurs.
     */
    onError?: (error: any, context?: T) => void;
}

// export class CompiledScriptError extends Error {
//     /**
//      * The inner error.
//      */
//     error: Error;

//     constructor(error: Error) {
//         super(error.message);
//         this.error = error;
//     }
// }
