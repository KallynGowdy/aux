import { Observable } from 'rxjs';
import { DeviceInfo } from '../core/DeviceInfo';

/**
 * Defines an interface that contains connection state info.
 */
export interface ClientConnectionState {
    /**
     * Whether the client is connected.
     */
    connected: boolean;

    /**
     * The device info.
     */
    info: DeviceInfo;
}

/**
 * Defines an interface for a client connection.
 */
export interface ConnectionClient {
    /**
     * Gets an observable for the connection state.
     */
    connectionState: Observable<ClientConnectionState>;

    /**
     * Gets an observable for events with the given name.
     * @param name The name of the events.
     */
    event<T>(name: string): Observable<T>;

    /**
     * Sends an event with the given name and data.
     * @param name The name of the event.
     * @param data The data to send.
     */
    send(name: string, data: any): void;

    /**
     * Tells the connection to disconnect.
     */
    disconnect(): void;

    /**
     * Tells the connection to (re)connect.
     */
    connect(): void;
}
