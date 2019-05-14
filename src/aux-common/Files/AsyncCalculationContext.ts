import { AuxFile, AuxObject, AuxOp, AuxState } from '../aux-format';
import {
    File,
    FileDragMode,
    FileShape,
    FileTags,
    FileLabelAnchor,
} from './File';

/**
 * Defines an interface for objects that are able to calculate file values asynchronously.
 */
export interface AsyncCalculationContext {
    /**
     * Gets the list of objects in this calculation context.
     */
    getObjects(): Promise<File[]>;

    /**
     * Calculates the file drag mode for the given file.
     * @param file The file.
     */
    getFileDragMode(file: File): Promise<FileDragMode>;

    /**
     * Gets the position of the given file within the given context.
     * @param file The file.
     * @param context The context.
     */
    getFilePosition(
        file: File,
        context: string
    ): Promise<{ x: number; y: number; z: number }>;

    /**
     * Gets the list of files that are at the given position in the given context.
     * @param context The context.
     * @param position The position.
     */
    objectsAtContextGridPosition(
        context: string,
        position: { x: number; y: number; z: number }
    ): Promise<File[]>;

    /**
     * Determines if the given file is a context that is currently minimized.
     * @param file The file to check.
     */
    isMinimized(file: File): Promise<boolean>;

    /**
     * Determines if the given file is a context that is movable.
     * @param file The file to check.
     */
    isContextMovable(file: File): Promise<boolean>;

    /**
     * Determines if the given file is movable.
     * @param file The file.
     */
    isFileMovable(file: File): Promise<boolean>;

    /**
     * Gets the list of contexts that the given file is the config for.
     * @param file The file.
     */
    getFileConfigContexts(file: File): Promise<string[]>;

    /**
     * Determines if the given file contains data for a context.
     */
    isContext(contextFile: File): Promise<boolean>;

    /**
     * Gets the grid object for the given file.
     * @param file
     */
    getBuilderContextGrid(
        file: AuxObject
    ): Promise<File['tags']['aux.builder.context.grid']>;

    /**
     * Gets the default height of the context.
     * @param file
     */
    getContextDefaultHeight(file: AuxObject): Promise<number>;

    getContextSize(file: AuxObject): Promise<number>;

    /**
     * Gets the scale of the context.
     * @param contextFile The file that represents the context.
     */
    getContextScale(contextFile: File): Promise<number>;

    /**
     * Gets the height of the specified grid on the context.
     * @param contextFile The file that represents the context.
     * @param key The key for the grid position to lookup in the context grid.
     */
    getContextGridHeight(contextFile: File, key: string): Promise<number>;

    /**
     * Gets the grid scale of the context.
     * @param contextFile The file that represents the context.
     */
    getContextGridScale(contextFile: File): Promise<number>;

    /**
     * Gets the position that the context should be at using the given file.
     * @param contextFile The file that represents the context.
     */
    getContextPosition(
        contextFile: File
    ): Promise<{ x: number; y: number; z: number }>;

    /**
     * Gets the color of the context.
     * @param contextFile The file that represents the context.
     */
    getContextColor(contextFile: File): Promise<string>;

    filesInContext(context: string): Promise<File[]>;

    /**
     * Returns wether or not the given file resides in the given context id.
     * @param file The file.
     * @param contextId The id of the context that we are asking if the file is in.
     */
    isFileInContext(file: Object, contextId: string): Promise<boolean>;

    /**
     * Determines if the given file is a config file for the given context.
     * @param file The file to check.
     * @param context The context to check if the file is the config of.
     */
    isConfigForContext(file: File, context: string): Promise<boolean>;

    /**
     * Calculates the grid scale for the given workspace.
     * @param workspace
     */
    calculateGridScale(workspace: AuxFile): Promise<number>;

    /**
     * Gets the rotation that the given file is at in the given context.
     * @param file The file.
     * @param context The context.
     */
    getFileRotation(
        file: File,
        context: string
    ): Promise<{ x: number; y: number; z: number }>;

    /**
     * Gets the shape of the file.
     * @param calc The calculation context to use.
     * @param file The file.
     */
    getFileShape(file: File): Promise<FileShape>;

    /**
     * Calculates the value of the given tag on the given file. If the result is not a number, then the given default value
     * is returned.
     * @param file The file.
     * @param tag The tag.
     * @param defaultValue The default value to use if the tag doesn't exist or the result is not a number.
     */
    calculateNumericalTagValue(
        file: Object,
        tag: string,
        defaultValue: number
    ): Promise<number>;

    /**
     * Calculates the nicely formatted value for the given file and tag.
     * @param file The file to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedFileValue(file: File, tag: string): Promise<string>;

    /**
     * Calculates the value of the given tag on the given object.
     * @param object
     * @param tag
     * @param unwrapProxy
     */
    calculateFileValue(
        object: Object,
        tag: keyof FileTags,
        unwrapProxy?: boolean
    ): Promise<any>;

    /**
     * Gets the anchor position for the file's label.
     * @param file The file.
     */
    getFileLabelAnchor(file: File): Promise<FileLabelAnchor>;
}
