/**
 * Enumeration of file types. The types `File` and `Directory` can also be
 * a symbolic links, in that case use `FileType.File | FileType.SymbolicLink` and
 * `FileType.Directory | FileType.SymbolicLink`.
 */
const FileType = {
    /**
     * The file type is unknown.
     */
    Unknown: 0,
    /**
     * A regular file.
     */
    File: 1,
    /**
     * A directory.
     */
    Directory: 2,
    /**
     * A symbolic link to a file.
     */
    SymbolicLink: 64,
};

/**
 * An event emitter can be used to create and manage an [event](#Event) for others
 * to subscribe to. One emitter always owns one event.
 *
 * Use this class if you want to provide event from within your extension, for instance
 * inside a [TextDocumentContentProvider](#TextDocumentContentProvider) or when providing
 * API to other extensions.
 */
class EventEmitter {
    listeners = [];
    disposables = [];

    /**
     * The event listeners can subscribe to.
     */
    event(listener, thisArgs, disposables) {
        this.listeners.push(listener.bind(thisArgs));

        let disposed = false;
        let disposable = {
            dispose: () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                const listenerIndex = this.listeners.indexOf(listener);
                if (listenerIndex >= 0) {
                    this.listeners.splice(listenerIndex, 1);
                }
                const disposableIndex = this.disposables.indexOf(disposable);
                if (disposableIndex >= 0) {
                    this.disposables.splice(disposableIndex, 1);
                }
                if (disposables) {
                    disposables.forEach((d) => d.dispose());
                }
            },
        };

        this.disposables.push(disposable);

        return disposable;
    }

    /**
     * Notify all subscribers of the [event](#EventEmitter.event). Failure
     * of one or more listener will not fail this function call.
     *
     * @param data The event object.
     */
    fire(data) {
        this.listeners.forEach((l) => l(data));
    }

    /**
     * Dispose this object and free resources.
     */
    dispose() {
        let disposables = this.disposables.slice();
        disposables.forEach((d) => d.dispose());
    }
}

module.exports = {
    FileType,
    EventEmitter,
};
