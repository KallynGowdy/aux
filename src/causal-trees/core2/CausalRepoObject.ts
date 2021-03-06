import { AtomIndex, createIndex } from './AtomIndex';
import { Atom } from './Atom2';
import { getHash } from '@casual-simulation/crypto';
import { DisconnectionReason } from './CausalRepoSession';
import { UnwatchReason, WatchReason } from './CausalRepoEvents';

/**
 * Defines the possible objects that can exist in a causal repo.
 * All caual repo
 */
export type CausalRepoObject =
    | CausalRepoCommit
    | CausalRepoIndex
    | CausalRepoAtom;

/**
 * Defines a branch.
 * That is, a named pointer to a commit/index.
 */
export interface CausalRepoBranch {
    type: 'branch';

    /**
     * The name of the branch.
     */
    name: string;

    /**
     * The hash of the commit/index that this branch is pointing at.
     */
    hash: string;

    /**
     * The time that the branch was updated.
     */
    time?: Date;
}

/**
 * Defines a reflog.
 * That is, a record that records where a ref (i.e. branch) was pointing at a given moment in time.
 * Useful for recovering old states that a branch was at if it was reset to an unrelated commit.
 */
export interface CausalRepoReflog {
    type: 'reflog';

    /**
     * The name of the branch that this log entry represents.
     */
    branch: string;

    /**
     * The hash that the branch pointed to.
     */
    hash: string;

    /**
     * The time that the reflog was created at.
     */
    time: Date;
}

/**
 * Defines a sitelog.
 * That is, a record that records when a site connected to a branch.
 * Useful for recovering a list of atoms that have been created for a branch if the branch has not been saved.
 */
export interface CausalRepoSitelog {
    type: 'sitelog';

    /**
     * The name of the branch that this log entry represents.
     */
    branch: string;

    /**
     * The ID of the site that connected to the branch.
     */
    site: string;

    /**
     * The time that the sitelog was created at.
     */
    time: Date;

    /**
     * The type of the sitelog.
     */
    sitelogType?: CausalRepoSitelogType;

    /**
     * Additional information about what caused the site to watch/unwatch the branch.
     */
    connectionReason?: CausalRepoSitelogConnectionReason;
}

/**
 * Defines settings for a branch.
 * This is a separate record that is able to store arbitrary data about a branch.
 */
export interface CausalRepoBranchSettings {
    type: 'branch_settings';

    /**
     * The name of the branch that these settings represent.
     */
    branch: string;

    /**
     * The time that these settings were created on.
     */
    time: Date;

    /**
     * The password hash that is used to secure the branch.
     */
    passwordHash?: string;
}

/**
 * Defines a list of possible sitelog types.
 * - null means that the type is not specified.
 * - 'WATCH' means that the sitelog indicates that the branch was starting to be watched.
 * - 'UNWATCH' means that the sitelog indicates that the branch was stopped being watched.
 */
export type CausalRepoSitelogType = null | 'WATCH' | 'UNWATCH';

export type CausalRepoSitelogConnectionReason =
    | DisconnectionReason
    | WatchReason
    | UnwatchReason;

/**
 * Defines information about an index in a causal repo.
 */
export interface CausalRepoIndex {
    type: 'index';

    /**
     * The data in the index.
     */
    data: AtomIndex;
}

/**
 * Defines information about a commit in a causal repo.
 */
export interface CausalRepoCommit {
    type: 'commit';

    /**
     * The hash of the commit.
     *
     * The commit hash is created from the following pieces of data:
     * - The message.
     * - The time (formatted as an ISO 8601 date).
     * - The index hash.
     * - The previous commit.
     */
    hash: string;

    /**
     * The message contained in the commit.
     */
    message: string;

    /**
     * The time the commit was created.
     */
    time: Date;

    /**
     * The hash of the index that the commit references.
     */
    index: string;

    /**
     * The hash of the previous commit.
     */
    previousCommit: string;
}

/**
 * Defines information about an atom in a causal repo.
 */
export interface CausalRepoAtom {
    type: 'atom';

    /**
     * The atom.
     */
    data: Atom<any>;
}

/**
 * Creates a new causal repo branch.
 * @param name The name of the branch.
 * @param hash The hash that the branch points to.
 * @param time The time that the branch was updated.
 */
export function repoBranch(
    name: string,
    hash: string,
    time?: Date
): CausalRepoBranch {
    return {
        type: 'branch',
        name: name,
        hash: hash,
        time: time,
    };
}

/**
 * Creates a new CausalRepoBranch.
 * @param name The name of the branch.
 * @param ref The reference that the branch should point to.
 * @param time The time that the branch should store.
 */
export function branch(
    name: string,
    ref: CausalRepoCommit | CausalRepoIndex | string,
    time?: Date
): CausalRepoBranch {
    if (typeof ref === 'string') {
        return repoBranch(name, ref, time);
    }
    return repoBranch(name, getObjectHash(ref), time);
}

/**
 * Creates a reflog for the given branch.
 * @param head The branch.
 */
export function reflog(head: CausalRepoBranch): CausalRepoReflog {
    return {
        type: 'reflog',
        branch: head.name,
        hash: head.hash,
        time: new Date(),
    };
}

/**
 * Creates a sitelog for the given branch.
 * @param branch The branch.
 */
export function sitelog(
    branch: string,
    site: string,
    type?: CausalRepoSitelogType,
    connectionReason?: CausalRepoSitelogConnectionReason
): CausalRepoSitelog {
    return {
        type: 'sitelog',
        branch: branch,
        site: site,
        time: new Date(),
        sitelogType: type,
        connectionReason: connectionReason,
    };
}

/**
 * Creates settings for the given branch.
 * @param branch The branch.
 * @param passwordHash The password hash used to secure the branch.
 */
export function branchSettings(
    branch: string,
    passwordHash?: string
): CausalRepoBranchSettings {
    return {
        type: 'branch_settings',
        branch,
        time: new Date(),
        passwordHash,
    };
}

/**
 * Creates a new CausalRepoAtom.
 * @param atom The atom to include.
 */
export function repoAtom(atom: Atom<any>): CausalRepoAtom {
    return {
        type: 'atom',
        data: atom,
    };
}

/**
 * Creates a new CausalRepoIndex.
 * @param index The index to include.
 */
export function repoIndex(index: AtomIndex): CausalRepoIndex {
    return {
        type: 'index',
        data: index,
    };
}

/**
 * Creates a new CausalRepoIndex.
 * @param atoms The atoms to include in the index.
 */
export function index(...atoms: Atom<any>[]): CausalRepoIndex {
    return repoIndex(createIndex(atoms));
}

/**
 * Creates a new CausalRepoCommit.
 * @param message The message to include in the commit.
 * @param time The time to include in the commit.
 * @param indexHash The hash of the index to reference.
 * @param previousCommit The hash of the previous commit.
 */
export function repoCommit(
    message: string,
    time: Date,
    indexHash: string,
    previousCommit: string
): CausalRepoCommit {
    return {
        type: 'commit',
        message: message,
        time: time,
        index: indexHash,
        previousCommit: previousCommit,
        hash: getHash([message, time.toISOString(), indexHash, previousCommit]),
    };
}

/**
 * Creates a new CausalRepoCommit.
 * @param message The message to include in the commit.
 * @param time The time to include in the commit.
 * @param index The index that the commit points to.
 * @param previousCommit The previous commit.
 */
export function commit(
    message: string,
    time: Date,
    index: CausalRepoIndex | string,
    previousCommit: CausalRepoCommit | string
): CausalRepoCommit {
    return repoCommit(
        message,
        time,
        typeof index === 'string' ? index : getObjectHash(index),
        typeof previousCommit === 'string'
            ? previousCommit
            : getObjectHash(previousCommit)
    );
}

/**
 * Gets the hash that can be used to store or retrieve the given object.
 * @param obj The object.
 */
export function getObjectHash(obj: CausalRepoObject): string {
    if (!obj) {
        return null;
    } else if (obj.type === 'atom') {
        return obj.data.hash;
    } else if (obj.type === 'index') {
        return obj.data.hash;
    } else {
        return obj.hash;
    }
}
