/**
 * The in-memory Firestore from tests/sync/support/fakeFirestore.ts, plus the two
 * things the audio code needs on top of it:
 *   - `query(collection, orderBy(field, 'desc'))` listeners (the audio library lists),
 *   - `onSnapshot(doc(...))` listeners on a single document (the playing track).
 *
 * Install it in a test file with
 *
 *   vi.mock('firebase/firestore', () => import('./support/firestore'));
 */
import * as base from '../../sync/support/fakeFirestore';
import type {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
} from '../../sync/support/fakeFirestore';

export * from '../../sync/support/fakeFirestore';

interface OrderBy {
  readonly type: 'orderBy';
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

export interface Query {
  readonly type: 'query';
  readonly collection: CollectionReference;
  readonly orders: OrderBy[];
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderBy {
  return { type: 'orderBy', field, direction };
}

export function query(ref: CollectionReference, ...constraints: OrderBy[]): Query {
  return { type: 'query', collection: ref, orders: constraints };
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function sortSnapshot(snapshot: QuerySnapshot, orders: OrderBy[]): QuerySnapshot {
  const docs = [...snapshot.docs].sort((x, y) => {
    for (const order of orders) {
      const diff = compare(x.data()?.[order.field], y.data()?.[order.field]);
      if (diff !== 0) return order.direction === 'desc' ? -diff : diff;
    }
    return 0;
  });
  return { ...snapshot, docs, forEach: (cb) => docs.forEach(cb) };
}

type Listenable = CollectionReference | DocumentReference | Query;

export function onSnapshot(
  ref: Listenable,
  onNext: (snapshot: never) => void,
  onError?: (error: Error) => void
): () => void {
  if (ref.type === 'query') {
    return base.onSnapshot(
      ref.collection,
      (snapshot) => (onNext as (s: QuerySnapshot) => void)(sortSnapshot(snapshot, ref.orders)),
      onError
    );
  }
  if (ref.type === 'collection') {
    return base.onSnapshot(ref, onNext as (s: QuerySnapshot) => void, onError);
  }

  // A document listener hears its parent collection and passes on its own document,
  // only when that document changed, as the real SDK does. Its first snapshot goes to
  // it alone: subscribing must not re-deliver the collection to other listeners.
  const parentPath = ref.path.slice(0, ref.path.lastIndexOf('/'));
  let last: string | undefined;
  const deliver = (data: Record<string, unknown> | undefined) => {
    const key = JSON.stringify(data ?? null);
    if (key === last) return;
    last = key;
    const docSnapshot: DocumentSnapshot = {
      id: ref.id,
      ref,
      exists: () => data !== undefined,
      data: () => data,
      metadata: { fromCache: false, hasPendingWrites: false },
    };
    (onNext as (s: DocumentSnapshot) => void)(docSnapshot);
  };
  const unsubscribe = base.remote.addListener({
    collectionPath: parentPath,
    onNext: (snapshot) => deliver(snapshot.docs.find((d) => d.id === ref.id)?.data()),
    onError,
  });
  if (base.remote.offline) {
    base.remote.calls.push({ op: 'onSnapshot', path: ref.path });
  } else {
    try {
      base.remote.enter('onSnapshot', ref.path);
      queueMicrotask(() => deliver(base.remote.get(ref.path)));
    } catch (e) {
      unsubscribe();
      if (onError) queueMicrotask(() => onError(e as Error));
    }
  }
  return () => {
    unsubscribe();
  };
}
