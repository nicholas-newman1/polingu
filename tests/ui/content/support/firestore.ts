/**
 * The in-memory Firestore from tests/sync/support/fakeFirestore.ts, plus the few
 * extras the UI reaches for: `query`/`orderBy` (the library and audio lists) and
 * `onSnapshot` on a single document (waiting for an uploaded book to be processed).
 *
 *   vi.mock('firebase/firestore', () => import('./support/firestore'));
 */
import * as base from '../../../sync/support/fakeFirestore';
import {
  remote,
  type CollectionReference,
  type DocumentReference,
} from '../../../sync/support/fakeFirestore';

export * from '../../../sync/support/fakeFirestore';

type Data = Record<string, unknown>;

interface OrderBy {
  kind: 'orderBy';
  field: string;
  direction: 'asc' | 'desc';
}

export interface Query {
  type: 'query';
  path: string;
  ref: CollectionReference;
  constraints: OrderBy[];
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderBy {
  return { kind: 'orderBy', field, direction };
}

export function query(ref: CollectionReference, ...constraints: OrderBy[]): Query {
  return { type: 'query', path: ref.path, ref, constraints };
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function ordered(snapshot: base.QuerySnapshot, constraints: OrderBy[]): base.QuerySnapshot {
  const docs = [...snapshot.docs];
  for (const { field, direction } of [...constraints].reverse()) {
    docs.sort((x, y) => {
      const result = compareValues((x.data() ?? {})[field], (y.data() ?? {})[field]);
      return direction === 'asc' ? result : -result;
    });
  }
  return { ...snapshot, docs, forEach: (cb) => docs.forEach(cb) };
}

function documentSnapshot(ref: DocumentReference): base.DocumentSnapshot {
  const data = remote.get(ref.path);
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : ({ ...data } as Data)),
    metadata: { fromCache: false, hasPendingWrites: false },
  };
}

type AnyRef = CollectionReference | Query | DocumentReference;

export function onSnapshot(
  ref: AnyRef,
  onNext: (snapshot: never) => void,
  onError?: (error: Error) => void
): () => void {
  if (ref.type === 'collection') {
    return base.onSnapshot(ref, onNext as (s: base.QuerySnapshot) => void, onError);
  }
  if (ref.type === 'query') {
    return base.onSnapshot(
      ref.ref,
      (snapshot) => (onNext as (s: base.QuerySnapshot) => void)(ordered(snapshot, ref.constraints)),
      onError
    );
  }
  // A document listener hears every change to its collection and reports its own document.
  const parent = ref.path.slice(0, ref.path.lastIndexOf('/'));
  const collectionRef: CollectionReference = {
    type: 'collection',
    path: parent,
    id: parent.slice(parent.lastIndexOf('/') + 1),
  };
  return base.onSnapshot(
    collectionRef,
    () => (onNext as (s: base.DocumentSnapshot) => void)(documentSnapshot(ref)),
    onError
  );
}
