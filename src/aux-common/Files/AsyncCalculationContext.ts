/**
 * Defines an interface for objects that are able to calculate file values asynchronously.
 */
export interface AsyncCalculationContext {
    // ----- File Calculation Wrappers -----
    // TODO: Move a bunch of this to a wrapper that can handle things like caching.

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

    filesInContext(context: string): Promise<File[]>;
}
