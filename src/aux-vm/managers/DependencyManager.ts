import FileWatcher from './FileWatcher';

/**
 * Defines a class that is able to track dependencies between files.
 */
export class DependencyManager {
    private _watcher: FileWatcher;

    constructor(watcher: FileWatcher) {
        this._watcher = watcher;
    }
}
