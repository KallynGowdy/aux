import {
    Atom,
    atom,
    atomId,
    atomHash,
    atomMatchesHash,
    atomIdToString,
    idEquals,
    isAtom,
} from './Atom2';

describe('Atom2', () => {
    describe('atom()', () => {
        it('should create an atom', () => {
            const a = atom(atomId('A', 1), null, {
                hello: 'awesome!',
            });

            expect(a).toBeDefined();
            expect(a).not.toBeNull();
            expect(a).toMatchSnapshot();
        });

        it('should be deterministic', () => {
            const a = atom(atomId('A', 1), null, {
                hello: 'awesome!',
            });

            const a1 = atom(atomId('A', 1), null, {
                hello: 'awesome!',
            });

            expect(a).toEqual(a1);
        });
    });

    describe('atomHash()', () => {
        it('should calculate the atom hash', () => {
            const hash1 = atomHash(atomId('A', 1), null, {});
            const hash2 = atomHash(atomId('A', 1), null, {});

            expect(hash1).toBe(hash2);
        });

        it('should include the cause', () => {
            const hash1 = atomHash(atomId('A', 1), null, {});
            const hash2 = atomHash(atomId('A', 1), hash1, {});

            expect(hash1).not.toBe(hash2);
        });

        it('should include the value', () => {
            const hash1 = atomHash(atomId('A', 1), null, {});
            const hash2 = atomHash(atomId('A', 1), null, {
                abc: 'def',
            });

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('atomMatchesHash()', () => {
        it('should return false if the hash is incorrect', () => {
            const cause = atom(atomId('def', 0), null, {});
            let a: Atom<any> = {
                id: atomId('abc', 1),
                cause: cause.id,
                value: 1,
                hash: 'wrong',
            };

            expect(atomMatchesHash(a, cause)).toBe(false);
        });

        it('should return true if the hash is correct', () => {
            const cause = atom(atomId('def', 0), null, {});
            const atom1 = atom(atomId('abc', 1), cause, 1);

            expect(atomMatchesHash(atom1, cause)).toBe(true);
        });
    });

    describe('atomIdToString()', () => {
        it('should include the timestamp, site, and priority', () => {
            expect(atomIdToString(atomId('a', 1))).toBe('a@1');
            expect(atomIdToString(atomId('b', 1, 110))).toBe('b@1:110');
            expect(atomIdToString(atomId('c', 3))).toBe('c@3');
        });
    });

    describe('idEquals()', () => {
        it('should be equal to other IDs', () => {
            expect(idEquals(atomId('a', 1), atomId('a', 1))).toBe(true);
            expect(idEquals(atomId('a', 2), atomId('a', 2))).toBe(true);
            expect(idEquals(atomId('b', 1), atomId('b', 1))).toBe(true);
            expect(idEquals(atomId('a', 1, 1), atomId('a', 1, 1))).toBe(true);

            expect(idEquals(atomId('a', 2), atomId('a', 1))).toBe(false);
            expect(idEquals(atomId('b', 1), atomId('a', 1))).toBe(false);
            expect(idEquals(atomId('b', 2), atomId('a', 1))).toBe(false);
            expect(idEquals(atomId('a', 1, 1), atomId('a', 1))).toBe(false);
            expect(idEquals(atomId('a', 1, 1), atomId('a', 1, 2))).toBe(false);
        });
    });

    describe('isAtom()', () => {
        it('should return true when given an atom', () => {
            const a1 = atom(atomId('a', 1), null, {});

            expect(isAtom(a1)).toBe(true);
        });
    });
});
