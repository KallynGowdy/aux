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

export class TestAsyncCalculationContext implements AsyncCalculationContext {
    private _calc: FileCalculationContext;

    constructor(calc: FileCalculationContext) {
        this._calc = calc;
    }

    async getObjects(): Promise<File[]> {
        return this._calc.objects;
    }

    async getFileDragMode(file: File): Promise<FileDragMode> {
        return getFileDragMode(this._calc, file);
    }

    async getFilePosition(
        file: File,
        context: string
    ): Promise<{ x: number; y: number; z: number }> {
        return getFilePosition(this._calc, file, context);
    }

    async getFileIndex(file: File, context: string): Promise<number> {
        return getFileIndex(this._calc, file, context);
    }

    async objectsAtContextGridPosition(
        context: string,
        position: { x: number; y: number; z: number }
    ): Promise<File[]> {
        return objectsAtContextGridPosition(this._calc, context, position);
    }

    async isMinimized(file: File): Promise<boolean> {
        return isMinimized(this._calc, file);
    }

    async isContextMovable(file: File): Promise<boolean> {
        return isContextMovable(this._calc, file);
    }

    async isFileMovable(file: File): Promise<boolean> {
        return isFileMovable(this._calc, file);
    }

    async getFileConfigContexts(file: File): Promise<string[]> {
        return getFileConfigContexts(this._calc, file);
    }

    async isContext(contextFile: File): Promise<boolean> {
        return isContext(this._calc, contextFile);
    }

    async isSimulation(file: File): Promise<boolean> {
        return isSimulation(this._calc, file);
    }

    async getBuilderContextGrid(file: AuxObject): Promise<any> {
        return getBuilderContextGrid(this._calc, file);
    }

    async getContextDefaultHeight(file: AuxObject): Promise<number> {
        return getContextDefaultHeight(this._calc, file);
    }

    async getContextSize(file: AuxObject): Promise<number> {
        return getContextSize(this._calc, file);
    }

    async getContextScale(contextFile: File): Promise<number> {
        return getContextScale(this._calc, contextFile);
    }

    async getContextGridHeight(
        contextFile: File,
        key: string
    ): Promise<number> {
        return getContextGridHeight(this._calc, contextFile, key);
    }

    async getContextGridScale(contextFile: File): Promise<number> {
        return getContextGridScale(this._calc, contextFile);
    }

    async getContextPosition(
        contextFile: File
    ): Promise<{ x: number; y: number; z: number }> {
        return getContextPosition(this._calc, contextFile);
    }

    async getContextColor(contextFile: File): Promise<string> {
        return getContextColor(this._calc, contextFile);
    }

    async filesInContext(context: string): Promise<File[]> {
        return filesInContext(this._calc, context);
    }

    async isFileInContext(file: File, contextId: string): Promise<boolean> {
        return isFileInContext(this._calc, file, contextId);
    }

    async isConfigForContext(file: File, context: string): Promise<boolean> {
        return isConfigForContext(this._calc, file, context);
    }

    async calculateGridScale(workspace: AuxObject): Promise<number> {
        return calculateGridScale(this._calc, workspace);
    }

    async getFileRotation(
        file: File,
        context: string
    ): Promise<{ x: number; y: number; z: number }> {
        return getFileRotation(this._calc, file, context);
    }

    async getFileShape(file: File): Promise<FileShape> {
        return getFileShape(this._calc, file);
    }

    async getFileChannel(file: File): Promise<string> {
        return getFileChannel(this._calc, file);
    }

    async getFileInputTarget(file: AuxFile): Promise<AuxFile> {
        return getFileInputTarget(this._calc, file);
    }

    async getFileInputPlaceholder(file: AuxFile): Promise<string> {
        return getFileInputPlaceholder(this._calc, file);
    }

    async isFileStackable(file: File): Promise<boolean> {
        return isFileStackable(this._calc, file);
    }

    async isMergeable(file: File): Promise<boolean> {
        return isMergeable(this._calc, file);
    }

    async filtersMatchingArguments(
        file: File,
        eventName: string,
        args: any[]
    ): Promise<FilterParseResult[]> {
        return filtersMatchingArguments(this._calc, file, eventName, args);
    }

    async fileContextSortOrder(
        file: File,
        contextId: string
    ): Promise<string | number> {
        return fileContextSortOrder(this._calc, file, contextId);
    }

    async calculateNumericalTagValue(
        file: File,
        tag: string,
        defaultValue: number
    ): Promise<number> {
        return calculateNumericalTagValue(this._calc, file, tag, defaultValue);
    }

    async calculateFormattedFileValue(
        file: File,
        tag: string
    ): Promise<string> {
        return calculateFormattedFileValue(this._calc, file, tag);
    }

    async calculateFileValue(
        object: File,
        tag: string | number,
        unwrapProxy?: boolean
    ): Promise<any> {
        return calculateFileValue(this._calc, object, tag, unwrapProxy);
    }

    async getFileLabelAnchor(file: File): Promise<FileLabelAnchor> {
        return getFileLabelAnchor(this._calc, file);
    }
}
