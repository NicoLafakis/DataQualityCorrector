import assert from 'assert';
import { jaroWinkler, normalizeKey } from '../lib/fuzzy.js';
import { recordAction, listActions, clearActions, undoAction } from '../lib/history.js';

console.log('Running unit tests...');

// fuzzy tests
assert(jaroWinkler('martha', 'marhta') > 0.9, 'Jaro-Winkler should consider martha~marhta similar');
assert(normalizeKey(' John.Doe@Example.com ') === 'john.doe@example.com', 'normalizeKey should strip punctuation and lower-case');

// history tests (localStorage shim)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
})();

global.localStorage = localStorageMock;

clearActions();
const a = recordAction('test', 't1', { foo: 'bar' }, { action: 'patch', payload: [{ id: '1', properties: { a: 1 } }] });
const list = listActions();
assert(list.length === 1 && list[0].id === a.id, 'recordAction/listActions should work');
const undo = undoAction(a.id);
assert(undo && undo.action === 'patch', 'undoAction should return undoPayload');

console.log('All unit tests passed');
