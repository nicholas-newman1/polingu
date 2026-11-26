/**
 * In-memory stand-in for the parts of the `firebase/firestore` SDK that
 * src/lib/offlineDb and src/lib/storage use. Install it in a test file with
 *
 *   vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
 *
 * and drive it through `remote`:
 *   - `remote.seed(path, data)` / `remote.get(path)` read and write the "server".
 *   - `remote.offline = true` makes every call reject, like an unreachable server.
 *   - `remote.fail(...)` makes chosen calls reject (permission errors, flaky network).
 *   - `remote.hold(op)` pauses the next call of `op` until released, for races.
 *   - `remote.calls` records every call that reached the server.
 *
 * Writes are validated the way the real SDK validates them: `undefined` values
 * and custom class instances are rejected, `Date`s are stored as `Timestamp`s,
 * `serverTimestamp()` and `deleteField()` are resolved on write.
 */

type Data = Record<string, unknown>;

export type Op =
  | 'getDoc'
  | 'getDocs'
  | 'getDocsFromServer'
  | 'setDoc'
  | 'updateDoc'
  | 'deleteDoc'
  | 'batch.commit'
  | 'runTransaction'
  | 'onSnapshot';

export class FirestoreError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FirebaseError';
  }
}

export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static fromMillis(ms: number) {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromDate(date: Date) {
    return Timestamp.fromMillis(date.getTime());
  }
  static now() {
    return Timestamp.fromMillis(Date.now());
  }
  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }
  toDate() {
    return new Date(this.toMillis());
  }
}

export class FieldValue {
  readonly kind: 'serverTimestamp' | 'deleteField';
  constructor(kind: 'serverTimestamp' | 'deleteField') {
    this.kind = kind;
  }
}

export const serverTimestamp = () => new FieldValue('serverTimestamp');
export const deleteField = () => new FieldValue('deleteField');

// ---------------------------------------------------------------------------
// References

interface FirestoreHandle {
  readonly __fake: string;
}

export interface DocumentReference {
  readonly type: 'document';
  readonly path: string;
  readonly id: string;
}

export interface CollectionReference {
  readonly type: 'collection';
  readonly path: string;
  readonly id: string;
}

function joinPath(segments: string[]): string[] {
  const parts = segments.flatMap((s) => String(s).split('/')).filter((s) => s.length > 0);
  if (parts.length === 0) throw new Error('Empty Firestore path');
  return parts;
}

export function doc(_db: FirestoreHandle, ...segments: string[]): DocumentReference {
  const parts = joinPath(segments);
  if (parts.length % 2 !== 0) {
    throw new Error(`Invalid document reference ${parts.join('/')}: odd number of segments`);
  }
  return { type: 'document', path: parts.join('/'), id: parts[parts.length - 1] };
}

export function collection(_db: FirestoreHandle, ...segments: string[]): CollectionReference {
  const parts = joinPath(segments);
  if (parts.length % 2 !== 1) {
    throw new Error(`Invalid collection reference ${parts.join('/')}: even number of segments`);
  }
  return { type: 'collection', path: parts.join('/'), id: parts[parts.length - 1] };
}

// ---------------------------------------------------------------------------
// Values

function isPlainObject(value: unknown): value is Data {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Deep copy that keeps Timestamps (immutable) and FieldValues as they are. */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) as T;
  }
  return value;
}

/** Validate and convert a value the way the SDK does before it is written. */
function encode(value: unknown, field: string, path: string, allowDelete: boolean): unknown {
  if (value === undefined) {
    throw new FirestoreError(
      'invalid-argument',
      `Function called with invalid data. Unsupported field value: undefined (found in field ${field} in document ${path})`
    );
  }
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (value instanceof Timestamp) return value;
  if (value instanceof FieldValue) {
    if (value.kind === 'serverTimestamp') return Timestamp.now();
    if (!allowDelete) {
      throw new FirestoreError(
        'invalid-argument',
        `deleteField() can only be used with update() and set() with {merge:true} (found in field ${field})`
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => encode(v, `${field}.${i}`, path, false));
  }
  if (isPlainObject(value)) {
    const out: Data = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = encode(v, field ? `${field}.${k}` : k, path, allowDelete);
    }
    return out;
  }
  throw new FirestoreError(
    'invalid-argument',
    `Unsupported field value: a custom object (found in field ${field} in document ${path})`
  );
}

function encodeDocument(data: unknown, path: string, allowDelete: boolean): Data {
  if (!isPlainObject(data)) {
    throw new FirestoreError('invalid-argument', `Data must be an object, in document ${path}`);
  }
  return encode(data, '', path, allowDelete) as Data;
}

/** Apply `updateDoc`-style updates, with dotted field paths and deleteField(). */
function applyUpdate(target: Data, updates: Data): Data {
  const result = clone(target);
  for (const [fieldPath, value] of Object.entries(updates)) {
    const keys = fieldPath.split('.');
    let node: Data = result;
    for (const key of keys.slice(0, -1)) {
      if (!isPlainObject(node[key])) node[key] = {};
      node = node[key] as Data;
    }
    const last = keys[keys.length - 1];
    if (value instanceof FieldValue && value.kind === 'deleteField') delete node[last];
    else node[last] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Server state and controls

interface FailureRule {
  ops: Op[] | null;
  path: string | RegExp | null;
  remaining: number;
  error: () => Error;
}

interface Listener {
  collectionPath: string;
  onNext: (snapshot: QuerySnapshot) => void;
  onError?: (error: Error) => void;
}

function pathMatches(rule: string | RegExp | null, path: string): boolean {
  if (rule === null) return true;
  if (typeof rule === 'string') return path === rule || path.startsWith(rule + '/');
  return rule.test(path);
}

function parentCollection(docPath: string): string {
  return docPath.slice(0, docPath.lastIndexOf('/'));
}

class RemoteFirestore {
  readonly docs = new Map<string, Data>();
  readonly calls: Array<{ op: Op; path: string }> = [];
  /** Every call rejects with `unavailable` while true. */
  offline = false;
  /** `getDocsFromServer` reports `metadata.fromCache` as this value. */
  serverSnapshotsFromCache = false;
  private failures: FailureRule[] = [];
  private holds = new Map<Op, Array<{ gate: Promise<void> }>>();
  private listeners = new Set<Listener>();

  reset() {
    this.docs.clear();
    this.calls.length = 0;
    this.offline = false;
    this.serverSnapshotsFromCache = false;
    this.failures = [];
    this.holds.clear();
    this.listeners.clear();
  }

  /** Put a document on the server directly, bypassing the SDK (as another device would). */
  seed(path: string, data: object) {
    this.docs.set(path, encodeDocument(data, path, false));
    this.notify(parentCollection(path));
  }

  /** Remove a document from the server directly (as another device would). */
  remove(path: string) {
    this.docs.delete(path);
    this.notify(parentCollection(path));
  }

  get(path: string): Data | undefined {
    const data = this.docs.get(path);
    return data === undefined ? undefined : clone(data);
  }

  /** Documents directly inside a collection, keyed by id. */
  list(collectionPath: string): Record<string, Data> {
    const out: Record<string, Data> = {};
    for (const [path, data] of this.docs) {
      if (parentCollection(path) === collectionPath)
        out[path.slice(collectionPath.length + 1)] = clone(data);
    }
    return out;
  }

  /** Calls of the given kinds that reached the server, as `op path` strings. */
  callsTo(...ops: Op[]): string[] {
    return this.calls.filter((c) => ops.includes(c.op)).map((c) => `${c.op} ${c.path}`);
  }

  /**
   * Make matching calls reject. `path` matches a document or collection path,
   * or anything below it. Rejects every match unless `times` is given.
   */
  fail(
    match: { op?: Op | Op[]; path?: string | RegExp } = {},
    options: { times?: number; code?: string } = {}
  ) {
    const code = options.code ?? 'permission-denied';
    this.failures.push({
      ops: match.op === undefined ? null : Array.isArray(match.op) ? match.op : [match.op],
      path: match.path ?? null,
      remaining: options.times ?? Infinity,
      error: () => new FirestoreError(code, `Injected ${code}`),
    });
  }

  clearFailures() {
    this.failures = [];
  }

  /**
   * Pause the next call of `op`. The server state it sees is captured when it is
   * called; its result is delivered only after `release()`.
   */
  hold(op: Op): { release: () => void } {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const queue = this.holds.get(op) ?? [];
    queue.push({ gate });
    this.holds.set(op, queue);
    return { release };
  }

  /** Records the call and throws if the server is unreachable or a failure rule matches. */
  enter(op: Op, path: string): Promise<void> | null {
    this.calls.push({ op, path });
    if (this.offline) {
      throw new FirestoreError('unavailable', 'Failed to reach Cloud Firestore backend');
    }
    for (const rule of this.failures) {
      if (rule.remaining <= 0) continue;
      if (rule.ops && !rule.ops.includes(op)) continue;
      if (!pathMatches(rule.path, path)) continue;
      rule.remaining--;
      throw rule.error();
    }
    const queue = this.holds.get(op);
    const held = queue?.shift();
    return held ? held.gate : null;
  }

  write(path: string, data: Data | null) {
    if (data === null) this.docs.delete(path);
    else this.docs.set(path, data);
  }

  addListener(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Deliver the current state of `collectionPath` to its listeners. */
  notify(collectionPath: string) {
    if (this.offline) return;
    for (const listener of this.listeners) {
      if (listener.collectionPath !== collectionPath) continue;
      const snapshot = makeQuerySnapshot(collectionPath, false);
      queueMicrotask(() => listener.onNext(snapshot));
    }
  }

  /** Re-deliver every listened-to collection, as a reconnecting SDK would. */
  reconnect() {
    this.offline = false;
    const paths = new Set([...this.listeners].map((l) => l.collectionPath));
    for (const path of paths) this.notify(path);
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

export const remote = new RemoteFirestore();

// ---------------------------------------------------------------------------
// Snapshots

export interface DocumentSnapshot {
  id: string;
  ref: DocumentReference;
  exists(): boolean;
  data(): Data | undefined;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
}

export interface QuerySnapshot {
  docs: Array<DocumentSnapshot & { data(): Data }>;
  size: number;
  empty: boolean;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
  forEach(cb: (d: DocumentSnapshot & { data(): Data }) => void): void;
}

function makeDocumentSnapshot(path: string): DocumentSnapshot {
  const data = remote.get(path);
  const ref = doc({ __fake: 'firestore' }, path);
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
    metadata: { fromCache: false, hasPendingWrites: false },
  };
}

function makeQuerySnapshot(collectionPath: string, fromCache: boolean): QuerySnapshot {
  const entries = Object.entries(remote.list(collectionPath)).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const docs = entries.map(([id, data]) => ({
    id,
    ref: doc({ __fake: 'firestore' }, collectionPath, id),
    exists: () => true,
    data: () => clone(data),
    metadata: { fromCache, hasPendingWrites: false },
  }));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    metadata: { fromCache, hasPendingWrites: false },
    forEach: (cb) => docs.forEach(cb),
  };
}

// ---------------------------------------------------------------------------
// SDK functions

async function call<T>(op: Op, path: string, run: () => T): Promise<T> {
  // Let the caller's synchronous code finish first, as a real network call would.
  await Promise.resolve();
  const gate = remote.enter(op, path);
  if (gate) {
    const result = run();
    await gate;
    return result;
  }
  return run();
}

export function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  return call('getDoc', ref.path, () => makeDocumentSnapshot(ref.path));
}

export function getDocs(ref: CollectionReference): Promise<QuerySnapshot> {
  return call('getDocs', ref.path, () => makeQuerySnapshot(ref.path, false));
}

export function getDocsFromServer(ref: CollectionReference): Promise<QuerySnapshot> {
  return call('getDocsFromServer', ref.path, () =>
    makeQuerySnapshot(ref.path, remote.serverSnapshotsFromCache)
  );
}

export async function setDoc(ref: DocumentReference, data: unknown): Promise<void> {
  // Validation happens before anything is sent, so it fails even offline.
  const encoded = encodeDocument(data, ref.path, false);
  await call('setDoc', ref.path, () => undefined);
  remote.write(ref.path, encoded);
  remote.notify(parentCollection(ref.path));
}

export async function updateDoc(ref: DocumentReference, data: unknown): Promise<void> {
  const encoded = encodeDocument(data, ref.path, true);
  await call('updateDoc', ref.path, () => undefined);
  const existing = remote.docs.get(ref.path);
  if (!existing) {
    throw new FirestoreError('not-found', `No document to update: ${ref.path}`);
  }
  remote.write(ref.path, applyUpdate(existing, encoded));
  remote.notify(parentCollection(ref.path));
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  await call('deleteDoc', ref.path, () => undefined);
  remote.write(ref.path, null);
  remote.notify(parentCollection(ref.path));
}

type PendingWrite =
  | { kind: 'set'; path: string; data: Data }
  | { kind: 'update'; path: string; data: Data }
  | { kind: 'delete'; path: string };

function commitWrites(writes: PendingWrite[]) {
  for (const w of writes) {
    if (w.kind === 'update' && !remote.docs.has(w.path)) {
      throw new FirestoreError('not-found', `No document to update: ${w.path}`);
    }
  }
  const touched = new Set<string>();
  for (const w of writes) {
    if (w.kind === 'set') remote.write(w.path, w.data);
    else if (w.kind === 'delete') remote.write(w.path, null);
    else remote.write(w.path, applyUpdate(remote.docs.get(w.path)!, w.data));
    touched.add(parentCollection(w.path));
  }
  touched.forEach((path) => remote.notify(path));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches the SDK signature
export function writeBatch(_db: FirestoreHandle) {
  const writes: PendingWrite[] = [];
  const batch = {
    set(ref: DocumentReference, data: unknown) {
      writes.push({ kind: 'set', path: ref.path, data: encodeDocument(data, ref.path, false) });
      return batch;
    },
    update(ref: DocumentReference, data: unknown) {
      writes.push({ kind: 'update', path: ref.path, data: encodeDocument(data, ref.path, true) });
      return batch;
    },
    delete(ref: DocumentReference) {
      writes.push({ kind: 'delete', path: ref.path });
      return batch;
    },
    async commit() {
      const paths = writes.map((w) => w.path).join(',');
      await call('batch.commit', paths, () => undefined);
      commitWrites(writes);
    },
  };
  return batch;
}

export interface Transaction {
  get(ref: DocumentReference): Promise<DocumentSnapshot>;
  set(ref: DocumentReference, data: unknown): Transaction;
  update(ref: DocumentReference, data: unknown): Transaction;
  delete(ref: DocumentReference): Transaction;
}

export async function runTransaction<T>(
  _db: FirestoreHandle,
  updateFunction: (tx: Transaction) => Promise<T>
): Promise<T> {
  await call('runTransaction', '', () => undefined);
  const writes: PendingWrite[] = [];
  const tx: Transaction = {
    async get(ref) {
      if (remote.offline) {
        throw new FirestoreError('unavailable', 'Failed to reach Cloud Firestore backend');
      }
      return makeDocumentSnapshot(ref.path);
    },
    set(ref, data) {
      writes.push({ kind: 'set', path: ref.path, data: encodeDocument(data, ref.path, false) });
      return tx;
    },
    update(ref, data) {
      writes.push({ kind: 'update', path: ref.path, data: encodeDocument(data, ref.path, true) });
      return tx;
    },
    delete(ref) {
      writes.push({ kind: 'delete', path: ref.path });
      return tx;
    },
  };
  const result = await updateFunction(tx);
  if (remote.offline) {
    throw new FirestoreError('unavailable', 'Failed to reach Cloud Firestore backend');
  }
  commitWrites(writes);
  return result;
}

export function onSnapshot(
  ref: CollectionReference,
  onNext: (snapshot: QuerySnapshot) => void,
  onError?: (error: Error) => void
): () => void {
  const listener: Listener = { collectionPath: ref.path, onNext, onError };
  const unsubscribe = remote.addListener(listener);
  if (remote.offline) {
    // The listener stays registered and hears from the server on reconnect().
    remote.calls.push({ op: 'onSnapshot', path: ref.path });
  } else {
    try {
      remote.enter('onSnapshot', ref.path);
      remote.notify(ref.path);
    } catch (e) {
      unsubscribe();
      if (onError) queueMicrotask(() => onError(e as Error));
    }
  }
  return () => {
    unsubscribe();
  };
}
