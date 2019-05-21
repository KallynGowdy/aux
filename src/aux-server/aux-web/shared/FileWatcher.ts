import {
    RealtimeAuxTree,
    AuxFile,
    fileChangeObservables,
    File,
    AuxObject,
    FilesState,
    AuxState,
} from '@casual-simulation/aux-common';
import { FileHelper } from './FileHelper';
import {
    ReplaySubject,
    Subject,
    Observable,
    SubscriptionLike,
    BehaviorSubject,
    merge,
    from,
} from 'rxjs';
import { flatMap, filter, startWith, tap } from 'rxjs/operators';
import { values } from 'd3';

/**
 * Defines a class that can watch a realtime causal tree.
 */
export default class FileWatcher implements SubscriptionLike {
    private _updatedState: AuxState = {};

    private _filesDiscoveredObservable: Subject<AuxFile[]>;
    private _filesRemovedObservable: Subject<string[]>;
    private _filesUpdatedObservable: Subject<AuxFile[]>;
    private _subs: SubscriptionLike[] = [];

    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever a new file is discovered.
     * That is, it was created or added by another user.
     */
    get filesDiscovered(): Observable<AuxFile[]> {
        return this._filesDiscoveredObservable.pipe(
            startWith(values(this._updatedState))
        );
    }

    /**
     * Gets an observable that resolves whenever a file is removed.
     * That is, it was deleted from the working directory either by checking out a
     * branch that does not contain the file or by deleting it.
     */
    get filesRemoved(): Observable<string[]> {
        return this._filesRemovedObservable;
    }

    /**
     * Gets an observable that resolves whenever a file is updated.
     */
    get filesUpdated(): Observable<AuxFile[]> {
        return this._filesUpdatedObservable;
    }

    /**
     * Creates a new file watcher.
     * @param helper The file helper.
     * @param selection The selection manager.
     * @param filesAdded The observable that is called whenever a new file is added.
     * @param filesRemoved The observable that is called whenever a file is removed.
     * @param filesUpdated The observable that is called whenever a file is updated.
     */
    constructor(
        filesAdded: Observable<AuxFile[]>,
        filesRemoved: Observable<string[]>,
        filesUpdated: Observable<AuxFile[]>
    ) {
        this._filesDiscoveredObservable = new Subject<AuxFile[]>();
        this._filesRemovedObservable = new Subject<string[]>();
        this._filesUpdatedObservable = new Subject<AuxFile[]>();

        this._subs.push(
            filesAdded
                .pipe(
                    tap(files => {
                        for (let file of files) {
                            this._updatedState[file.id] = file;
                        }
                    })
                )
                .subscribe(this._filesDiscoveredObservable),
            filesRemoved
                .pipe(
                    tap(fileIds => {
                        for (let id of fileIds) {
                            delete this._updatedState[id];
                        }
                    })
                )
                .subscribe(this._filesRemovedObservable),
            filesUpdated
                .pipe(
                    tap(files => {
                        for (let file of files) {
                            this._updatedState[file.id] = file;
                        }
                    })
                )
                .subscribe(this._filesUpdatedObservable)
        );
    }

    /**
     * Creates an observable that resolves whenever the given file changes.
     * @param file The file to watch.
     */
    fileChanged(file: AuxObject): Observable<AuxObject> {
        return this.filesUpdated.pipe(
            flatMap(files => files),
            filter(f => f.id === file.id),
            startWith(file)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach(s => s.unsubscribe());
            this._subs = null;
        }
    }
}
