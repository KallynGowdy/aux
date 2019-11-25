import { Atom } from './Atom2';
import { DeviceInfo } from '../core/DeviceInfo';
import { RemoteAction, DeviceAction } from '../core/Event';

/**
 * The name of the event which starts watching for when branches are loaded/unloaded.
 */
export const WATCH_BRANCHES = 'repo/watch_branches';

/**
 * The name of the event which stops watching for when branches are loaded/unloaded.
 */
export const UNWATCH_BRANCHES = 'repo/unwatch_branches';

/**
 * The name of the event which starts watching changes on a branch.
 * In particular, watches for new atoms.
 */
export const WATCH_BRANCH = 'repo/watch_branch';

/**
 * The name of the event which stops watching changes on a branch.
 */
export const UNWATCH_BRANCH = 'repo/unwatch_branch';

/**
 * The name of the event which notifies that some atoms were added to a branch.
 */
export const ADD_ATOMS = 'repo/add_atoms';

/**
 * The name of the event which tries to send an event to a device.
 */
export const SEND_EVENT = 'repo/send_event';

/**
 * The name of the event which notifies that an event was sent to this device.
 */
export const RECEIVE_EVENT = 'repo/receive_event';

/**
 * The name of the event which notifies that the add_atoms event was received.
 */
export const ATOMS_RECEIVED = 'repo/atoms_received';

/**
 * The name of the event which notifies that a branch was loaded into server memory.
 */
export const LOAD_BRANCH = 'repo/load_branch';

/**
 * The name of the event which notifies that a branch was unloaded from server memory.
 */
export const UNLOAD_BRANCH = 'repo/unload_branch';

/**
 * The name of the event which starts watching for connection/disconnection events to the server.
 */
export const WATCH_DEVICES = 'repo/watch_devices';

/**
 * The name of the event which stops watching for connection/disconnection events to the server.
 */
export const UNWATCH_DEVICES = 'repo/unwatch_devices';

/**
 * The name of the event which notifies that a device became connected to a branch.
 */
export const DEVICE_CONNECTED_TO_BRANCH = 'repo/device_connected_to_branch';

/**
 * The name of the event which notifies that a device become disconnected from a branch.
 */
export const DEVICE_DISCONNECTED_FROM_BRANCH =
    'repo/device_disconnected_from_branch';

/**
 * The name of the event which gets information about a branch.
 */
export const BRANCH_INFO = 'repo/branch_info';

/**
 * The name of the event which gets all the branches.
 */
export const BRANCHES = 'repo/branches';

/**
 * Defines an event which indicates that atoms should be added for the given branch.
 */
export interface AddAtomsEvent {
    /**
     * The branch that the atoms are for.
     */
    branch: string;

    /**
     * The atoms that were added.
     */
    atoms: Atom<any>[];
}

/**
 * Sends the given remote action to devices connected to the given branch.
 */
export interface SendRemoteActionEvent {
    /**
     * The branch.
     */
    branch: string;

    /**
     * The action to send.
     */
    action: RemoteAction;
}

/**
 * Sends the given device action to devices connected to the given branch.
 */
export interface ReceiveDeviceActionEvent {
    branch: string;
    action: DeviceAction;
}

/**
 * Defines an event which indicates that atoms were received and processed.
 */
export interface AtomsReceivedEvent {
    /**
     * The branch that the atoms were for.
     */
    branch: string;

    /**
     * The hashes of the atoms that were processed.
     */
    hashes: string[];
}

/**
 * Defines an event which indicates that a connection has been made to a branch.
 */
export interface ConnectedToBranchEvent {
    /**
     * The name of the branch that was connected.
     */
    branch: string;

    /**
     * The info of session that connected.
     */
    device: DeviceInfo;
}

/**
 * Defines an event which indicates that a connection has been removed from a branch.
 */
export interface DisconnectedFromBranchEvent {
    /**
     * The name of the branch that was disconnected.
     */
    branch: string;

    /**
     * The info of session that disconnected.
     */
    device: DeviceInfo;
}

export type BranchInfoEvent = BranchExistsInfo | BranchDoesNotExistInfo;

export interface BranchExistsInfo {
    branch: string;
    exists: true;
}

export interface BranchDoesNotExistInfo {
    branch: string;
    exists: false;
}

export interface BranchesEvent {
    branches: string[];
}

export interface LoadBranchEvent {
    branch: string;
}

export interface UnloadBranchEvent {
    branch: string;
}
