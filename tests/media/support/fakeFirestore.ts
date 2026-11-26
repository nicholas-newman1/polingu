/**
 * The sync tests' in-memory Firestore (tests/sync/support/fakeFirestore.ts), plus
 * what the audio and reader libraries also use:
 *   - `query(collectionRef, orderBy(field, direction))`, applied to the snapshot as
 *     Firestore applies it (documents missing the field are not returned).
 *   - `onSnapshot` on a single document: the listener hears the document's current
 *     state, then each change to it (not changes to its siblings). It listens through
 *     the parent collection, so `remote.calls` and `remote.fail({ op: 'onSnapshot' })`
 *     see the collection's path, not the document's.
 *
 * Install it with
 *
 *   vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
 */
import * as base from '../../sync/support/fakeFirestore';

export * from '../../sync/support/fakeFirestore';

type Data = Record<string, unknown>;
type Direction = 'asc' | 'desc';

export interface OrderByConstraint {
  readonly type: 'orderBy';
  readonly field: string;
  readonly direction: Direction;
}

export interface Query {
  readonly type: 'query';
  readonly path: string;
  readonly id: string;
  readonly order: OrderByConstraint[];
}

export function orderBy(field: string, direction: Direction = 'asc'): OrderByConstraint {
  return { type: 'orderBy', field, direction };
}

export function query(ref: base.CollectionReference, ...constraints: OrderByConstraint[]): Query {
  return { type: 'query', path: ref.path, id: ref.id, order: constraints };
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * Applies `orderBy` the way Firestore does: documents without an ordered field are
 * left out of the results, and ties are broken by document id in the direction of
 * the last `orderBy`.
 */
function ordered(snapshot: base.QuerySnapshot, order: OrderByConstraint[]): base.QuerySnapshot {
  const lastDirection = order.at(-1)?.direction ?? 'asc';
  const docs = snapshot.docs
    .filter((d) => order.every(({ field }) => d.data()?.[field] !== undefined))
    .sort((x, y) => {
      for (const { field, direction } of order) {
        const diff = compareValues(x.data()?.[field], y.data()?.[field]);
        if (diff !== 0) return direction === 'desc' ? -diff : diff;
      }
      const byId = x.id.localeCompare(y.id);
      return lastDirection === 'desc' ? -byId : byId;
    });
  return {
    ...snapshot,
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach(cb),
  };
}

function parentOf(path: string): base.CollectionReference {
  const parentPath = path.slice(0, path.lastIndexOf('/'));
  return {
    type: 'collection',
    path: parentPath,
    id: parentPath.slice(parentPath.lastIndexOf('/') + 1),
  };
}

function onDocumentSnapshot(
  ref: base.DocumentReference,
  onNext: (snapshot: base.DocumentSnapshot) => void,
  onError?: (error: Error) => void
): () => void {
  let lastDelivered: string | undefined;
  return base.onSnapshot(
    parentOf(ref.path),
    (snapshot) => {
      const data: Data | undefined = snapshot.docs.find((d) => d.id === ref.id)?.data();
      const state = JSON.stringify(data ?? null);
      // Writes to sibling documents also reach the collection listener; skip them.
      if (state === lastDelivered) return;
      lastDelivered = state;
      onNext({
        id: ref.id,
        ref,
        exists: () => data !== undefined,
        data: () => data,
        metadata: { fromCache: false, hasPendingWrites: false },
      });
    },
    onError
  );
}

export function onSnapshot(
  target: base.DocumentReference | base.CollectionReference | Query,
  onNext: (snapshot: never) => void,
  onError?: (error: Error) => void
): () => void {
  if (target.type === 'document') {
    return onDocumentSnapshot(target, onNext as (s: base.DocumentSnapshot) => void, onError);
  }
  const order = target.type === 'query' ? target.order : [];
  const collectionRef: base.CollectionReference = {
    type: 'collection',
    path: target.path,
    id: target.id,
  };
  return base.onSnapshot(
    collectionRef,
    (snapshot) => (onNext as (s: base.QuerySnapshot) => void)(ordered(snapshot, order)),
    onError
  );
}
