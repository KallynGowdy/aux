import { DependencyManager } from './DependencyManager';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('DependencyManager', () => {
    describe('addFile()', () => {
        it('should add all of the given files tags to the tag map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    tag: 123,
                    other: 'cool',
                })
            );

            subject.addFile(tree.value['test']);
            subject.addFile(tree.value['test2']);

            const tags = subject.getTagMap();

            expect(tags).toEqual(
                new Map([
                    ['tag', ['test', 'test2']],
                    ['hello', ['test']],
                    ['other', ['test2']],
                ])
            );
        });

        it('should add the files to the file map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    tag: 123,
                    other: 'cool',
                })
            );

            subject.addFile(tree.value['test']);
            subject.addFile(tree.value['test2']);

            const map = subject.getFileMap();

            // Should sort tags alphabetically
            expect(map).toEqual(
                new Map([
                    ['test', ['hello', 'tag']],
                    ['test2', ['other', 'tag']],
                ])
            );
        });

        it('should be able to retrieve tag the dependencies the file has', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    sum: '=math.sum(#num)',
                    numObjs: '=math.sum(@num().length, @sum().length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependencies('test');

            expect(deps).toEqual({
                sum: [{ type: 'tag', name: 'num', members: [], args: [] }],
                numObjs: [
                    {
                        type: 'file',
                        name: 'num',
                        members: ['length'],
                        args: [],
                    },
                    {
                        type: 'file',
                        name: 'sum',
                        members: ['length'],
                        args: [],
                    },
                ],
                extra: [
                    { type: 'this', members: ['sum'] },
                    { type: 'this', members: ['num'] },
                ],
            });
        });

        it('should be able to retrieve the dependents for a tag update on another file', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    sum: '=math.sum(#num)',
                    numObjs: '=math.sum(@num().length, @sum().length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependents('num');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs']),
            });
        });

        it('should be able to retrieve the dependents for a tag update on itself', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    sum: '=math.sum(#num)',
                    numObjs: '=math.sum(@num().length, @sum().length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependents('num', 'test');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs', 'extra']),
            });
        });

        it('should handle this references by adding a reference for each group of members', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    extra: '=this.aux.label.color',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependentMap();

            expect(deps).toEqual(
                new Map([
                    [
                        'test:aux',
                        {
                            test: new Set(['extra']),
                        },
                    ],
                    [
                        'test:aux.label',
                        {
                            test: new Set(['extra']),
                        },
                    ],
                    [
                        'test:aux.label.color',
                        {
                            test: new Set(['extra']),
                        },
                    ],
                ])
            );
        });
    });

    describe('removeFile()', () => {
        it('should remove all the tags for the given file', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                    other: '=@sum',
                })
            );

            subject.addFile(tree.value['test']);

            // Should still remove the 'hello' tag.
            subject.removeFile(
                createFile('test', {
                    tag: 123,
                })
            );

            const tags = subject.getTagMap();
            const files = subject.getFileMap();
            const dependencies = subject.getDependencies('test');
            const dependents = subject.getDependents('sum', 'test');

            expect(tags).toEqual(
                new Map([['tag', []], ['hello', []], ['other', []]])
            );
            expect(files).toEqual(new Map([]));
            expect(dependencies).toBe(undefined);
            expect(dependents).toEqual({});
        });
    });

    describe('updateFile()', () => {
        it('should add new tags to the tag map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            subject.addFile(tree.value['test']);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    hello: null,
                    newTag: 123,
                },
            });

            subject.updateFile({
                file: tree.value['test'],
                tags: ['hello', 'newTag'],
            });

            const tags = subject.getTagMap();
            const files = subject.getFileMap();

            expect(tags).toEqual(
                new Map([
                    ['tag', ['test']],
                    ['hello', []],
                    ['newTag', ['test']],
                ])
            );
            expect(files).toEqual(new Map([['test', ['newTag', 'tag']]]));
        });

        it('should update the file dependencies', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: '=this.sum',
                    sum: '=#abc',
                    hello: '=#world',
                })
            );

            subject.addFile(tree.value['test']);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    hello: null,
                    sum: '=#other',
                    newTag: '=@num',
                },
            });

            subject.updateFile({
                file: tree.value['test'],
                tags: ['hello', 'sum', 'newTag'],
            });

            const dependencies = subject.getDependencies('test');
            const dependents = subject.getDependentMap();

            expect(dependencies).toEqual({
                sum: [{ type: 'tag', name: 'other', args: [], members: [] }],
                newTag: [{ type: 'file', name: 'num', args: [], members: [] }],
                tag: [{ type: 'this', members: ['sum'] }],
            });

            expect(dependents).toEqual(
                new Map([
                    [
                        'num',
                        {
                            test: new Set(['newTag']),
                        },
                    ],
                    [
                        'test:sum',
                        {
                            test: new Set(['tag']),
                        },
                    ],
                    [
                        'other',
                        {
                            test: new Set(['sum']),
                        },
                    ],
                    ['world', {}],
                    ['abc', {}],
                ])
            );
        });
    });
});
