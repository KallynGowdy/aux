import { FilesState } from "../Files";
import { RealtimeCausalTree, RealtimeChannel, AtomOp, storedTree, site, Atom } from "../causal-trees";
import { auxCausalTreeFactory } from "./AuxCausalTreeFactory";
import { TestCausalTreeStore } from "../causal-trees/test/TestCausalTreeStore";
import { TestChannelConnection } from "../causal-trees/test/TestChannelConnection";
import { fileChangeObservables, getAtomFile, insertIntoTagName } from "./AuxTreeCalculations";
import { AuxCausalTree } from "./AuxCausalTree";
import { TestScheduler } from 'rxjs/testing';
import { AsyncScheduler } from "rxjs/internal/scheduler/AsyncScheduler";
import { tap } from "rxjs/operators";

describe('AuxTreeCalculations', () => {

    describe('getAtomFile()', () => {
        it('should get the file that the given tag is under', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            const file = await tree.file('test');
            const test = await tree.tag('test', file);
            const val = await tree.val('123', test);

            const result = getAtomFile(tree.weave, val);

            expect(result).toBe(file);
        });

        it('should handle file deletions', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = await tree.root();
            const file = await tree.file('test');
            const del = await tree.delete(file);

            const result = getAtomFile(tree.weave, del);

            expect(result).toBe(file);
        });

        it('should return null if it is not childed to a file', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = await tree.root();
            const file = await tree.file('test');
            const test = await tree.tag('test', file);
            const val = await tree.val('123', test);

            const result = getAtomFile(tree.weave, root);

            expect(result).toBe(null);
        });
    });
     
    describe('fileChangeObservables()', () => {
        let scheduler: TestScheduler;

        beforeEach(() => {
            scheduler = new TestScheduler((actual, expected) => {
                expect(actual).toEqual(expected);
            });
            AsyncScheduler.delegate = scheduler;
        });

        afterEach(() => {
            AsyncScheduler.delegate = null;
        });

        it('should sort added files so workspaces are first', async () => {
            
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<Atom<AtomOp>[]>({
                id: 'test',
                type: 'aux'
            }, connection);
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);
            
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            
            await store.put('test', stored.export());
            await tree.init();
            await connection.flushPromises();
            
            const { fileAdded } = fileChangeObservables(tree);
            
            const fileIds: string[] = [];
            const errorHandler = jest.fn();
            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            }, errorHandler);

            await tree.tree.file('abc');
            await tree.tree.file('def');

            scheduler.flush();

            expect(fileIds).toEqual([
                'abc',
                'def'
            ]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send a diff for the current files', async () => {
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<Atom<AtomOp>[]>({
                id: 'test',
                type: 'aux'
            }, connection); 
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);

            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            await stored.file('test');
            await stored.file('zdf');

            await store.put('test', stored.export());
            await tree.init();
            await connection.flushPromises();
            scheduler.flush();

            const fileIds: string[] = [];
            const { fileAdded } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            }, errorHandler);


            expect(fileIds).toEqual([
                'test',
                'zdf'
            ]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should handle multiple files with the same ID getting added', async () => {
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<Atom<AtomOp>[]>({
                id: 'test',
                type: 'aux'
            }, connection); 
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);

            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const test1 = await stored.file('test');
            const test2 = await stored.file('test');

            await store.put('test', stored.export());
            await tree.init();
            await connection.flushPromises();
            scheduler.flush();

            const fileIds: string[] = [];
            const { fileAdded } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            }, errorHandler);

            expect(fileIds).toEqual([
                'test'
            ]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should handle deleted files', async () => {
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<Atom<AtomOp>[]>({
                id: 'test',
                type: 'aux'
            }, connection); 
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);

            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const file = await stored.file('test');
            const update = await stored.tag('abc', file);
            const deleted = await stored.delete(file);

            await store.put('test', stored.export());
            await tree.init();
            await connection.flushPromises();
            scheduler.flush();

            const fileIds: string[] = [];
            const updatedFiles: string[] = [];
            const { fileAdded, fileUpdated } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            fileAdded.pipe(tap(file => fileIds.push(file.id)))
                .subscribe(null, errorHandler);
            fileUpdated.pipe(tap(file => updatedFiles.push(file.id)))
                .subscribe(null, errorHandler);

            expect(fileIds).toEqual([]);
            expect(updatedFiles).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send file deleted events', async () => {
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<Atom<AtomOp>[]>({
                id: 'test',
                type: 'aux'
            }, connection); 
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);

            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const file = await stored.file('test');

            await store.put('test', stored.export());
            await tree.init();
            await connection.flushPromises();

            scheduler.flush();
            
            const fileIds: string[] = [];
            const updatedFiles: string[] = [];
            const removedFiles: string[] = [];
            const { fileAdded, fileUpdated, fileRemoved } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            fileAdded.pipe(tap(file => fileIds.push(file.id)))
                .subscribe(null, errorHandler);
            fileUpdated.pipe(tap(file => updatedFiles.push(file.id)))
                .subscribe(null, errorHandler);
            fileRemoved.pipe(tap(file => removedFiles.push(file)))
                .subscribe(null, errorHandler);

            const del = await tree.tree.delete(file);

            expect(fileIds).toEqual([
                'test'
            ]);
            expect(updatedFiles).toEqual([]);
            expect(removedFiles).toEqual([
                'test'
            ]);
            expect(errorHandler).not.toBeCalled();
        });
    });
});