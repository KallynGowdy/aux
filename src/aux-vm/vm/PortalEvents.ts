/**
 * Defines a list of portal events.
 */
export type PortalEvent = RegisterPortalEvent | UpdatePortalSourceEvent;

/**
 * Defines an event that indicates a portal was registered.
 */
export interface RegisterPortalEvent {
    type: 'register_portal';

    /**
     * The ID of the portal to register.
     */
    portalId: string;
}

/**
 * Defines an event that indicates the source code for a portal should be updated.
 */
export interface UpdatePortalSourceEvent {
    type: 'update_portal_source';

    /**
     * The ID of the portal.
     */
    portalId: string;

    /**
     * The source code to use.
     */
    source: string;
}