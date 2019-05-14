import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import {
    AuxObject,
    getFileConfigContexts,
    Object,
    File,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';

export class BuilderSimulation3D extends Simulation3D {
    recentFiles: Object[] = [];
    selectedRecentFile: Object = null;

    async init() {
        await super.init();

        this.recentFiles = await this.simulation.getRecentFiles();

        this._subs.push(
            this.simulation.recentsUpdated.subscribe(e => {
                this.recentFiles = e.recentFiles;
                this.selectedRecentFile = e.selectedRecentFile;
            })
        );
    }

    async clearRecentFiles() {
        await this.simulation.clearRecents();
    }

    async selectRecentFile(file: File) {
        const selected = await this.simulation.getSelectedRecentFile();
        if (!selected || selected.id !== file.id) {
            await this.simulation.setSelectedRecentFile(file);
            await this.simulation.clearSelection();
        } else {
            await this.simulation.setSelectedRecentFile(null);
        }
    }

    protected _createContext(
        calc: AsyncCalculationContext,
        file: AuxObject
    ): ContextGroup3D {
        const context = new BuilderGroup3D(
            this,
            file,
            this._gameView.getDecoratorFactory()
        );
        context.setGridChecker(this._gameView.getGridChecker());
        return context;
    }

    protected async _shouldRemoveUpdatedFile(
        calc: AsyncCalculationContext,
        file: AuxObject,
        initialUpdate: boolean
    ) {
        let shouldRemove = false;
        let configTags = getFileConfigContexts(calc, file);
        if (configTags.length === 0) {
            if (!initialUpdate) {
                const userFile = await this.simulation.getUserFile();
                if (
                    !file.tags['aux._user'] &&
                    file.tags['aux._lastEditedBy'] === userFile.id
                ) {
                    const recentFile = await this.simulation.getSelectedRecentFile();
                    if (recentFile && file.id === recentFile.id) {
                        await this.simulation.setSelectedRecentFile(file);
                    } else {
                        await this.simulation.setSelectedRecentFile(null);
                    }
                    // this.addToRecentFilesList(file);
                }
            }
        } else {
            if (file.tags.size <= 0) {
                shouldRemove = true;
            }
        }

        return {
            shouldRemove,
        };
    }
}
