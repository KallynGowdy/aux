import { GameObject } from './GameObject';
import { AuxFile } from '@casual-simulation/aux-common/aux-format';
import {
    TagUpdatedEvent,
    AuxDomain,
    isFileInContext,
    isConfigForContext,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';
import { Object3D, SceneUtils } from 'three';
import { AuxFile3D } from './AuxFile3D';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxFile3DDecoratorFactory } from './decorators/AuxFile3DDecoratorFactory';

/**
 * Defines a class that represents the visualization of a context.
 */
export class Context3D extends GameObject {
    static debug: boolean = false;

    /**
     * The context that this object represents.
     */
    context: string;

    /**
     * The domain this object is in.
     */
    domain: AuxDomain;

    /**
     * The files that are in this context.
     */
    files: Map<string, AuxFile3D>;

    /**
     * The group that this context belongs to.
     */
    contextGroup: ContextGroup3D;

    private _decoratorFactory: AuxFile3DDecoratorFactory;

    /**
     * Creates a new context which represents a grouping of files.
     * @param context The tag that this context represents.
     * @param colliders The array that new colliders should be added to.
     */
    constructor(
        context: string,
        group: ContextGroup3D,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
        super();
        this.context = context;
        this.colliders = colliders;
        this.domain = domain;
        this.contextGroup = group;
        this.files = new Map();
        this._decoratorFactory = decoratorFactory;
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     */
    async fileAdded(calc: AsyncCalculationContext, file: AuxFile) {
        const isInContext3D = typeof this.files.get(file.id) !== 'undefined';
        const isInContext = calc.isFileInContext(file, this.context);

        if (!isInContext3D && isInContext) {
            this._addFile(calc, file);
        }
    }

    /**
     * Notifies this context that the given file was updated.
     * @param file The file.
     * @param updates The changes made to the file.
     */
    async fileUpdated(
        calc: AsyncCalculationContext,
        file: AuxFile,
        updates: TagUpdatedEvent[]
    ) {
        const isInContext3D = typeof this.files.get(file.id) !== 'undefined';
        const isInContext = await calc.isFileInContext(file, this.context);
        const isForContext = await calc.isConfigForContext(file, this.context);

        if (!isInContext3D && isInContext) {
            this._addFile(calc, file);
        } else if (isInContext3D && !isInContext) {
            this._removeFile(calc, file.id);
        } else if ((isInContext3D && isInContext) || isForContext) {
            this._updateFile(calc, file, updates);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The ID of the file that was removed.
     * @param calc The calculation context.
     */
    async fileRemoved(calc: AsyncCalculationContext, id: string) {
        this._removeFile(calc, id);
    }

    frameUpdate(calc: AsyncCalculationContext): void {
        if (this.files) {
            this.files.forEach(f => f.frameUpdate(calc));
        }
    }

    dispose(): void {
        if (this.files) {
            this.files.forEach(f => {
                f.dispose();
            });
        }
    }

    private _addFile(calc: AsyncCalculationContext, file: AuxFile) {
        if (Context3D.debug) {
            console.log('[Context3D] Add', file.id, 'to context', this.context);
        }
        const mesh = new AuxFile3D(
            file,
            this.contextGroup,
            this.context,
            this.domain,
            this.colliders,
            this._decoratorFactory
        );
        this.files.set(file.id, mesh);
        this.add(mesh);

        mesh.fileUpdated(calc, file, []);
    }

    private _removeFile(calc: AsyncCalculationContext, id: string) {
        if (Context3D.debug) {
            console.log('[Context3D] Remove', id, 'from context', this.context);
        }
        const mesh = this.files.get(id);
        if (typeof mesh !== 'undefined') {
            mesh.dispose();
            this.remove(mesh);
            this.files.delete(id);
        }
    }

    private _updateFile(
        calc: AsyncCalculationContext,
        file: AuxFile,
        updates: TagUpdatedEvent[]
    ) {
        this.files.forEach(mesh => {
            mesh.fileUpdated(calc, file, updates);
        });
    }
}
