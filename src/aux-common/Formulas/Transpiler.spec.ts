import { Transpiler } from './Transpiler';

describe('Transpiler', () => {
    describe('transpile()', () => {
        const cases = [
            [
                'should convert @tag to _listObjectsWithTag(tag)',
                '@tag',
                '_listObjectsWithTag("tag");',
            ],
            [
                'should convert @tag.nested to _listTagValues(tag.nested)',
                '@tag.nested',
                '_listObjectsWithTag("tag.nested");',
            ],
            [
                'should convert #tag to _listTagValues(tag)',
                '#tag',
                '_listTagValues("tag");',
            ],
        ];
        it.each(cases)('%s', (description, code, expected) => {
            const transpiler = new Transpiler();
            const result = transpiler.transpile(code);
            expect(result.trim()).toBe(expected);
        });
    });

    describe('dependencies()', () => {
        const cases = [
            ['@ expressions', 'object', '@'],
            ['# expressions', 'tag', '#'],
        ];

        describe.each(cases)('%s', (desc, type, symbol) => {
            it(`should return the tags`, () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag().num + ${symbol}other().num`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: [],
                    },
                    {
                        type: type,
                        name: 'other',
                        args: [],
                    },
                ]);
            });

            it('should support dots in tag names', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag.test().num`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag.test',
                        args: [],
                    },
                ]);
            });

            it('should contain the simple arguments used in the expression', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag("hello, world", 123)`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: ['"hello, world"', '123'],
                    },
                ]);
            });

            it('should contain the complex arguments used in the expression', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag(x => x.indexOf("hi") >= 0)`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: ['x => x.indexOf("hi") >= 0'],
                    },
                ]);
            });
        });
    });
});
