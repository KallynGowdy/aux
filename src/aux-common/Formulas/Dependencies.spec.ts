import {
    Dependencies,
    AuxScriptMemberDependency,
    AuxScriptExpressionDependencies,
    AuxScriptFunctionDependency,
    AuxScriptBotDependency,
    AuxScriptSimpleFunctionDependency,
    AuxScriptReplacements,
    AuxScriptSimpleMemberDependency,
} from './Dependencies';

describe('Dependencies', () => {
    let dependencies: Dependencies;
    beforeEach(() => {
        dependencies = new Dependencies();
    });

    describe('dependencyTree()', () => {
        const cases = [
            ['getBots() expressions', 'call', 'getBots'],
            ['getBotTagValues() expressions', 'call', 'getBotTagValues'],
        ];

        describe.each(cases)('%s', (desc, type, symbol) => {
            it(`should return the tags`, () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag").num + ${symbol}("other").num`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: type,
                                identifier: {
                                    type: 'member',
                                    identifier: symbol,
                                    object: null,
                                },
                                dependencies: [
                                    {
                                        type: 'literal',
                                        value: 'tag',
                                    },
                                ],
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: type,
                                identifier: {
                                    type: 'member',
                                    identifier: symbol,
                                    object: null,
                                },
                                dependencies: [
                                    {
                                        type: 'literal',
                                        value: 'other',
                                    },
                                ],
                            },
                        },
                    ],
                });
            });

            it('should support dots in tag names', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag.test").num`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: type,
                                identifier: {
                                    type: 'member',
                                    identifier: symbol,
                                    object: null,
                                },
                                dependencies: [
                                    {
                                        type: 'literal',
                                        value: 'tag.test',
                                    },
                                ],
                            },
                        },
                    ],
                });
            });

            it('should contain the simple arguments used in the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag", "hello, world", 123)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            identifier: {
                                type: 'member',
                                identifier: symbol,
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'literal',
                                    value: 'tag',
                                },
                                {
                                    type: 'literal',
                                    value: 'hello, world',
                                },
                                {
                                    type: 'literal',
                                    value: 123,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should contain the complex arguments used in the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag", x => x.indexOf("hi") >= 0)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            identifier: {
                                type: 'member',
                                identifier: symbol,
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'literal',
                                    value: 'tag',
                                },
                                {
                                    type: 'expression',
                                    dependencies: [
                                        {
                                            type: 'call',
                                            identifier: {
                                                type: 'member',
                                                identifier: 'indexOf',
                                                object: {
                                                    type: 'member',
                                                    identifier: 'x',
                                                    object: null,
                                                },
                                            },
                                            dependencies: [
                                                {
                                                    type: 'literal',
                                                    value: 'hi',
                                                },
                                            ],
                                        },
                                        {
                                            type: 'literal',
                                            value: 0,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should try to parse each argument as a non-expression first', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag", "test", true, false, isBuilder)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            identifier: {
                                type: 'member',
                                identifier: symbol,
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'literal',
                                    value: 'tag',
                                },
                                {
                                    type: 'literal',
                                    value: 'test',
                                },
                                {
                                    type: 'literal',
                                    value: true,
                                },
                                {
                                    type: 'literal',
                                    value: false,
                                },
                                {
                                    type: 'member',
                                    identifier: 'isBuilder',
                                    object: null,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should parse the tags after the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag").aux.color`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'color',
                            object: {
                                type: 'member',
                                identifier: 'aux',
                                object: {
                                    type: type,
                                    identifier: {
                                        type: 'member',
                                        identifier: symbol,
                                        object: null,
                                    },
                                    dependencies: [
                                        {
                                            type: 'literal',
                                            value: 'tag',
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                });
            });

            it('should support indexers after the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag")['funny']`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'funny',
                            object: {
                                type: type,
                                identifier: {
                                    type: 'member',
                                    identifier: symbol,
                                    object: null,
                                },
                                dependencies: [
                                    {
                                        type: 'literal',
                                        value: 'tag',
                                    },
                                ],
                            },
                        },
                    ],
                });
            });

            it('should not fail on expressions that use variables in indexer expressions', () => {
                expect(() => {
                    const result = dependencies.dependencyTree(
                        `${symbol}("tag")[myVar]`
                    );
                }).not.toThrow();
            });

            it('should handle members in other function calls', () => {
                const result = dependencies.dependencyTree(
                    `math.sum(${symbol}("tag").length)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'sum',
                                object: {
                                    type: 'member',
                                    identifier: 'math',
                                    object: null,
                                },
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'length',
                                    object: {
                                        type: type,
                                        identifier: {
                                            type: 'member',
                                            identifier: symbol,
                                            object: null,
                                        },
                                        dependencies: [
                                            {
                                                type: 'literal',
                                                value: 'tag',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                });
            });

            it('should handle function calls after the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag").filter()`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'filter',
                                object: {
                                    type: type,
                                    identifier: {
                                        type: 'member',
                                        identifier: symbol,
                                        object: null,
                                    },
                                    dependencies: [
                                        {
                                            type: 'literal',
                                            value: 'tag',
                                        },
                                    ],
                                },
                            },
                            dependencies: [],
                        },
                    ],
                });
            });

            it('should include dependencies in filters', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag", x => x == this.val)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            identifier: {
                                type: 'member',
                                identifier: symbol,
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'literal',
                                    value: 'tag',
                                },
                                {
                                    type: 'expression',
                                    dependencies: [
                                        {
                                            type: 'member',
                                            identifier: 'x',
                                            object: null,
                                        },
                                        {
                                            type: 'member',
                                            identifier: 'val',
                                            object: {
                                                type: 'member',
                                                identifier: 'this',
                                                object: null,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should reject parameters from function expressions', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}("tag", function(x) { return x == this.val; })`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            identifier: {
                                type: 'member',
                                identifier: symbol,
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'literal',
                                    value: 'tag',
                                },
                                {
                                    type: 'expression',
                                    dependencies: [
                                        {
                                            type: 'member',
                                            identifier: 'x',
                                            object: null,
                                        },
                                        {
                                            type: 'member',
                                            identifier: 'val',
                                            object: {
                                                type: 'member',
                                                identifier: 'this',
                                                object: null,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });
        });

        describe('this', () => {
            it(`should return dependencies on this`, () => {
                const result = dependencies.dependencyTree(
                    `this.num + this.index * this.something.else - this['other']['thing']`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: 'member',
                                identifier: 'this',
                                object: null,
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'index',
                            object: {
                                type: 'member',
                                identifier: 'this',
                                object: null,
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'else',
                            object: {
                                type: 'member',
                                identifier: 'something',
                                object: {
                                    type: 'member',
                                    identifier: 'this',
                                    object: null,
                                },
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'thing',
                            object: {
                                type: 'member',
                                identifier: 'other',
                                object: {
                                    type: 'member',
                                    identifier: 'this',
                                    object: null,
                                },
                            },
                        },
                    ],
                });
            });

            it(`should handle just the keyword without members`, () => {
                const result = dependencies.dependencyTree(`this`);

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'this',
                            object: null,
                        },
                    ],
                });
            });
        });

        describe('members', () => {
            it('should return dependencies for identifiers', () => {
                const result = dependencies.dependencyTree(`abc`);

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'abc',
                            object: null,
                        },
                    ],
                });
            });

            it('should support indexer expressions', () => {
                const result = dependencies.dependencyTree('abc[def]');
                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',

                            // Should be null because we can't figure out the name
                            identifier: null,
                            object: {
                                type: 'member',
                                identifier: 'abc',
                                object: null,
                            },
                        },
                    ],
                });
            });

            it('should support expressions in indexers', () => {
                const result = dependencies.dependencyTree('abc[def * 99 / 2]');
                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',

                            // Should be null because we can't figure out the name
                            identifier: null,
                            object: {
                                type: 'member',
                                identifier: 'abc',
                                object: null,
                            },
                        },
                    ],
                });
            });
        });

        describe('functions', () => {
            it(`should return dependencies for functions`, () => {
                const result = dependencies.dependencyTree(
                    `getBotsInContext("wow")`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'getBotsInContext',
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'literal',
                                    value: 'wow',
                                },
                            ],
                        },
                    ],
                });
            });

            it(`should handle nested dependencies`, () => {
                const result = dependencies.dependencyTree(
                    `getBotsInContext(this.abc, "fun")`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'getBotsInContext',
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'abc',
                                    object: {
                                        type: 'member',
                                        identifier: 'this',
                                        object: null,
                                    },
                                },
                                {
                                    type: 'literal',
                                    value: 'fun',
                                },
                            ],
                        },
                    ],
                });
            });

            it(`should properly handle namespaces`, () => {
                const result = dependencies.dependencyTree(
                    `player.toast(this.abc)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'toast',
                                object: {
                                    type: 'member',
                                    identifier: 'player',
                                    object: null,
                                },
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'abc',
                                    object: {
                                        type: 'member',
                                        identifier: 'this',
                                        object: null,
                                    },
                                },
                            ],
                        },
                    ],
                });
            });

            it(`should allow identifiers`, () => {
                const result = dependencies.dependencyTree(`player.toast(abc)`);

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'toast',
                                object: {
                                    type: 'member',
                                    identifier: 'player',
                                    object: null,
                                },
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'abc',
                                    object: null,
                                },
                            ],
                        },
                    ],
                });
            });

            it(`should handle member expressions after the function call`, () => {
                const result = dependencies.dependencyTree(
                    `player.toast(abc).test`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'test',
                            object: {
                                type: 'call',
                                identifier: {
                                    type: 'member',
                                    identifier: 'toast',
                                    object: {
                                        type: 'member',
                                        identifier: 'player',
                                        object: null,
                                    },
                                },
                                dependencies: [
                                    {
                                        type: 'member',
                                        identifier: 'abc',
                                        object: null,
                                    },
                                ],
                            },
                        },
                    ],
                });
            });

            it(`should include dependencies from nested functions`, () => {
                const result = dependencies.dependencyTree(
                    `toast(x => "literal" + getBots("tag") + func())`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'toast',
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'expression',
                                    dependencies: [
                                        {
                                            type: 'literal',
                                            value: 'literal',
                                        },
                                        {
                                            type: 'call',
                                            identifier: {
                                                type: 'member',
                                                identifier: 'getBots',
                                                object: null,
                                            },
                                            dependencies: [
                                                {
                                                    type: 'literal',
                                                    value: 'tag',
                                                },
                                            ],
                                        },
                                        {
                                            type: 'call',
                                            identifier: {
                                                type: 'member',
                                                identifier: 'func',
                                                object: null,
                                            },
                                            dependencies: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });
        });
    });

    describe('simplify()', () => {
        it('should return the list of tags that an expression is dependent on', () => {
            const result = dependencies.simplify({
                type: 'expression',
                dependencies: [
                    {
                        type: 'bot',
                        name: 'abc.def',
                        dependencies: [
                            {
                                type: 'tag',
                                name: 'test',
                                dependencies: [],
                            },
                        ],
                    },
                    {
                        type: 'tag',
                        name: 'ghi',
                        dependencies: [],
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'bot',
                    name: 'abc.def',
                    dependencies: [
                        {
                            type: 'tag',
                            name: 'test',
                            dependencies: [],
                        },
                    ],
                },
                {
                    type: 'tag',
                    name: `ghi`,
                    dependencies: [],
                },
            ]);
        });

        it('should include functions that the tree is dependent on', () => {
            const result = dependencies.simplify({
                type: 'expression',
                dependencies: [
                    {
                        type: 'call',
                        identifier: {
                            type: 'member',
                            identifier: 'abc',
                            object: {
                                type: 'member',
                                identifier: 'test',
                                object: null,
                            },
                        },
                        dependencies: [],
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'function',
                    name: 'test.abc',
                    dependencies: [],
                },
            ]);
        });

        it('should include dependencies for functions', () => {
            const result = dependencies.simplify({
                type: 'expression',
                dependencies: [
                    {
                        type: 'call',
                        identifier: {
                            type: 'member',
                            identifier: 'abc',
                            object: {
                                type: 'member',
                                identifier: 'test',
                                object: null,
                            },
                        },
                        dependencies: [
                            {
                                type: 'member',
                                identifier: 'xyz',
                                object: {
                                    type: 'member',
                                    identifier: 'this',
                                    object: null,
                                },
                            },
                            {
                                type: 'member',
                                identifier: 'def',
                                object: {
                                    type: 'member',
                                    identifier: 'this',
                                    object: null,
                                },
                            },
                            {
                                type: 'literal',
                                value: 1234,
                            },
                        ],
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'function',
                    name: 'test.abc',
                    dependencies: [
                        {
                            type: 'this',
                        },
                        {
                            type: 'this',
                        },
                        {
                            type: 'literal',
                            value: 1234,
                        },
                    ],
                },
            ]);
        });

        it('should handle nested dependencies for functions', () => {
            const result = dependencies.simplify({
                type: 'expression',
                dependencies: [
                    {
                        type: 'call',
                        identifier: {
                            type: 'member',
                            identifier: 'toast',
                            object: null,
                        },
                        dependencies: [
                            {
                                type: 'expression',
                                dependencies: [
                                    {
                                        type: 'literal',
                                        value: 'literal',
                                    },
                                    {
                                        type: 'bot',
                                        name: 'tag',
                                        dependencies: [],
                                    },
                                    {
                                        type: 'call',
                                        identifier: {
                                            type: 'member',
                                            identifier: 'func',
                                            object: null,
                                        },
                                        dependencies: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'function',
                    name: 'toast',
                    dependencies: [
                        {
                            type: 'literal',
                            value: 'literal',
                        },
                        {
                            type: 'bot',
                            name: 'tag',
                            dependencies: [],
                        },
                        {
                            type: 'function',
                            name: 'func',
                            dependencies: [],
                        },
                    ],
                },
            ]);
        });

        it('should break up functions that have tag dependencies in their identifier', () => {
            const result = dependencies.simplify({
                type: 'expression',
                dependencies: [
                    {
                        type: 'call',
                        identifier: {
                            type: 'member',
                            identifier: 'abc',
                            object: {
                                type: 'tag',
                                name: 'test',
                                dependencies: [],
                            },
                        },
                        dependencies: [
                            {
                                type: 'member',
                                identifier: 'def',
                                object: null,
                            },
                        ],
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'tag',
                    name: 'test',
                    dependencies: [],
                },
                {
                    type: 'member',
                    name: 'def',
                },
            ]);
        });

        it('should include members that the tree is dependent on', () => {
            const result = dependencies.simplify({
                type: 'expression',
                dependencies: [
                    {
                        type: 'member',
                        identifier: 'abc',
                        object: {
                            type: 'member',
                            identifier: 'test',
                            object: null,
                        },
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'member',
                    name: 'test.abc',
                },
            ]);
        });

        const cases = [
            ['@ expressions', 'bot', '@'],
            ['# expressions', 'tag', '#'],
        ];
        describe.each(cases)('%s', (desc, type, symbol) => {
            it('should ignore member nodes when they are for tag/bot expressions', () => {
                const result = dependencies.simplify({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'abc',
                            object: {
                                type: 'member',
                                identifier: 'test',
                                object: {
                                    type: type,
                                    name: 'hello',
                                    dependencies: [],
                                },
                            },
                        },
                    ],
                });

                expect(result).toEqual([
                    {
                        type: type,
                        name: `hello`,
                        dependencies: [],
                    },
                ]);
            });

            it('should include dependencies', () => {
                const result = dependencies.simplify({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            name: 'hello',
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'isBuilder',
                                    object: null,
                                },
                                {
                                    type: 'call',
                                    identifier: {
                                        type: 'member',
                                        identifier: 'isBuilder',
                                        object: {
                                            type: 'member',
                                            identifier: 'player',
                                            object: null,
                                        },
                                    },
                                    dependencies: [],
                                },
                            ],
                        },
                    ],
                });

                expect(result).toEqual([
                    {
                        type: type,
                        name: `hello`,
                        dependencies: [
                            {
                                type: 'member',
                                name: 'isBuilder',
                            },
                            {
                                type: 'function',
                                name: 'player.isBuilder',
                                dependencies: [],
                            },
                        ],
                    },
                ]);
            });
        });
    });

    describe('getMemberName()', () => {
        it('should return the identifier', () => {
            const result = dependencies.getMemberName({
                type: 'member',
                identifier: 'abc',
                object: null,
            });

            expect(result).toBe('abc');
        });

        it('should return the identifiers joined by dots', () => {
            const result = dependencies.getMemberName({
                type: 'member',
                identifier: 'abc',
                object: {
                    type: 'member',
                    identifier: 'def',
                    object: null,
                },
            });

            expect(result).toBe('def.abc');
        });

        it('should handle call expressions', () => {
            const result = dependencies.getMemberName({
                type: 'member',
                identifier: 'abc',
                object: {
                    type: 'call',
                    identifier: {
                        type: 'member',
                        identifier: 'def',
                        object: null,
                    },
                    dependencies: [],
                },
            });

            expect(result).toBe('def.().abc');
        });

        const cases = [
            ['@ expressions', 'bot', '@'],
            ['# expressions', 'tag', '#'],
        ];

        describe.each(cases)('%s', (desc, type, symbol) => {
            it('should handle expressions', () => {
                const result = dependencies.getMemberName({
                    type: 'member',
                    identifier: 'abc',
                    object: {
                        type: 'member',
                        identifier: 'def',
                        object: {
                            type: type,
                            name: 'tag.abc',
                            dependencies: [],
                        },
                    },
                });

                expect(result).toBe(`tag.abc.def.abc`);
            });
        });
    });

    describe('replaceDependencies()', () => {
        it('should replace functions with the given expansions', () => {
            let replacements: AuxScriptReplacements = {
                getBotsInContext: (node: AuxScriptSimpleFunctionDependency) => [
                    {
                        type: 'bot',
                        name: 'test',
                        dependencies: [],
                    },
                ],
            };

            const result = dependencies.replaceDependencies(
                [
                    {
                        type: 'function',
                        name: 'getBotsInContext',
                        dependencies: [],
                    },
                ],
                replacements
            );

            expect(result).toEqual([
                {
                    type: 'bot',
                    name: 'test',
                    dependencies: [],
                },
            ]);
        });

        it('should not do any replacements on a replacement node', () => {
            let replacements: AuxScriptReplacements = {
                getBotsInContext: (node: AuxScriptSimpleFunctionDependency) => [
                    {
                        type: 'bot',
                        name: 'test',
                        dependencies: [],
                    },
                ],

                test: node => [
                    {
                        type: 'tag',
                        name: 'qwerty',
                        dependencies: [],
                    },
                ],
            };

            const result = dependencies.replaceDependencies(
                [
                    {
                        type: 'function',
                        name: 'getBotsInContext',
                        dependencies: [],
                    },
                ],
                replacements
            );

            expect(result).toEqual([
                {
                    type: 'bot',
                    name: 'test',
                    dependencies: [],
                },
            ]);
        });

        const nestedReplacementCases = [['function'], ['bot'], ['tag']];

        it.each(nestedReplacementCases)(
            'should replace dependencies in %s when it doesnt have a replacement',
            type => {
                let replacements: AuxScriptReplacements = {
                    myVar: (node: AuxScriptSimpleMemberDependency) => [
                        {
                            type: 'bot',
                            name: 'test',
                            dependencies: [],
                        },
                    ],
                };

                const result = dependencies.replaceDependencies(
                    [
                        {
                            type: type,
                            name: 'abc',
                            dependencies: [
                                {
                                    type: 'member',
                                    name: 'myVar',
                                },
                            ],
                        },
                    ],
                    replacements
                );

                expect(result).toEqual([
                    {
                        type: type,
                        name: 'abc',
                        dependencies: [
                            {
                                type: 'bot',
                                name: 'test',
                                dependencies: [],
                            },
                        ],
                    },
                ]);
            }
        );

        it('should work on complicated formulas', () => {
            const tree = dependencies.dependencyTree(
                'getBotTagValues("name").filter(a => a == "bob" || a == "alice").length + (player.isDesigner() ? 0 : 1)'
            );
            const simple = dependencies.simplify(tree);
            const replacements: AuxScriptReplacements = {
                'player.isDesigner': (
                    node: AuxScriptSimpleFunctionDependency
                ) => [
                    {
                        type: 'tag',
                        name: 'aux.designers',
                        dependencies: [],
                    },
                ],
            };
            const replaced = dependencies.replaceDependencies(
                simple,
                replacements
            );

            expect(replaced).toEqual([
                {
                    type: 'function',
                    name: 'getBotTagValues',
                    dependencies: [
                        {
                            type: 'literal',
                            value: 'name',
                        },
                    ],
                },
                {
                    type: 'member',
                    name: 'a',
                },
                {
                    type: 'literal',
                    value: 'bob',
                },
                {
                    type: 'member',
                    name: 'a',
                },
                {
                    type: 'literal',
                    value: 'alice',
                },
                {
                    type: 'tag',
                    name: 'aux.designers',
                    dependencies: [],
                },
                {
                    type: 'literal',
                    value: 0,
                },
                {
                    type: 'literal',
                    value: 1,
                },
            ]);
        });
    });

    describe('flatten()', () => {
        it('should flatten the given list of simplified dependencies', () => {
            const result = dependencies.flatten([
                {
                    type: 'member',
                    name: 'abc',
                },
                {
                    type: 'function',
                    name: 'func',
                    dependencies: [
                        {
                            type: 'bot',
                            name: 'bob',
                            dependencies: [],
                        },
                    ],
                },
                {
                    type: 'tag',
                    name: 'online',
                    dependencies: [
                        {
                            type: 'literal',
                            value: 123,
                        },
                    ],
                },
                {
                    type: 'bot',
                    name: 'online',
                    dependencies: [
                        {
                            type: 'function',
                            name: 'def',
                            dependencies: [
                                {
                                    type: 'member',
                                    name: 'this',
                                },
                            ],
                        },
                        {
                            type: 'tag',
                            name: 'qwerty',
                            dependencies: [],
                        },
                    ],
                },
                {
                    type: 'tag_value',
                    name: 'test',
                    dependencies: [{ type: 'this' }],
                },
            ]);

            expect(result).toEqual([
                {
                    type: 'member',
                    name: 'abc',
                },
                {
                    type: 'function',
                    name: 'func',
                    dependencies: [
                        {
                            type: 'bot',
                            name: 'bob',
                            dependencies: [],
                        },
                    ],
                },
                {
                    type: 'bot',
                    name: 'bob',
                    dependencies: [],
                },
                {
                    type: 'tag',
                    name: 'online',
                    dependencies: [
                        {
                            type: 'literal',
                            value: 123,
                        },
                    ],
                },
                {
                    type: 'literal',
                    value: 123,
                },
                {
                    type: 'bot',
                    name: 'online',
                    dependencies: [
                        {
                            type: 'function',
                            name: 'def',
                            dependencies: [
                                {
                                    type: 'member',
                                    name: 'this',
                                },
                            ],
                        },
                        {
                            type: 'tag',
                            name: 'qwerty',
                            dependencies: [],
                        },
                    ],
                },
                {
                    type: 'function',
                    name: 'def',
                    dependencies: [
                        {
                            type: 'member',
                            name: 'this',
                        },
                    ],
                },
                {
                    type: 'member',
                    name: 'this',
                },
                {
                    type: 'tag',
                    name: 'qwerty',
                    dependencies: [],
                },
                {
                    type: 'tag_value',
                    name: 'test',
                    dependencies: [{ type: 'this' }],
                },
                {
                    type: 'this',
                },
            ]);
        });
    });

    describe('replaceAuxDependencies()', () => {
        const botDependencyCases = [
            ['getBot()', 'getBot'],
            ['getBots()', 'getBot'],
        ];

        describe.each(botDependencyCases)('%s', (desc, name) => {
            it('should replace with a bot dependency on the given tag', () => {
                const tree = dependencies.dependencyTree(
                    `${name}("#name", "value")`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'bot',
                        name: 'name',
                        dependencies: [
                            {
                                type: 'literal',
                                value: 'value',
                            },
                        ],
                    },
                ]);
            });

            it('should return an all dependency when unable to determine the tag name', () => {
                const tree = dependencies.dependencyTree(
                    `${name}(myVar, "value")`
                );
                const simple = dependencies.simplify(tree);

                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'all',
                    },
                ]);
            });

            it('should replace inner dependencies', () => {
                const tree = dependencies.dependencyTree(
                    `${name}("#abc", ${name}("#def"))`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'bot',
                        name: 'abc',
                        dependencies: [
                            {
                                type: 'bot',
                                name: 'def',
                                dependencies: [],
                            },
                        ],
                    },
                ]);
            });

            it('should not replace if it is not a function call', () => {
                const tree = dependencies.dependencyTree(`${name}`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'member',
                        name: name,
                    },
                ]);
            });
        });

        describe('getBotTagValues()', () => {
            it('should replace with dependency on the the tag', () => {
                const tree = dependencies.dependencyTree(
                    `getBotTagValues('#abc')`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag',
                        name: 'abc',
                        dependencies: [],
                    },
                ]);
            });

            it('should return an all dependency when unable to determine the tag name', () => {
                const tree = dependencies.dependencyTree(
                    `getBotTagValues(this, myVar)`
                );
                const simple = dependencies.simplify(tree);

                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'all',
                    },
                ]);
            });

            it('should replace inner dependencies', () => {
                const tree = dependencies.dependencyTree(
                    `getBotTagValues("#abc", getBotTagValues("#def"))`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag',
                        name: 'abc',
                        dependencies: [
                            {
                                type: 'tag',
                                name: 'def',
                                dependencies: [],
                            },
                        ],
                    },
                ]);
            });

            it('should not replace if it is not a function call', () => {
                const tree = dependencies.dependencyTree(`getBotTagValues`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'member',
                        name: 'getBotTagValues',
                    },
                ]);
            });
        });

        describe('player.isDesigner()', () => {
            it('should replace with tag dependency on aux.designers', () => {
                const tree = dependencies.dependencyTree(`player.isDesigner()`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag',
                        name: 'aux.designers',
                        dependencies: [],
                    },
                ]);
            });

            it('should remove inner dependencies', () => {
                const tree = dependencies.dependencyTree(
                    `player.isDesigner(player.isDesigner("#def"))`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag',
                        name: 'aux.designers',
                        dependencies: [],
                    },
                ]);
            });

            it('should not replace if it is not a function call', () => {
                const tree = dependencies.dependencyTree(`player.isDesigner`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'member',
                        name: 'player.isDesigner',
                    },
                ]);
            });
        });

        describe('player.hasBotInInventory()', () => {
            // TODO: Improve to use a more restricted dependency style
            it('should replace with an all dependency', () => {
                const tree = dependencies.dependencyTree(
                    `player.hasBotInInventory(bot)`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'all',
                    },
                ]);
            });

            it('should not replace if it is not a function call', () => {
                const tree = dependencies.dependencyTree(
                    `player.hasBotInInventory`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'member',
                        name: 'player.hasBotInInventory',
                    },
                ]);
            });
        });

        const playerContextCases = [
            ['player.getMenuContext', 'aux._userMenuContext'],
            ['player.getInventoryContext', 'aux._userInventoryContext'],
            ['player.currentContext', 'aux._userContext'],
        ];

        describe.each(playerContextCases)('%s()', (name, tag) => {
            it(`should replace with a tag dependency on ${tag}`, () => {
                const tree = dependencies.dependencyTree(`${name}()`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag',
                        name: tag,
                        dependencies: [],
                    },
                ]);
            });

            it(`should remove inner dependencies`, () => {
                const tree = dependencies.dependencyTree(
                    `${name}(getBot('#abc'))`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag',
                        name: tag,
                        dependencies: [],
                    },
                ]);
            });

            it('should not replace if it is not a function call', () => {
                const tree = dependencies.dependencyTree(`${name}`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'member',
                        name: name,
                    },
                ]);
            });
        });

        describe('getTag()', () => {
            it('should replace with a tag value dependency', () => {
                const tree = dependencies.dependencyTree(
                    `getTag(myVar, '#abc.xyz')`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag_value',
                        name: 'abc.xyz',
                        dependencies: [{ type: 'member', name: 'myVar' }],
                    },
                ]);
            });

            it('should support multiple tags in a single call', () => {
                const tree = dependencies.dependencyTree(
                    `getTag(myVar, '#abc.xyz', '#test')`
                );
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'tag_value',
                        name: 'abc.xyz',
                        dependencies: [{ type: 'member', name: 'myVar' }],
                    },
                    {
                        type: 'tag_value',
                        name: 'test',
                        dependencies: [],
                    },
                ]);
            });

            it('should not replace if it is not a function call', () => {
                const tree = dependencies.dependencyTree(`getTag`);
                const simple = dependencies.simplify(tree);
                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'member',
                        name: 'getTag',
                    },
                ]);
            });

            // TODO: Update to return a bot dependency when we know which bot
            // to depend on.
            it('should return an all dependency when unable to determine the tag name', () => {
                const tree = dependencies.dependencyTree(`getTag(this, myVar)`);
                const simple = dependencies.simplify(tree);

                const replaced = dependencies.replaceAuxDependencies(simple);

                expect(replaced).toEqual([
                    {
                        type: 'all',
                    },
                ]);
            });
        });
    });

    describe('calculateAuxDependencies()', () => {
        const cases: any = [
            [
                'getBot("#tag")',
                [
                    {
                        type: 'bot',
                        name: 'tag',
                        dependencies: [],
                    },
                ],
            ],
        ];

        it.each(cases)('%s', (formula, expected) => {
            const tags = dependencies.calculateAuxDependencies(formula);
            expect(tags).toEqual(expected);
        });

        it('should return tag_value dependencies', () => {
            const deps = dependencies.calculateAuxDependencies(
                'getTag(abc, "#def")'
            );

            expect(deps).toEqual([
                {
                    type: 'tag_value',
                    name: 'def',
                    dependencies: [{ type: 'member', name: 'abc' }],
                },
            ]);
        });

        it('should return an empty array when there is a syntax error', () => {
            const deps = dependencies.calculateAuxDependencies('getTag(abc');

            expect(deps).toEqual([]);
        });
    });
});
