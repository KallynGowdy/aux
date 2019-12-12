import { CausalRepoStore } from './CausalRepoStore';
import {
    CausalRepoBranch,
    CausalRepoObject,
    getObjectHash,
} from './CausalRepoObject';
import { sortedIndexBy, findIndex, sortBy } from 'lodash';

export class MemoryCausalRepoStore implements CausalRepoStore {
    private _map: Map<string, CausalRepoObject>;
    private _branches: CausalRepoBranch[];

    constructor() {
        this._map = new Map();
        this._branches = [];
    }

    async getObjects(keys: string[]): Promise<CausalRepoObject[]> {
        let results: CausalRepoObject[] = [];
        for (let key of keys) {
            let result = this._map.get(key);
            results.push(result);
        }

        return results;
    }

    async storeObjects(objects: CausalRepoObject[]): Promise<void> {
        for (let obj of objects) {
            const hash = getObjectHash(obj);
            this._map.set(hash, obj);
        }
    }

    async getBranches(prefix: string): Promise<CausalRepoBranch[]> {
        let branches: CausalRepoBranch[] = [];
        for (let branch of this._branches) {
            if (!prefix || branch.name.indexOf(prefix) === 0) {
                branches.push(branch);
            }
        }

        return sortBy(branches, b => b.name);
    }

    async saveBranch(head: CausalRepoBranch): Promise<void> {
        const index = findIndex(this._branches, b => b.name === head.name);
        if (index >= 0) {
            this._branches[index] = head;
        } else {
            this._branches.push(head);
        }
    }

    async deleteBranch(head: CausalRepoBranch): Promise<void> {
        const index = findIndex(this._branches, b => b.name === head.name);
        if (index >= 0) {
            this._branches.splice(index, 1);
        }
    }
}
