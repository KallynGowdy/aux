import {
    Atom,
    AtomId,
    AtomOp,
    idEquals,
    atomIdToString,
    atomMatchesChecksum,
} from './Atom';
import { keys } from 'lodash';
import { WeaveVersion, WeaveSiteVersion } from './WeaveVersion';
import { getHash } from '@casual-simulation/crypto';
import { RejectedAtom } from './RejectedAtom';

/**
 * Defines an atom that has a reference to the next atom in a linked list.
 */
export interface LinkedAtom<TOp extends AtomOp> {
    atom: Atom<TOp>;
    next: LinkedAtom<TOp>;
}

/**
 * Defines a weave.
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<TOp extends AtomOp> {
    private _root: LinkedAtom<TOp>;
    private _sites: Map<number, Map<number, LinkedAtom<TOp>>>;

    /**
     * Gets the list of atoms stored in this weave.
     * The order is the depth-first traversal of the causal tree.
     */
    get root() {
        return this._root;
    }

    /**
     * Gets the iterable list of linked atoms
     */
    get links(): IterableIterator<LinkedAtom<TOp>> {
        let _this = this;
        return (function*() {
            let current = _this.root;
            while (current) {
                yield current;
                current = current.next;
            }
        })();
    }

    /**
     * Gets the list of atoms stored in this weave.
     * The order is the depth-first traversal of the causal tree.
     */
    get atoms(): Atom<TOp>[] {
        let current = this.root;
        let arr: Atom<TOp>[] = [];
        while (current) {
            arr.push(current.atom);
            current = current.next;
        }
        return arr;
    }

    /**
     * Creates a new weave.
     */
    constructor() {
        this._root = null;
        this._sites = new Map();
    }

    /**
     * Inserts the given atom into the weave and returns it.
     * @param atom The atom.
     */
    insert<T extends TOp>(
        atom: Atom<T>
    ): [Atom<T> | null, RejectedAtom<T> | null] {
        if (!atomMatchesChecksum(atom)) {
            console.warn(
                `[Weave] Atom ${atomIdToString(
                    atom.id
                )} rejected because its checksum didn't match itself.`
            );
            return [
                null,
                {
                    atom: atom,
                    reason: 'checksum_failed',
                },
            ];
        }

        const site = this._getSite(atom.id.site);
        if (!atom.cause) {
            // check for an existing root atom
            if (this.root) {
                return [
                    null,
                    {
                        atom: atom,
                        reason: 'second_root_not_allowed',
                    },
                ];
            }

            // Add the atom at the root of the weave.
            this._root = {
                atom,
                next: null,
            };
            site.set(atom.id.timestamp, this.root);
            return [atom, null];
        } else {
            const cause = this.getLink(atom.cause);
            if (!cause) {
                return [
                    null,
                    {
                        atom: atom,
                        reason: 'cause_not_found',
                    },
                ];
            }

            const siteIndex = atom.id.timestamp;

            if (site.has(siteIndex)) {
                const existingAtom = site.get(siteIndex);
                if (existingAtom && idEquals(existingAtom.atom.id, atom.id)) {
                    return [<Atom<T>>existingAtom.atom, null];
                }
            }

            let current = cause;
            let next = cause.next;
            while (next) {
                const order = this._compareAtomIds(atom.id, next.atom.id);
                if (order < 0) {
                    break;
                }

                if (atom.cause.timestamp < cause.atom.id.timestamp) {
                    break;
                }

                current = next;
                next = next.next;
            }

            const link: LinkedAtom<TOp> = {
                atom: atom,
                next: next,
            };

            current.next = link;

            site.set(siteIndex, link);
            return [atom, null];
        }
    }

    /**
     * Inserts the given list of atoms into the weave.
     * @param atoms The atoms to insert.
     */
    insertMany<T extends TOp>(...atoms: Atom<T>[]) {
        atoms.forEach(a => {
            this.insert(a);
        });
    }

    /**
     * Removes the given reference from the weave.
     * Returns the references that were removed.
     * @param ref The reference to remove.
     */
    remove(ref: Atom<TOp>): Atom<TOp>[] {
        // if (!ref) {
        //     return [];
        // }
        // const span = this._getSpan(ref);
        // if (!span) {
        //     return [];
        // }
        // return this._removeSpan(span.index, span.length);
        return [];
    }

    /**
     * Removes all of the siblings of the given atom that happened before it.
     * Returns the references that were removed.
     * @param atom The reference whose older siblings should be removed.
     */
    removeBefore(atom: Atom<TOp>): Atom<TOp>[] {
        // if (!atom) {
        //     return [];
        // }
        // if (!atom.cause) {
        //     return [];
        // }
        // const cause = this.getAtom(atom.cause);
        // if (!cause) {
        //     return [];
        // }
        // const causeSize = this.getAtomSize(cause.id);
        // const atomSize = this.getAtomSize(atom.id);
        // const diff = causeSize - atomSize;
        // if (diff === 1) {
        //     // There's nothing to remove because the atom is the only child
        //     // of the cause.
        //     return [];
        // }

        // const causeSpan = this._getSpan(cause);
        // if (!causeSpan) {
        //     return [];
        // }
        // const refSpan = this._getSpan(atom, causeSpan.index);
        // if (!refSpan) {
        //     return [];
        // }
        // const startSplice = refSpan.index + refSpan.length;
        // const endSplice = causeSpan.index + causeSpan.length;
        // const spliceLength = endSplice - startSplice;
        // return this._removeSpan(startSplice, spliceLength);

        return [];
    }

    // private _removeSpan(index: number, length: number) {
    //     let removed = this._atoms.splice(index, length);
    //     for (let i = removed.length - 1; i >= 0; i--) {
    //         const r = removed[i];

    //         const chain = this.referenceChain(r);
    //         for (let b = 1; b < chain.length; b++) {
    //             const id = chain[b].id;
    //             const current = this.getAtomSize(id);
    //             this._sizeMap.set(id, current - 1);
    //         }

    //         this._sizeMap.delete(r.id);
    //         const site = this._getSite(r.id.site);
    //         delete site[r.id.timestamp];
    //     }
    //     return removed;
    // }

    /**
     * Gets the atom for the given reference.
     * @param id The reference.
     */
    getAtom<T extends TOp>(id: AtomId): Atom<T> {
        const link = this.getLink<T>(id);
        if (link) {
            return link.atom;
        } else {
            return null;
        }
    }

    /**
     * Gets the atom for the given reference.
     * @param reference The reference.
     */
    getLink<T extends TOp>(id: AtomId): LinkedAtom<T> {
        if (!id) {
            return null;
        }
        const site = this._getSite(id.site);
        return <LinkedAtom<T>>site.get(id.timestamp);
    }

    /**
     * Gets the version that this weave is currently at.
     */
    getVersion(): WeaveVersion {
        let knownSites = this.siteIds();
        let sites: WeaveSiteVersion = {};

        knownSites.forEach(id => {
            const site = this._getSite(id);
            sites[id] = site.size - 1;
        });

        return {
            sites,
            hash: this.getHash(),
        };
    }

    /**
     * Gets the hash of the weave.
     */
    getHash(): string {
        return getHash(this.atoms);
    }

    /**
     * Gets a new weave that contains only the atoms needed to keep the given version consistent.
     * @param version The version of the weave to get.
     */
    getWeft(
        version: WeaveSiteVersion,
        preserveChildren: boolean = false
    ): Weave<TOp> {
        // let newWeave = this.copy();

        // if (preserveChildren) {
        //     // travel from leaf nodes to the root node
        //     for (let i = newWeave.atoms.length - 1; i >= 0; i--) {
        //         const atom = newWeave.atoms[i];
        //         const id = atom.id;
        //         const site = id.site;
        //         const oldestAllowed = version[site];
        //         if (!oldestAllowed || id.timestamp > oldestAllowed) {
        //             // When preserving children,
        //             // we only remove an atom if it has no children.
        //             if (newWeave.getAtomSize(id) === 1) {
        //                 newWeave.remove(atom);
        //             }
        //         }
        //     }
        // } else {
        //     for (let i = 0; i < newWeave.atoms.length; i++) {
        //         const atom = newWeave.atoms[i];
        //         const id = atom.id;
        //         const site = id.site;
        //         const oldestAllowed = version[site];
        //         if (!oldestAllowed || id.timestamp > oldestAllowed) {
        //             newWeave.remove(atom);
        //             i -= 1;
        //         }
        //     }
        // }
        // newWeave._trimSites();

        // return newWeave;

        return null;
    }

    /**
     * Gets the list of atoms that are children of the given atom.
     * @param parent The atom to find the children of.
     */
    decendants(parent: Atom<TOp>) {
        const _this = this;
        return (function*() {
            let atom = _this.getLink(parent.id);
            if (!atom) {
                return;
            }
            let child = atom.next;
            while (
                child &&
                atom.atom.id.timestamp <= child.atom.cause.timestamp
            ) {
                yield child.atom;
                atom = child;
                child = child.next;
            }
        })();

        // const size = this.getAtomSize(parent.id);
        // if (size) {
        //     const index = this._atomIndexOf(parent);
        //     if (index >= 0) {
        //         return this.atoms.slice(index + 1, index + size);
        //     }
        // }
        // return [];
    }

    /**
     * Constructs a new weave that contains the smallest possible valid causal history for the given list
     * of parent atoms.
     * @param parents The list of atoms that should be kept in the weave.
     */
    subweave(...parents: Atom<TOp>[]): Weave<TOp> {
        const weaves = parents.map(atom => {
            const children = this.decendants(atom);
            let chain = this.referenceChain(atom);
            chain.reverse();
            return [...chain, ...children];
        });

        let newWeave = new Weave<TOp>();
        for (let i = 0; i < weaves.length; i++) {
            let weave = weaves[i];
            const [, rejected] = newWeave.import(weave);
            if (rejected.length > 0) {
                // Should be impossible to reject atoms because they were already in the weave.
                throw new Error(
                    '[Weave] Atoms were ignored or rejected when it should be impossible to due so.'
                );
            }
        }

        return newWeave;
    }

    /**
     * Copies this weave and returns the clone.
     */
    copy(): Weave<TOp> {
        let newWeave = new Weave<TOp>();
        newWeave.import([...this.atoms]);
        return newWeave;
    }

    /**
     * Imports the given list of atoms into this weave.
     * The atoms are assumed to be pre-sorted.
     * Returns the list of atoms that were added to the weave.
     * @param atoms The atoms to import into this weave.
     */
    import(atoms: Atom<TOp>[]): [Atom<TOp>[], RejectedAtom<TOp>[]] {
        let newAtoms: Atom<TOp>[] = [];
        let rejectedAtoms: RejectedAtom<TOp>[] = [];
        for (let i = 0; i < atoms.length; i++) {
            let [newAtom, rejected] = this.insert(atoms[i]);
            if (newAtom) {
                newAtoms.push(newAtom);
            } else {
                rejectedAtoms.push(rejected);
            }
        }

        return [newAtoms, rejectedAtoms];
    }

    /**
     * Gets the list of site IDs that this weave contains.
     */
    siteIds() {
        return [...this._sites.keys()].sort();
    }

    /**
     * Calculates the chain of references from the root directly to the given reference.
     * Returns the chain from the given reference to the rootmost reference.
     * @param weave The weave that the reference is from.
     * @param ref The reference.
     */
    referenceChain(ref: Atom<TOp>): Atom<TOp>[] {
        let chain = [ref];

        let cause = ref.cause;
        while (cause) {
            const causeRef = this.getAtom(cause);

            if (!causeRef) {
                throw new Error(
                    `[Weave] Could not find cause for atom ${atomIdToString(
                        cause
                    )}`
                );
            }

            chain.push(causeRef);

            cause = causeRef.cause;
        }

        return chain;
    }

    /**
     * Determines if this causal tree is valid.
     */
    isValid(): boolean {
        if (!this._root) {
            return true;
        }

        let parents = [this._root.atom];
        for (let child of this.atoms) {
            let parent = parents[0];

            const existing = this.getAtom(child.id);
            if (!existing) {
                console.warn(
                    `[Weave] Invalid tree. ${atomIdToString(
                        child.id
                    )} was not able to be found by its ID. This means the site cache is out of date.`
                );
                return false;
            } else if (child.checksum !== existing.checksum) {
                console.warn(
                    `[Weave] Invalid tree. There is a duplicate ${atomIdToString(
                        child.id
                    )} in the tree. Checksums did not match.`
                );
                return false;
            }

            if (idEquals(child.cause, parent.cause)) {
                const order = this._compareAtoms(child, parent);

                // siblings
                if (order < 0) {
                    console.warn(
                        `[Weave] Invalid tree. ${atomIdToString(
                            child.id
                        )} says it happened before its sibling (${atomIdToString(
                            parent.id
                        )}) that occurred before it in the tree.`
                    );
                    return false;
                }
            }

            while (!idEquals(child.cause, parent.id)) {
                parents.shift();
                if (parents.length === 0) {
                    console.warn(
                        `[Weave] Invalid tree. ${atomIdToString(
                            child.id
                        )} is either inserted before ${atomIdToString(
                            child.cause
                        )} or the cause is not in the tree.`
                    );
                    return false;
                }
                parent = parents[0];
            }

            if (child.id.timestamp <= parent.id.timestamp) {
                console.warn(
                    `[Weave] Invalid tree. ${atomIdToString(
                        child.id
                    )} says it happened before its parent ${atomIdToString(
                        child.cause
                    )}.`
                );
                return false;
            }

            parents.unshift(child);
        }

        return true;
    }

    /**
     * Gets the list of atoms for a site.
     * @param site The site identifier.
     */
    getSite(siteId: number): Map<number, LinkedAtom<TOp>> {
        let site = this._sites.get(siteId);
        if (typeof site === 'undefined') {
            site = new Map();
            this._sites.set(siteId, site);
        }
        return site;
    }

    /**
     * Compares the two atoms to see which should be sorted in front of the other.
     * Returns -1 if the first should be before the second.
     * Returns 0 if they are equal.
     * Returns 1 if the first should be after the second.
     * @param first The first atom.
     * @param second The second atom.
     */
    private _compareAtoms(first: Atom<TOp>, second: Atom<TOp>): number {
        const cause = this._compareAtomIds(first.cause, second.cause);
        if (cause === 0) {
            return this._compareAtomIds(first.id, second.id);
        }
        return cause;
    }

    /**
     * Determines if the first atom ID should sort before, at, or after the second atom ID.
     * Returns -1 if the first should be before the second.
     * Returns 0 if the IDs are equal.
     * Returns 1 if the first should be after the second.
     * @param first The first atom ID.
     * @param second The second atom ID.
     */
    private _compareAtomIds(first: AtomId, second: AtomId) {
        if (!first && second) {
            return -1;
        } else if (!second && first) {
            return 1;
        } else if (first === second) {
            return 0;
        }
        if (first.priority > second.priority) {
            return -1;
        } else if (first.priority < second.priority) {
            return 1;
        } else if (first.priority === second.priority) {
            if (first.timestamp > second.timestamp) {
                return -1;
            } else if (first.timestamp < second.timestamp) {
                return 1;
            } else if (first.timestamp === second.timestamp) {
                if (first.site < second.site) {
                    return -1;
                } else if (first.site > second.site) {
                    return 1;
                }
            }
        }
        return 0;
    }

    /**
     * Builds a weave from an array of atoms.
     * This array is assumed to already be sorted in the correct order.
     * If the array was obtained from Weave.atoms, then it will be in the correct order.
     * @param refs The atom references that the new weave should be built from.
     */
    static buildFromArray<TOp extends AtomOp>(refs: Atom<TOp>[]): Weave<TOp> {
        let weave = new Weave<TOp>();
        weave.import(refs);
        return weave;
    }
}

/**
 * Defines a map from site IDs to indexes in an array of atoms.
 * This is used to make it easy to jump to a specific site's atoms
 * even though they are stored in the same array.
 */
export interface SiteMap<TOp extends AtomOp> {
    [site: number]: Atom<TOp>[];
}

/**
 * Finds the index of the given atom in the given array.
 * Returns -1 if the atom could not be found.
 * @param arr The array to search through.
 * @param id The ID of the atom to find.
 * @param start The optional starting index.
 */
export function weaveIndexOf<TOp extends AtomOp>(
    arr: Atom<TOp>[],
    id: AtomId,
    start: number = 0
): number {
    for (let i = start; i < arr.length; i++) {
        const atom = arr[i];
        if (idEquals(atom.id, id)) {
            return i;
        }
    }

    return -1;
}
