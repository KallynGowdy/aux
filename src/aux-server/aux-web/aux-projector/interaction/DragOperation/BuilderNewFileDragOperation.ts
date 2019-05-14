import { Physics } from '../../../shared/scene/Physics';
import {
    File,
    PartialFile,
    fileAdded,
    FileEvent,
} from '@casual-simulation/aux-common/Files';
import {
    createFile,
    FileCalculationContext,
    getDiffUpdate,
    isDiff,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common/Files/FileCalculations';
import { merge } from '@casual-simulation/aux-common/utils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BaseBuilderFileDragOperation } from './BaseBuilderFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Simulation3D } from '../../../shared/scene/Simulation3D';

/**
 * New File Drag Operation handles dragging of new files from the file queue.
 */
export class BuilderNewFileDragOperation extends BaseBuilderFileDragOperation {
    public static readonly FreeDragDistance: number = 6;

    private _fileAdded: boolean;
    private _initialDragMesh: AuxFile3D;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation: Simulation3D,
        interaction: BuilderInteractionManager,
        duplicatedFile: File,
        originalFile: File
    ) {
        super(simulation, interaction, [duplicatedFile], null);
    }

    protected async _updateFile(
        file: File,
        data: PartialFile
    ): Promise<FileEvent> {
        if (!this._fileAdded) {
            if (this._initialDragMesh) {
                this._releaseDragMesh(this._initialDragMesh);
                this._initialDragMesh = null;
            }

            // Add the duplicated file.
            this._file = merge(this._file, data || {});
            this._file = createFile(undefined, this._file.tags);
            this._files = [this._file];
            this._fileAdded = true;

            return fileAdded(this._file);
        } else {
            return super._updateFile(this._file, data);
        }
    }

    protected async _onDragReleased(): Promise<void> {
        if (this._initialDragMesh) {
            this._releaseDragMesh(this._initialDragMesh);
            this._initialDragMesh = null;

            if (this._isOverTrashCan()) {
                // Clear the diff
                await this.simulation.clearRecents();
            }
        } else if (this._isOnWorkspace) {
            await this.simulation.action(CREATE_ACTION_NAME, this._files);
        }

        await super._onDragReleased();
    }

    protected async _dragFilesFree(): Promise<void> {
        if (!this._fileAdded) {
            // New file has not been added yet, drag a dummy mesh to drag around until it gets added to a workspace.
            if (!this._initialDragMesh) {
                this._initialDragMesh = this._createDragMesh(this._file);
            }

            const mouseDir = Physics.screenPosToRay(
                this.gameView.getInput().getMouseScreenPos(),
                this.gameView.getMainCamera()
            );
            let worldPos = Physics.pointOnRay(
                mouseDir,
                BuilderNewFileDragOperation.FreeDragDistance
            );
            this._initialDragMesh.position.copy(worldPos);
            this._initialDragMesh.updateMatrixWorld(true);
        } else {
            // New file has been added, just do the base file drag operation.
            await super._dragFilesFree();
        }
    }

    private _releaseDragMesh(mesh: AuxFile3D): void {
        if (mesh) {
            mesh.dispose();
            this.gameView.getScene().remove(mesh);
        }
    }
}
