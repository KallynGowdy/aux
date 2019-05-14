import { FileHelper } from './FileHelper';
import {
    File,
    doFilesAppearEqual,
    createFile,
    merge,
    tagsOnFile,
    isDiff,
    isTagWellKnown,
    AuxObject,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';
import { keys } from 'd3';

export interface RecentsUpdatedEvent {
    recentFiles: File[];
    selectedRecentFile: File;
}

/**
 * Defines a class that helps manage recent files.
 */
export class RecentFilesManager {
    private _helper: FileHelper;
    private _onUpdated: Subject<RecentsUpdatedEvent>;
    private _selectedRecentFile: File = null;

    /**
     * The files that have been stored in the recent files manager.
     */
    files: File[];

    /**
     * The maximum number of files that the recents list can contain.
     */
    maxNumberOfFiles: number = 1;

    /**
     * Gets an observable that resolves whenever the files list has been updated.
     */
    get onUpdated(): Observable<RecentsUpdatedEvent> {
        return this._onUpdated;
    }

    /**
     * Gets the file that was selected from the recents list.
     */
    get selectedRecentFile() {
        return this._selectedRecentFile;
    }

    /**
     * Sets the file that was selected from the recents list.
     */
    set selectedRecentFile(file: File) {
        this._selectedRecentFile = file;
        this._onUpdated.next();
    }

    /**
     * Creates a new RecentFilesManager.
     * @param helper The file helper.
     */
    constructor(helper: FileHelper) {
        this._helper = helper;
        this._onUpdated = new Subject<RecentsUpdatedEvent>();
        this.files = [createFile('empty')];
    }

    /**
     * Adds a diffball that represents the given file ID, tag, and value.
     * @param fileId The ID of the file that the diff represents.
     * @param tag The tag that the diff contains.
     * @param value The value that the diff contains.
     */
    addTagDiff(fileId: string, tag: string, value: any) {
        this._cleanFiles(fileId);
        this.files.unshift({
            id: fileId,
            tags: {
                [tag]: value,
                'aux._diff': true,
                'aux._diffTags': [tag],
            },
        });
        this._trimList();
        this._updateSelectedRecentFile();
        this._updated();
    }

    /**
     * Adds the given file to the recents list.
     * @param file The file to add.
     * @param updateTags Whether to update the diff tags.
     */
    addFileDiff(file: File, updateTags: boolean = false) {
        let id: string;
        if (isDiff(file)) {
            id = file.id;
        } else {
            id = `diff-${file.id}`;
        }
        this._cleanFiles(id, file);
        let { 'aux._diff': diff, 'aux._diffTags': t, ...others } = file.tags;

        const f = merge(file, {
            id: id,
            tags: {
                'aux._diff': true,
                'aux._diffTags':
                    updateTags || !t
                        ? keys(others).filter(t => !isTagWellKnown(t))
                        : t,
            },
        });
        this.files.unshift(f);
        this._trimList();
        this._updateSelectedRecentFile();
        this._updated();
    }

    private _updateSelectedRecentFile() {
        if (this.selectedRecentFile) {
            let file = this.files.find(
                f => f.id === this.selectedRecentFile.id
            );
            this.selectedRecentFile = file || null;
        }
    }

    /**
     * Clears the files list.
     */
    clear() {
        this.files = [createFile('empty')];
        this._updated();
    }

    private _cleanFiles(fileId: string, file?: File) {
        for (let i = this.files.length - 1; i >= 0; i--) {
            let f = this.files[i];

            if (f.id === fileId || (file && doFilesAppearEqual(file, f))) {
                this.files.splice(i, 1);
            }
        }
    }

    private _trimList() {
        if (this.files.length > this.maxNumberOfFiles) {
            this.files.length = this.maxNumberOfFiles;
        }
    }

    private _updated() {
        this._onUpdated.next({
            recentFiles: this.files,
            selectedRecentFile: this.selectedRecentFile,
        });
    }
}
