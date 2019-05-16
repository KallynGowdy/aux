import {
    File,
    AsyncCalculationContext,
    FileDragMode,
    FileLabelAnchor,
    FileCalculationContext,
    getFileDragMode,
    getFilePosition,
    getFileIndex,
    objectsAtContextGridPosition,
    isMinimized,
    isContextMovable,
    isFile,
    isFileMovable,
    getFileConfigContexts,
    isContext,
    isSimulation,
    getBuilderContextGrid,
    getContextDefaultHeight,
    getContextSize,
    getContextScale,
    getContextGridHeight,
    getContextGridScale,
    getContextPosition,
    getContextColor,
    filesInContext,
    isFileInContext,
    isConfigForContext,
    calculateGridScale,
    getFileRotation,
    FileShape,
    getFileShape,
    getFileChannel,
    fileContextSortOrder,
    calculateNumericalTagValue,
    calculateFormattedFileValue,
    calculateFileValue,
    getFileLabelAnchor,
    getFileInputPlaceholder,
    getFileInputTarget,
    isFileStackable,
    isMergeable,
    filtersMatchingArguments,
    FilterParseResult,
} from '../Files';
import { AuxObject, AuxFile } from '../aux-format';

export class AsyncCalculationContextWrapper implements AsyncCalculationContext {
    private _calc: FileCalculationContext;

    constructor(calc: FileCalculationContext) {
        this._calc = calc;
    }

    get calculationContext() {
        return this._calc;
    }

    set calculationContext(value: FileCalculationContext) {
        this._calc = value;
    }

    async getObjects(): Promise<File[]> {
        return this.calculationContext.objects;
    }

    async getFileDragMode(file: File): Promise<FileDragMode> {
        return getFileDragMode(this.calculationContext, file);
    }

    async getFilePosition(
        file: File,
        context: string
    ): Promise<{ x: number; y: number; z: number }> {
        return getFilePosition(this.calculationContext, file, context);
    }

    async getFileIndex(file: File, context: string): Promise<number> {
        return getFileIndex(this.calculationContext, file, context);
    }

    async objectsAtContextGridPosition(
        context: string,
        position: { x: number; y: number; z: number }
    ): Promise<File[]> {
        return objectsAtContextGridPosition(
            this.calculationContext,
            context,
            position
        );
    }

    async isMinimized(file: File): Promise<boolean> {
        return isMinimized(this.calculationContext, file);
    }

    async isContextMovable(file: File): Promise<boolean> {
        return isContextMovable(this.calculationContext, file);
    }

    async isFileMovable(file: File): Promise<boolean> {
        return isFileMovable(this.calculationContext, file);
    }

    async getFileConfigContexts(file: File): Promise<string[]> {
        return getFileConfigContexts(this.calculationContext, file);
    }

    async isContext(contextFile: File): Promise<boolean> {
        return isContext(this.calculationContext, contextFile);
    }

    async isSimulation(file: File): Promise<boolean> {
        return isSimulation(this.calculationContext, file);
    }

    async getBuilderContextGrid(file: AuxObject): Promise<any> {
        return getBuilderContextGrid(this.calculationContext, file);
    }

    async getContextDefaultHeight(file: AuxObject): Promise<number> {
        return getContextDefaultHeight(this.calculationContext, file);
    }

    async getContextSize(file: AuxObject): Promise<number> {
        return getContextSize(this.calculationContext, file);
    }

    async getContextScale(contextFile: File): Promise<number> {
        return getContextScale(this.calculationContext, contextFile);
    }

    async getContextGridHeight(
        contextFile: File,
        key: string
    ): Promise<number> {
        return getContextGridHeight(this.calculationContext, contextFile, key);
    }

    async getContextGridScale(contextFile: File): Promise<number> {
        return getContextGridScale(this.calculationContext, contextFile);
    }

    async getContextPosition(
        contextFile: File
    ): Promise<{ x: number; y: number; z: number }> {
        return getContextPosition(this.calculationContext, contextFile);
    }

    async getContextColor(contextFile: File): Promise<string> {
        return getContextColor(this.calculationContext, contextFile);
    }

    async filesInContext(context: string): Promise<File[]> {
        return filesInContext(this.calculationContext, context);
    }

    async isFileInContext(file: File, contextId: string): Promise<boolean> {
        return isFileInContext(this.calculationContext, file, contextId);
    }

    async isConfigForContext(file: File, context: string): Promise<boolean> {
        return isConfigForContext(this.calculationContext, file, context);
    }

    async calculateGridScale(workspace: AuxObject): Promise<number> {
        return calculateGridScale(this.calculationContext, workspace);
    }

    async getFileRotation(
        file: File,
        context: string
    ): Promise<{ x: number; y: number; z: number }> {
        return getFileRotation(this.calculationContext, file, context);
    }

    async getFileShape(file: File): Promise<FileShape> {
        return getFileShape(this.calculationContext, file);
    }

    async getFileChannel(file: File): Promise<string> {
        return getFileChannel(this.calculationContext, file);
    }

    async getFileInputTarget(file: AuxFile): Promise<AuxFile> {
        return getFileInputTarget(this.calculationContext, file);
    }

    async getFileInputPlaceholder(file: AuxFile): Promise<string> {
        return getFileInputPlaceholder(this.calculationContext, file);
    }

    async isFileStackable(file: File): Promise<boolean> {
        return isFileStackable(this.calculationContext, file);
    }

    async isMergeable(file: File): Promise<boolean> {
        return isMergeable(this.calculationContext, file);
    }

    async filtersMatchingArguments(
        file: File,
        eventName: string,
        args: any[]
    ): Promise<FilterParseResult[]> {
        return filtersMatchingArguments(
            this.calculationContext,
            file,
            eventName,
            args
        );
    }

    async fileContextSortOrder(
        file: File,
        contextId: string
    ): Promise<string | number> {
        return fileContextSortOrder(this.calculationContext, file, contextId);
    }

    async calculateNumericalTagValue(
        file: File,
        tag: string,
        defaultValue: number
    ): Promise<number> {
        return calculateNumericalTagValue(
            this.calculationContext,
            file,
            tag,
            defaultValue
        );
    }

    async calculateFormattedFileValue(
        file: File,
        tag: string
    ): Promise<string> {
        return calculateFormattedFileValue(this.calculationContext, file, tag);
    }

    async calculateFileValue(
        object: File,
        tag: string | number,
        unwrapProxy?: boolean
    ): Promise<any> {
        return calculateFileValue(
            this.calculationContext,
            object,
            tag,
            unwrapProxy
        );
    }

    async getFileLabelAnchor(file: File): Promise<FileLabelAnchor> {
        return getFileLabelAnchor(this.calculationContext, file);
    }
}
