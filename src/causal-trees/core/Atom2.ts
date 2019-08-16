/**
 * Defines an interface for objects which represent an Atom ID.
 */
export interface AtomId2 {
    /**
     * The ID of the site that created this atom.
     */
    site: string;

    /**
     * The timestamp of the atom.
     */
    timestamp: number;

    /**
     * The priority of the atom.
     */
    priority?: number;
}

/**
 * Creates a new Atom ID.
 * @param site The ID of the site that created the atom.
 * @param timestamp The timestamp.
 * @param priority The priority.
 */
export function atomId2(
    site: string,
    timestamp: number,
    priority?: number
): AtomId2 {
    return {
        site,
        timestamp,
        priority,
    };
}
