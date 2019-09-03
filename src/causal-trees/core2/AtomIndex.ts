import { getHash } from '@casual-simulation/crypto';
import { Atom, atomIdToString } from './Atom2';

/**
 * Defines a map of hashes to Atom IDs.
 */
export interface AtomHashList {
    [id: string]: string;
}

/**
 * Defines a map of Atom IDs to atoms.
 */
export interface AtomList {
    [id: string]: Atom<any>;
}

/**
 * Defines an index of atoms.
 * That is, a hashed list of atoms.
 */
export interface AtomIndex {
    /**
     * The hash of the index.
     */
    hash: string;

    /**
     * The atoms in the list.
     */
    atoms: AtomHashList;
}

/**
 * Defines an diff between atom indexes.
 */
export interface AtomIndexDiff {
    /**
     * The list of atoms that were added.
     */
    additions: AtomHashList;

    /**
     * The list of atoms that were deleted.
     */
    deletions: AtomHashList;
}

/**
 * Defines a diff between atom indexes where added and changed atoms have been
 * substituted with their full atom data.
 */
export interface AtomIndexFullDiff {
    /**
     * The list of atoms that were added.
     */
    addtions: Atom<any>[];

    /**
     * The list of atom hashes that were deleted.
     */
    deletions: string[];
}

/**
 * Creates a new weave index from the given list of atoms.
 * @param atoms The atoms.
 */
export function createIndex<T>(atoms: Atom<T>[]): AtomIndex {
    let atomList: AtomHashList = {};
    for (let atom of atoms) {
        atomList[atom.hash] = atomIdToString(atom.id);
    }
    const indexHash = hashAtoms(atoms);
    return {
        hash: indexHash,
        atoms: atomList,
    };
}

/**
 * Hashes the given list of atoms.
 * @param atoms The list of atoms to hash.
 */
export function hashAtoms<T>(atoms: Atom<T>[]): string {
    let hashes: string[] = [];
    for (let atom of atoms) {
        hashes.push(atom.hash);
    }
    hashes.sort();
    return getHash(hashes);
}

/**
 * Calculates the diff between the two atom indexes.
 * @param first The first index.
 * @param second The second index.
 */
export function calculateDiff(
    first: AtomIndex,
    second: AtomIndex
): AtomIndexDiff {
    if (first.hash === second.hash) {
        return {
            additions: {},
            deletions: {},
        };
    }

    let additions: AtomHashList = {};
    let deletions: AtomHashList = {};
    for (let id of Object.keys(first.atoms)) {
        let hash1 = first.atoms[id];
        let hash2 = second.atoms[id];

        if (!hash2) {
            deletions[id] = hash1;
        }
    }

    for (let id of Object.keys(second.atoms)) {
        let hash1 = first.atoms[id];
        let hash2 = second.atoms[id];

        if (!hash1) {
            additions[id] = hash2;
        }
    }

    return {
        additions,
        deletions,
    };
}
