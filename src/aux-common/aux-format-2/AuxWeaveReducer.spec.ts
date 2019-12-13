import { AuxOp, bot, tag, value, del, AuxOpType } from './AuxOpTypes';
import {
    Atom,
    atom,
    atomId,
    Weave,
} from '@casual-simulation/causal-trees/core2';
import reduce from './AuxWeaveReducer';
import { BotsState } from '../bots/Bot';
import { apply } from './AuxStateHelpers';
import { isBot } from '../bots';

describe('AuxWeaveReducer', () => {
    let weave: Weave<AuxOp>;
    let state: BotsState;

    beforeEach(() => {
        weave = new Weave();
        state = {};
    });

    function add(...atoms: Atom<AuxOp>[]): BotsState {
        for (let atom of atoms) {
            let update = reduce(weave, weave.insert(atom));
            state = apply(state, update);
        }
        return state;
    }

    function remove(...atoms: Atom<AuxOp>[]): BotsState {
        for (let atom of atoms) {
            let update = reduce(weave, weave.remove(atom));
            state = apply(state, update);
        }
        return state;
    }

    describe('atom_added', () => {
        describe('bot', () => {
            it('should calculate the File ID from the Atom ID', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                state = add(bot1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should do nothing for bot atoms with a non-null cause', () => {
                const b1 = atom(atomId('b', 1), null, bot('test1'));
                const bot1 = atom(atomId('a', 2), b1, bot('test2'));

                state = add(b1, bot1);
                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {},
                    },
                });
            });

            it('should preserve the existing bot if a duplicate is added', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const bot1B = atom(atomId('a', 4), null, bot('test1'));
                const tag1B = atom(atomId('a', 5), bot1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            abc: 'def',
                            num: 1,
                        },
                    },
                });
            });

            it('should gracefully handle duplicate bots with duplicate tags', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const bot1B = atom(atomId('a', 4), null, bot('test1'));
                const tag1B = atom(atomId('a', 5), bot1B, tag('abc'));
                const value1B = atom(atomId('a', 6), tag1B, value('different'));

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            abc: 'different',
                        },
                    },
                });
            });

            it('should gracefully handle duplicate bots when the first bot is deleted', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));
                const del1A = atom(atomId('a', 4), bot1A, del());

                const bot1B = atom(atomId('a', 5), null, bot('test1'));
                const tag1B = atom(atomId('a', 6), bot1B, tag('abc'));
                const value1B = atom(atomId('a', 7), tag1B, value('different'));

                state = add(bot1A, tag1A, value1A, del1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            abc: 'different',
                        },
                    },
                });
            });
        });

        describe('delete', () => {
            it('should remove the bot from the state', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const delete1 = atom(atomId('a', 2), bot1, del());
                state = add(bot1, delete1);

                expect(state).toEqual({});
            });

            it('should ignore deletes whose cause is null', () => {
                const delete1 = atom(atomId('a', 2), null, del());
                state = add(delete1);

                expect(state).toEqual({});
            });

            it('should ignore deletes that are not the first child of the bot', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const delete1 = atom(atomId('a', 2), bot1, del());
                const tag1 = atom(atomId('a', 3), bot1, tag('test'));
                state = add(bot1, tag1, delete1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should not touch other bots', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test1'));
                const bot2 = atom(atomId('a', 2), null, bot('test2'));
                const delete1 = atom(atomId('a', 3), bot1, del());

                state = add(bot1, bot2, delete1);

                expect(state).toEqual({
                    ['test2']: {
                        id: 'test2',
                        tags: {},
                    },
                });
            });

            it('should only delete a bot if all bot atoms are deleted', () => {
                const bot1A = atom(atomId('b', 100), null, bot('test2'));
                const tag1A = atom(atomId('b', 101), bot1A, tag('tag1'));
                const val1A = atom(atomId('b', 102), tag1A, value('val1A'));

                const bot1B = atom(atomId('b', 110), null, bot('test2'));
                const tag1B = atom(atomId('b', 111), bot1B, tag('tag1'));
                const val1B = atom(atomId('b', 112), tag1B, value('val1B'));
                const del1B = atom(atomId('b', 113), bot1B, del());

                state = add(bot1A, tag1A, val1A);
                state = add(bot1B, tag1B, val1B);

                expect(state).toEqual({
                    ['test2']: {
                        id: 'test2',
                        tags: {
                            tag1: 'val1B',
                        },
                    },
                });

                state = add(del1B);

                expect(state).toEqual({
                    ['test2']: {
                        id: 'test2',
                        tags: {
                            // TODO: Fix so that it reverts to the first bot version
                            // upon delete of the second bot version.
                            tag1: 'val1B',
                        },
                    },
                });
            });

            // TODO: Add support for deleting spans of text from values/inserts.
            it.skip('should remove the span of text from the tag value', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag'));
                const value1 = atom(atomId('a', 3), tag1, value('abcdef'));
                const delete1 = atom(atomId('a', 2), value1, del(0, 2));
                state = add(bot1, tag1, value1, delete1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            tag: 'def',
                        },
                    },
                });
            });
        });

        describe('tag', () => {
            it('should do nothing', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));

                state = add(bot1, tag1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });
        });

        describe('value', () => {
            it('should set the tag value', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));

                state = add(bot1, tag1, value1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should preserve values with timestamps after the new atom', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('haha'));

                state = add(bot1, tag1, value2, value1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'haha',
                        },
                    },
                });
            });

            it('should use last write wins for new tag values', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('haha'));

                state = add(bot1, tag1, value1, value2);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'haha',
                        },
                    },
                });
            });

            let deleteValueCases = [
                ['null', null],
                ['undefined', undefined],
                ['empty string', ''],
            ];

            it.each(deleteValueCases)(
                'should delete tags with %s values',
                (desc, val) => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value(val));

                    state = add(bot1, tag1, value1, value2);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {},
                        },
                    });
                }
            );

            let preserveValueCases = [
                ['0', 0],
                ['false', false],
                ['whitespace', ' '],
            ];

            it.each(preserveValueCases)(
                'should preserve tags with %s values',
                (desc, val) => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value(val));

                    state = add(bot1, tag1, value1, value2);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: val,
                            },
                        },
                    });
                }
            );

            let invalidTagNameCases = [
                ['empty', ''],
                ['null', null],
                ['undefined', undefined],
            ];
            it.each(invalidTagNameCases)(
                'should ignore tags with %s names',
                (desc, name) => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag(name));
                    const value1 = atom(atomId('a', 3), tag1, value('haha'));

                    state = add(bot1, tag1, value1);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {},
                        },
                    });
                }
            );

            it('should preserve other tag values when deleting a tag', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 6), tag1, value(null));

                const otherTag1 = atom(atomId('a', 4), bot1, tag('test'));
                const otherValue1 = atom(
                    atomId('a', 5),
                    otherTag1,
                    value(true)
                );

                state = add(bot1, tag1, value1, otherTag1, otherValue1, value2);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            test: true,
                        },
                    },
                });
            });

            it('should ignore values whose direct cause is nonexistent', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const value1 = atom(atomId('a', 3), bot1, value('haha'));

                state = add(bot1, value1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should ignore values whose grantgause is nonexistent', () => {
                const tag1 = atom(atomId('a', 1), null, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('haha'));

                state = add(tag1, value1);

                expect(state).toEqual({});
            });

            it('should ignore values whose cause is not a tag', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test1'));
                const tag1 = atom(atomId('a', 2), bot1, bot('test2'));
                const value1 = atom(atomId('a', 3), tag1, value('haha'));

                state = add(bot1, tag1, value1);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {},
                    },
                });
            });

            it('should ignore values whose grandcause is not a bot', () => {
                const bot1 = atom(atomId('a', 1), null, tag('test1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('test2'));
                const value1 = atom(atomId('a', 3), tag1, value('haha'));

                state = add(bot1, tag1, value1);

                expect(state).toEqual({});
            });

            it('should ignore values when the bot is deleted', () => {
                const bot1 = atom(atomId('a', 1), null, bot('bot'));
                const tag1 = atom(atomId('a', 2), bot1, tag('test'));
                const delete1 = atom(atomId('a', 3), bot1, del());
                const value1 = atom(atomId('a', 4), tag1, value('haha'));

                state = add(bot1, tag1, delete1, value1);

                expect(state).toEqual({});
            });
        });

        // TODO: Add support for inserts
    });

    describe('atom_removed', () => {
        describe('bot', () => {
            it('should remove the bot from the state', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                weave.insert(bot1);
                const update = reduce(weave, weave.remove(bot1));

                expect(update).toEqual({
                    ['test']: null,
                });
            });
        });

        describe('value', () => {
            it('should remove the value from the state', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));

                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);

                const update = reduce(weave, weave.remove(value1));

                expect(update).toEqual({
                    ['test']: {
                        tags: {
                            abc: null,
                        },
                    },
                });
            });

            it('should use the remaining value as the new value for the tag', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('removed'));

                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);
                weave.insert(value2);

                const update = reduce(weave, weave.remove(value2));

                expect(update).toEqual({
                    ['test']: {
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should support removing multiple value atoms at a time', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('removed'));
                const value3 = atom(atomId('a', 5), tag1, value('removed2'));

                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);
                weave.insert(value2);
                weave.insert(value3);

                const update = reduce(
                    weave,
                    weave.removeSiblingsBefore(value3)
                );

                expect(update).toEqual({});
            });
        });
    });

    describe('conflict', () => {
        describe('bot', () => {
            it('should replace the old bot with the updated bot in a conflict', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                // Produces a conflict where bot1B is chosen over bot1A
                const bot1B = atom(atomId('a', 1), null, {
                    type: 1,
                    id: 'test1',
                    extra: 'abcdefghij',
                });

                const hashes = [bot1B.hash, bot1A.hash].sort();
                expect(hashes).toEqual([bot1B.hash, bot1A.hash]);

                const tag1B = atom(atomId('a', 5), bot1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                // The IDs are the same
                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            num: 1,
                        },
                    },
                });
            });

            it('should keep the existing bot if it was chosen', () => {
                // Produces a conflict where bot1A is chosen over bot1B
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const bot1B = atom(atomId('a', 1), null, {
                    type: 1,
                    id: 'test',
                    extra: 'abcde',
                });
                const tag1B = atom(atomId('a', 5), bot1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                const hashes = [bot1B.hash, bot1A.hash].sort();
                expect(hashes).toEqual([bot1A.hash, bot1B.hash]);

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });
        });

        describe('tag', () => {
            it('should remove the old tag and value', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('test'));

                const hashes = [tag1B.hash, tag1A.hash].sort();
                expect(hashes).toEqual([tag1B.hash, tag1A.hash]);

                state = add(bot1A, tag1A, value1A, tag1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should add the new tag value', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('test'));
                const value1B = atom(atomId('a', 3), tag1B, value(123));

                state = add(bot1A, tag1A, value1A, tag1B, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            test: 123,
                        },
                    },
                });
            });

            it('should keep the old tag if it wasnt replaced', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('test'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('abc'));

                state = add(bot1A, tag1A, value1A, tag1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            test: 'def',
                        },
                    },
                });
            });

            it('should not touch other tags', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('test'));

                const tag2 = atom(atomId('a', 4), bot1A, tag('hehe'));
                const value2 = atom(atomId('a', 5), tag2, value(false));

                state = add(bot1A, tag1A, value1A, tag2, value2, tag1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            hehe: false,
                        },
                    },
                });
            });
        });

        describe('value', () => {
            it('should replace the old value with the new one', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const value1B = atom(atomId('a', 3), tag1A, value('1234'));

                const hashes = [value1A.hash, value1B.hash].sort();
                expect(hashes).toEqual([value1B.hash, value1A.hash]);

                state = add(bot1A, tag1A, value1A, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: '1234',
                        },
                    },
                });
            });

            it('should ignore the conflict when the replaced value is not the newest', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));
                const value2A = atom(atomId('a', 4), tag1A, value('real'));

                const value1B = atom(atomId('a', 3), tag1A, value('123'));

                state = add(bot1A, tag1A, value1A, value2A, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'real',
                        },
                    },
                });
            });

            it('should keep the existing value if it was not replaced', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('1234'));

                const value1B = atom(atomId('a', 3), tag1A, value('def'));

                const hashes = [value1A.hash, value1B.hash].sort();
                expect(hashes).toEqual([value1A.hash, value1B.hash]);

                state = add(bot1A, tag1A, value1A, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: '1234',
                        },
                    },
                });
            });
        });

        describe('delete', () => {
            it('should keep the bot deleted', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const delete1A = atom(atomId('a', 2), bot1, {
                    type: 4,
                    extra: 'haha',
                });
                const delete1B = atom(atomId('a', 2), bot1, del());
                state = add(bot1, delete1A, delete1B);

                expect(state).toEqual({});
            });
        });
    });
});
