import { PartialFile, FilesState, File } from './File';

/**
 * Defines a union type for all the possible events that can be emitted from a files channel.
 */
export type FileEvent =
    | FileAddedEvent
    | FileRemovedEvent
    | FileUpdatedEvent
    | FileTransactionEvent
    | ApplyStateEvent
    | Action
    | SetForcedOfflineEvent
    | LocalEvent;

/**
 * Defines a set of possible local event types.
 */
export type LocalEvents =
    | ShowToastEvent
    | TweenToEvent
    | OpenQRCodeScannerEvent
    | ShowQRCodeEvent
    | LoadSimulationEvent
    | UnloadSimulationEvent
    | SuperShoutEvent
    | GoToContextEvent
    | ImportAUXEvent
    | ShowInputForTagEvent;

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 * @deprecated
 */
export interface Event {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;
}

/**
 * Defines a file event that indicates a file was added to the state.
 */
export interface FileAddedEvent extends Event {
    type: 'file_added';
    id: string;
    file: File;
}

/**
 * Defines a file event that indicates a file was removed from the state.
 */
export interface FileRemovedEvent extends Event {
    type: 'file_removed';
    id: string;
}

/**
 * Defines a file event that indicates a file was updated.
 */
export interface FileUpdatedEvent extends Event {
    type: 'file_updated';
    id: string;
    update: PartialFile;
}

/**
 * A set of file events in one.
 */
export interface FileTransactionEvent extends Event {
    type: 'transaction';
    events: FileEvent[];
}

/**
 * An event to apply some generic FilesState to the current state.
 * This is useful when you have some generic file state and want to just apply it to the
 * current state. An example of doing this is from the automatic merge system.
 */
export interface ApplyStateEvent extends Event {
    type: 'apply_state';
    state: FilesState;
}

/**
 * An event that is used as a way to communicate local changes from script actions to the interface.
 * For example, showing a toast message is a local event.
 */
export interface LocalEvent extends Event {
    type: 'local';
}

/**
 * An event that is used to show a toast message to the user.
 */
export interface ShowToastEvent extends LocalEvent {
    name: 'show_toast';
    message: string;
}

/**
 * An event that is used to tween the camera to the given file's location.
 */
export interface TweenToEvent extends LocalEvent {
    name: 'tween_to';

    /**
     * The ID of the file to tween to.
     */
    fileId: string;

    /*
     * The zoom value to use.
     */
    zoomValue: number;
}

/**
 * An event that is used to show or hide the QR Code Scanner.
 */
export interface OpenQRCodeScannerEvent extends LocalEvent {
    name: 'show_qr_code_scanner';

    /**
     * Whether the QR Code scanner should be visible.
     */
    open: boolean;
}

/**
 * An event that is used to show or hide a QR Code on screen.
 */
export interface ShowQRCodeEvent extends LocalEvent {
    name: 'show_qr_code';

    /**
     * Whether the QR Code should be visible.
     */
    open: boolean;

    /**
     * The code to display.
     */
    code: string;
}

/**
 * An event that is used to load a simulation.
 */
export interface LoadSimulationEvent extends LocalEvent {
    name: 'load_simulation';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
export interface UnloadSimulationEvent extends LocalEvent {
    name: 'unload_simulation';

    /**
     * The ID of the simulation to unload.
     */
    id: string;
}

/**
 * An event that is used to load an AUX from a remote location.
 */
export interface ImportAUXEvent extends LocalEvent {
    name: 'import_aux';

    /**
     * The URL to load.
     */
    url: string;
}

/**
 * Defines an event for actions that are shouted to every current loaded simulation.
 */
export interface SuperShoutEvent extends LocalEvent {
    name: 'super_shout';

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;
}

/**
 * Defines an event that is used to send the player to a context.
 */
export interface GoToContextEvent extends LocalEvent {
    name: 'go_to_context';

    /**
     * The context that should be loaded.
     */
    context: string;
}

/**
 * Defines an event that is used to show an input box to edit a tag on a file.
 */
export interface ShowInputForTagEvent extends LocalEvent {
    name: 'show_input_for_tag';

    /**
     * The ID of the file to edit.
     */
    fileId: string;

    /**
     * The tag that should be edited on the file.
     */
    tag: string;

    /**
     * The options for the input box.
     */
    options: Partial<ShowInputOptions>;
}

/**
 * Defines an event that is used to set whether the connection is forced to be offline.
 */
export interface SetForcedOfflineEvent extends Event {
    type: 'set_offline_state';

    /**
     * Whether the connection should be offline.
     */
    offline: boolean;
}

/**
 * Defines an interface for options that a show input event can use.
 */
export interface ShowInputOptions {
    /**
     * The type of input box to show.
     */
    type: ShowInputType;

    /**
     * The subtype of input box to show.
     */
    subtype: ShowInputSubtype;

    /**
     * The title that should be used for the input.
     */
    title: string;

    /**
     * The placeholder for the value.
     */
    placeholder: string;

    /**
     * The background color to use.
     */
    backgroundColor: string;

    /**
     * The foreground color to use.
     */
    foregroundColor: string;
}

/**
 * Defines the possible input types.
 */
export type ShowInputType = 'text' | 'color';

/**
 * Defines the possible input types.
 */
export type ShowInputSubtype = 'basic' | 'swatch' | 'advanced';

/**
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
export interface Action {
    type: 'action';

    /**
     * The IDs of the files that the event is being sent to.
     * If null, then the action is sent to every file.
     */
    fileIds: string[] | null;

    /**
     * The File ID of the user.
     */
    userId: string | null;

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;
}

/**
 * Creates a new FileAddedEvent.
 * @param file The file that was added.
 */
export function fileAdded(file: File): FileAddedEvent {
    return {
        type: 'file_added',
        id: file.id,
        file: file,
    };
}

/**
 * Creates a new FileRemovedEvent.
 * @param fileId The ID of the file that was removed.
 */
export function fileRemoved(fileId: string): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: fileId,
    };
}

/**
 * Creates a new FileUpdatedEvent.
 * @param id The ID of the file that was updated.
 * @param update The update that was applied to the file.
 */
export function fileUpdated(id: string, update: PartialFile): FileUpdatedEvent {
    return {
        type: 'file_updated',
        id: id,
        update: update,
    };
}

/**
 * Creates a new FileTransactionEvent.
 * @param events The events to contain in the transaction.
 */
export function transaction(events: FileEvent[]): FileTransactionEvent {
    return {
        type: 'transaction',
        events: events,
    };
}

/**
 * Creates a new Action.
 * @param eventName The name of the event.
 * @param fileIds The IDs of the files that the event should be sent to. If null then the event is sent to every file.
 * @param userId The ID of the file for the current user.
 * @param arg The optional argument to provide.
 */
export function action(
    eventName: string,
    fileIds: string[] = null,
    userId: string = null,
    arg?: any
): Action {
    return {
        type: 'action',
        fileIds,
        eventName,
        userId,
        argument: arg,
    };
}

/**
 * Creates a new ApplyStateEvent.
 * @param state The state to apply.
 */
export function addState(state: FilesState): ApplyStateEvent {
    return {
        type: 'apply_state',
        state: state,
    };
}

/**
 * Creates a new ShowToastEvent.
 * @param message The message to show with the event.
 */
export function toast(message: string): ShowToastEvent {
    return {
        type: 'local',
        name: 'show_toast',
        message: message,
    };
}

/**
 * Creates a new TweenToEvent.
 * @param fileId The ID of the file to tween to.
 * @param zoomValue The zoom value to use.
 */
export function tweenTo(fileId: string, zoomValue: number = -1): TweenToEvent {
    return {
        type: 'local',
        name: 'tween_to',
        fileId: fileId,
        zoomValue: zoomValue,
    };
}

/**
 * Creates a new OpenQRCodeScannerEvent.
 * @param open Whether the QR Code scanner should be open or closed.
 */
export function openQRCodeScanner(open: boolean): OpenQRCodeScannerEvent {
    return {
        type: 'local',
        name: 'show_qr_code_scanner',
        open: open,
    };
}

/**
 * Creates a new ShowQRCodeEvent.
 * @param open Whether the QR Code should be visible.
 * @param code The code that should be shown.
 */
export function showQRCode(open: boolean, code?: string): ShowQRCodeEvent {
    return {
        type: 'local',
        name: 'show_qr_code',
        open: open,
        code: code,
    };
}

/**
 * Creates a new LoadSimulationEvent.
 * @param id The ID of the simulation to load.
 */
export function loadSimulation(id: string): LoadSimulationEvent {
    return {
        type: 'local',
        name: 'load_simulation',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationEvent.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadSimulationEvent {
    return {
        type: 'local',
        name: 'unload_simulation',
        id: id,
    };
}

/**
 * Creates a new SuperShoutEvent.
 * @param eventName The name of the event.
 * @param arg The argument to send as the "that" variable to scripts.
 */
export function superShout(eventName: string, arg?: any): SuperShoutEvent {
    return {
        type: 'local',
        name: 'super_shout',
        eventName: eventName,
        argument: arg,
    };
}

/**
 * Creates a new GoToContextEvent.
 * @param simulationOrContext The simulation ID or context to go to. If a simulation ID is being provided, then the context parameter must also be provided.
 * @param context
 */
export function goToContext(context: string): GoToContextEvent {
    return {
        type: 'local',
        name: 'go_to_context',
        context: context,
    };
}

/**
 * Creates a new ImportAUXEvent.
 * @param url The URL that should be loaded.
 */
export function importAUX(url: string): ImportAUXEvent {
    return {
        type: 'local',
        name: 'import_aux',
        url: url,
    };
}

/**
 * Creates a new ShowInputForTagEvent.
 * @param fileId The ID of the file to edit.
 * @param tag The tag to edit.
 */
export function showInputForTag(
    fileId: string,
    tag: string,
    options?: Partial<ShowInputOptions>
): ShowInputForTagEvent {
    return {
        type: 'local',
        name: 'show_input_for_tag',
        fileId: fileId,
        tag: tag,
        options: options || {},
    };
}

/**
 * Creates a new SetForcedOfflineEvent event.
 * @param offline Whether the connection should be offline.
 */
export function setForcedOffline(offline: boolean): SetForcedOfflineEvent {
    return {
        type: 'set_offline_state',
        offline: offline,
    };
}
