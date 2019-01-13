import { Subject, Observable, SubscriptionLike, never, ConnectableObservable } from 'rxjs'
import { filter, map, first, tap, distinctUntilChanged, publish, refCount, flatMap } from 'rxjs/operators';
import { ChannelInfo } from '../Channel';
import { Event } from '../Event';
import { StateStore } from '../StateStore';
import { ChannelConnector, ChannelConnectionRequest, ChannelConnection, ChannelConnectionState } from '../ChannelConnector';

interface EventWrapper {
    event: Event;
    isLocal: boolean;
}

/**
 * Defines an interface for objects which help setup a connection.
 */
export interface ConnectionHelper<T> {

    /**
     * Gets the connection that is being setup.
     */
    build: () => ChannelConnection<T>;

    /**
     * Sets an observable that resolves with an event whenever an event
     * is received from the server.
     */
    setServerEvents: (serverEvents: Observable<Event>) => void;

    /**
     * Sets the function that is used to emit events to the server.
     */
    setEmitToServerFunction: (emit: (event: Event) => void | Promise<void>) => void;

    /**
     * Sets the function that is used to emit events to the local store.
     */
    setEmitToStoreFunction: (emit: (event: Event) => void) => void;

    /**
     * Sets an observable that resolves with whether the server is currently reachable.
     */
    setConnectionStateObservable: (disconnected: Observable<boolean>) => void;

    /**
     * Sets the function that is used to get the current state from the server.
     */
    setGetRemoteServerStateFunction: (getServerState: () => Promise<T>) => void;
    
    /**
     * Sets the function that is used to save some state to locally
     * persistent storage. The saved state should be able to be retrieved via the
     * related getStateFunction.
     */
    setSaveStateFunction: (saveState: (key: string, state: T) => void) => void;

    /**
     * Sets the function that is used to retrieve some state from locally
     * persistent storage. If the given key exists, the function should return the value for
     * that key. Otherwise it should return undefined.
     */
    setGetStateFunction: (getState: (key: string) => T) => void;

    /**
     * The observable that is resolved a single time when 
     * the connection should be shut down.
     */
    onUnsubscribe: Observable<{}>;
}

/**
 * Defines a base class for connectors.
 * This class helps create channel connections which behave correctly.
 */
export class BaseConnector implements ChannelConnector {

    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        throw new Error('Not implemented.');
    }

    /**
     * Creates a new channel connection which pipes events to the correct locations.
     * In particular, events emitted locally are sent to the server while events emitted from the server
     * are send locally. See emitToServer and emitFromServer.
     * @param connection_request
     */
    protected newConnection<T>(connection_request: ChannelConnectionRequest<T>): ConnectionHelper<T> {
        let subject = new Subject<EventWrapper>();
        let info = connection_request.info;
        let store = connection_request.store;
        let serverEvents: Observable<Event>;
        let connectionStates: Observable<boolean>;
        let onUnsubscribe: Subject<{}> = new Subject<{}>();
        let emitToServer: ((event: Event) => void | Promise<void>);
        let emitToStore: ((event: Event) => void);
        let saveState: ((key: string, state: T) => void);
        let getState: ((key: string) => T);
        let getServerState: (() => Promise<T>);
        let disconnected: Observable<T>;
        let reconnected: Observable<T>;
        let disconnectedSub: SubscriptionLike;
        let reconnectedSub: SubscriptionLike;
        let currentState: ChannelConnectionState = 'online';
        
        // The most recent server state.
        let serverState: T = null;

        let build: () => ChannelConnection<T> = () => {
            let subs: SubscriptionLike[] = [];

            const canSave = saveState && getState;
            const localSaveKey = `${info.id}_local_state`;
            const serverSaveKey = `${info.id}_server_state`;

            if (canSave) {
                serverState = getState(serverSaveKey);
                const localState = getState(localSaveKey);
                store.init(localState);
            }

            if (serverEvents) {   
                // Pipe the server events into the subject.
                subs.push(serverEvents.pipe(map(e => ({
                    event: e,
                    isLocal: false
                }))).subscribe(subject));
            }

            if (!emitToStore) {
                emitToStore = e => {
                    store.process(e);
                };
            }

            if (connectionStates) {
                if(!getServerState) {
                    throw new Error('If the connection state observable is provided then getServerState must be as well.');
                }
                let distinct = connectionStates.pipe(distinctUntilChanged());
                disconnected = distinct.pipe(
                    filter(connected => !connected && (currentState === 'online' || currentState === 'online-disconnected')),
                    map(_ => currentState),
                    tap(_ => currentState = 'offline'),
                    filter(state => state !== 'online-disconnected'),
                    map(_ => serverState),
                    publish(),
                    refCount()
                );
                disconnectedSub = disconnected.subscribe();

                reconnected = distinct.pipe(
                    filter(connected => connected && currentState === 'offline'),
                    tap(_ => currentState = 'online-disconnected'),
                    flatMap(_ => getServerState()),
                    publish(),
                    refCount()
                );
                reconnectedSub = reconnected.subscribe();
            }

            const setServerState = (state: T) => {
                serverState = state;
                if (canSave) {
                    saveState(serverSaveKey, serverState);
                }
            };

            subs.push(subject.pipe(
                    tap(e => {
                        emitToStore(e.event);
                        const mostRecentState = store.state();
                        if (canSave) {
                            saveState(localSaveKey, mostRecentState);
                        }
                        if (emitToServer) {
                            if (e.isLocal && currentState === 'online') {
                                const p = emitToServer(e.event);
                                if (p && typeof p.then === 'function') {
                                    p.then(() => {
                                        setServerState(mostRecentState);
                                    }, ex => console.error(ex));
                                } else {
                                    setServerState(mostRecentState);
                                }
                            } else if (!e.isLocal) {
                                setServerState(mostRecentState);
                            }
                        }
                    }), 
                ).subscribe());

            return {
                emit: (event) => {
                    subject.next({
                        event,
                        isLocal: true
                    });
                },
                events: subject.pipe(map(e => e.event)),
                store: connection_request.store,
                info: connection_request.info,
                disconnected: disconnected || never(),
                reconnected: reconnected || never(),
                reconnect: () => {
                    if (currentState === 'online-disconnected') {
                        currentState = 'online';
                    }
                },
                unsubscribe: () => {
                    if (reconnectedSub) {
                        reconnectedSub.unsubscribe();
                    }
                    if (disconnectedSub) {
                        disconnectedSub.unsubscribe();
                    }
                    subs.forEach(s => s.unsubscribe());
                    subject.complete();
                    subject.unsubscribe();
                    onUnsubscribe.next({});
                    onUnsubscribe.complete();
                },

                get state() {
                    return currentState;
                }
            }
        };

        let helper: ConnectionHelper<T> = {
            build: build,
            setConnectionStateObservable: (states) => {
                connectionStates = states;
            },
            setServerEvents: (events) => {
                serverEvents = events;
            },
            setEmitToServerFunction: (fn) => {
                emitToServer = fn;
            },
            setEmitToStoreFunction: (fn) => {
                emitToStore = fn;
            },
            setGetRemoteServerStateFunction: (fn) => {
                getServerState = fn;
            },
            setSaveStateFunction: (fn) => {
                saveState = fn;
            },
            setGetStateFunction: (fn) => {
                getState = fn;
            },
            onUnsubscribe: onUnsubscribe.pipe(first()),
        };

        return helper;
    }
}