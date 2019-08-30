import Benchmark from 'benchmark';
import { Weave } from '../core/Weave';
import { atom, atomId } from '../core/Atom';

let insertSuite = new Benchmark.Suite('Weave#insert');

insertSuite.add('append 1000 atoms', async function(deferred: any) {
    let weave = new Weave();

    let root = atom(atomId(1, 0), null, { type: 1 });
    weave.insert(root);
    for (let i = 0; i < 10000; i++) {
        weave.insert(atom(atomId(1, i), root.id, { type: 1 }));
    }
});

insertSuite.add('nest 1000 atoms', async function(deferred: any) {
    let weave = new Weave();

    let last = atom(atomId(1, 0), null, { type: 1 });
    weave.insert(last);
    for (let i = 0; i < 1000; i++) {
        const next = atom(atomId(1, i), last.cause, { type: 1 });
        weave.insert(next);
        last = next;
    }
});

export default [insertSuite];
