import { AsyncSimulation } from '../AsyncSimulation';
import { AuxFile, LocalEvents, AuxObject } from '@casual-simulation/aux-common';
import { RecentsUpdatedEvent } from '../RecentFilesManager';
import { FilesUpdatedEvent as PanelFilesUpdatedEvent } from '../FilePanelManager';

export interface RemoteAsyncSimulation extends AsyncSimulation {
    registerListener(
        key: string,
        callback: (event: SimulationEvents) => void
    ): Promise<void>;
    unregisterListener(key: string): Promise<void>;

    watchFile(
        key: string,
        id: string,
        callback: (event: AuxObject) => void
    ): Promise<void>;
    unwatchFile(key: string, id: string): Promise<void>;
}

export type SimulationEvents =
    | FilesDiscoveredEvent
    | FilesRemovedEvent
    | FilesUpdatedEvent
    | ConnectionStateChangedEvent
    | SimulationLocalEvents
    | FilePanelUpdatedEvent
    | FilePanelSearchUpdated
    | FilePanelOpenChangedEvent
    | SimulationRecentsUpdatedEvent;

export interface SimulationEvent {
    name: string;
}

export interface FilesDiscoveredEvent extends SimulationEvent {
    name: 'files_discovered';
    data: AuxFile[];
}

export interface FilesRemovedEvent extends SimulationEvent {
    name: 'files_removed';
    data: string[];
}

export interface FilesUpdatedEvent extends SimulationEvent {
    name: 'files_updated';
    data: AuxFile[];
}

export interface ConnectionStateChangedEvent extends SimulationEvent {
    name: 'connection_state_changed';
    data: boolean;
}

export interface SimulationLocalEvents extends SimulationEvent {
    name: 'local_events';
    data: LocalEvents;
}

export interface FilePanelUpdatedEvent extends SimulationEvent {
    name: 'file_panel_updated';
    data: PanelFilesUpdatedEvent;
}

export interface FilePanelOpenChangedEvent extends SimulationEvent {
    name: 'file_panel_open_changed';
    data: boolean;
}

export interface FilePanelSearchUpdated extends SimulationEvent {
    name: 'file_panel_search_updated';
    data: string;
}

export interface SimulationRecentsUpdatedEvent extends SimulationEvent {
    name: 'recents_updated';
    data: RecentsUpdatedEvent;
}
