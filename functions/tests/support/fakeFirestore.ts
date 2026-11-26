/**
 * In-memory stand-in for the firebase-admin Firestore API, covering the calls
 * functions/src makes: collection/doc refs, get/set/update/delete, `where('==')`
 * and `limit` queries, transactions and batches, and the FieldValue sentinels.
 *
 * Writes follow Firestore's semantics where the code relies on them: `update`
 * fails on a missing document, dotted keys in `update` address nested fields,
 * `FieldValue.delete()` removes a field, and transaction writes are discarded
 * when the transaction callback throws.
 */

type Data = Record<string, unknown>;

class Sentinel {
  constructor(readonly kind: 'delete' | 'serverTimestamp') {}
}

const DELETE = new Sentinel('delete');
const SERVER_TIMESTAMP = new Sentinel('serverTimestamp');

export const FieldValue = {
  delete: () => DELETE,
  serverTimestamp: () => SERVER_TIMESTAMP,
};

function isPlainObject(value: unknown): value is Data {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Deep-copies arrays and plain objects; keeps sentinels and other instances by reference. */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) as T;
  }
  return value;
}

/** Applies a set() payload: removes fields set to FieldValue.delete(). */
function withoutDeletes(data: Data): Data {
  const out: Data = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === DELETE) continue;
    out[key] = isPlainObject(value) ? withoutDeletes(value) : clone(value);
  }
  return out;
}

function applyFieldPath(target: Data, path: string, value: unknown) {
  const parts = path.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(node[part])) node[part] = {};
    node = node[part] as Data;
  }
  const last = parts[parts.length - 1];
  if (value === DELETE) delete node[last];
  else node[last] = clone(value);
}

export class FirestoreError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
  }
}

export type WriteOp = 'set' | 'update' | 'delete';

export interface WriteRecord {
  op: WriteOp;
  path: string;
  data?: Data;
}

type FailureRule = { op?: WriteOp; path?: string | RegExp; error: Error; once: boolean };

export class FakeFirestore {
  readonly docs = new Map<string, Data>();
  /** Every committed write, in order. */
  readonly writes: WriteRecord[] = [];
  private failures: FailureRule[] = [];
  private failingReads = new Map<string, Error>();
  private autoId = 0;

  reset() {
    this.docs.clear();
    this.writes.length = 0;
    this.failures = [];
    this.failingReads.clear();
    this.autoId = 0;
  }

  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(this, path);
  }

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this, path);
  }

  batch() {
    const pending: Array<() => void> = [];
    const batch = {
      set: (ref: FakeDocRef, data: Data) => (
        pending.push(() => this.commitSet(ref.path, data)),
        batch
      ),
      update: (ref: FakeDocRef, data: Data) => (
        pending.push(() => this.commitUpdate(ref.path, data)),
        batch
      ),
      delete: (ref: FakeDocRef) => (pending.push(() => this.commitDelete(ref.path)), batch),
      commit: async () => {
        pending.forEach((write) => write());
      },
    };
    return batch;
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const result = await fn(tx);
    tx.pending.forEach((write) => write());
    return result;
  }

  /** Test setup: writes a document directly, bypassing failure rules and the write log. */
  seed(path: string, data: object) {
    this.docs.set(path, withoutDeletes(data as Data));
  }

  /** Test assertion: the stored data at `path`, or undefined. */
  data(path: string): Data | undefined {
    const stored = this.docs.get(path);
    return stored ? clone(stored) : undefined;
  }

  /** Paths of the documents directly inside a collection. */
  childPaths(collectionPath: string): string[] {
    const depth = collectionPath.split('/').length + 1;
    return [...this.docs.keys()].filter(
      (p) => p.startsWith(`${collectionPath}/`) && p.split('/').length === depth
    );
  }

  /** Makes the next matching write (or every one, with once=false) throw `error`. */
  failWrites(
    rule: { op?: WriteOp; path?: string | RegExp },
    error = new Error('write failed'),
    once = false
  ) {
    this.failures.push({ ...rule, error, once });
  }

  /** Makes reads of the document at `path` throw `error`. */
  failReads(path: string, error = new Error('read failed')) {
    this.failingReads.set(path, error);
  }

  nextId() {
    this.autoId += 1;
    return `auto-${this.autoId}`;
  }

  readDoc(path: string): FakeDocSnapshot {
    const error = this.failingReads.get(path);
    if (error) throw error;
    return new FakeDocSnapshot(new FakeDocRef(this, path), this.docs.get(path));
  }

  private checkFailure(op: WriteOp, path: string) {
    const index = this.failures.findIndex(
      (rule) =>
        (!rule.op || rule.op === op) &&
        (!rule.path || (typeof rule.path === 'string' ? rule.path === path : rule.path.test(path)))
    );
    if (index === -1) return;
    const rule = this.failures[index];
    if (rule.once) this.failures.splice(index, 1);
    throw rule.error;
  }

  commitSet(path: string, data: Data, options?: { merge?: boolean }) {
    this.checkFailure('set', path);
    const next = options?.merge
      ? { ...(this.docs.get(path) ?? {}), ...withoutDeletes(data) }
      : withoutDeletes(data);
    this.docs.set(path, next);
    this.writes.push({ op: 'set', path, data: clone(data) });
  }

  commitUpdate(path: string, data: Data) {
    this.checkFailure('update', path);
    const existing = this.docs.get(path);
    if (!existing) throw new FirestoreError(5, `NOT_FOUND: No document to update: ${path}`);
    const next = clone(existing);
    for (const [key, value] of Object.entries(data)) applyFieldPath(next, key, value);
    this.docs.set(path, next);
    this.writes.push({ op: 'update', path, data: clone(data) });
  }

  commitDelete(path: string) {
    this.checkFailure('delete', path);
    this.docs.delete(path);
    this.writes.push({ op: 'delete', path });
  }
}

export class FakeDocSnapshot {
  constructor(
    readonly ref: FakeDocRef,
    private readonly stored: Data | undefined
  ) {}

  get id() {
    return this.ref.id;
  }

  get exists() {
    return this.stored !== undefined;
  }

  data(): Data | undefined {
    return this.stored ? clone(this.stored) : undefined;
  }
}

export class FakeDocRef {
  constructor(
    private readonly store: FakeFirestore,
    readonly path: string
  ) {}

  get id() {
    return this.path.split('/').pop()!;
  }

  collection(name: string) {
    return new FakeCollectionRef(this.store, `${this.path}/${name}`);
  }

  async get() {
    return this.store.readDoc(this.path);
  }

  async set(data: Data, options?: { merge?: boolean }) {
    this.store.commitSet(this.path, data, options);
  }

  async update(data: Data) {
    this.store.commitUpdate(this.path, data);
  }

  async delete() {
    this.store.commitDelete(this.path);
  }
}

class FakeQuerySnapshot {
  constructor(readonly docs: FakeDocSnapshot[]) {}

  get size() {
    return this.docs.length;
  }

  get empty() {
    return this.docs.length === 0;
  }

  forEach(fn: (doc: FakeDocSnapshot) => void) {
    this.docs.forEach(fn);
  }
}

type Filter = { field: string; value: unknown };

export class FakeQuery {
  constructor(
    protected readonly store: FakeFirestore,
    readonly path: string,
    private readonly filters: Filter[] = [],
    private readonly max?: number
  ) {}

  where(field: string, op: string, value: unknown) {
    if (op !== '==') throw new Error(`FakeFirestore only supports '==' queries, got ${op}`);
    return new FakeQuery(this.store, this.path, [...this.filters, { field, value }], this.max);
  }

  limit(max: number) {
    return new FakeQuery(this.store, this.path, this.filters, max);
  }

  async get() {
    let docs = this.store
      .childPaths(this.path)
      .map((p) => this.store.readDoc(p))
      .filter((snap) => this.filters.every(({ field, value }) => snap.data()?.[field] === value));
    if (this.max !== undefined) docs = docs.slice(0, this.max);
    return new FakeQuerySnapshot(docs);
  }
}

export class FakeCollectionRef extends FakeQuery {
  get id() {
    return this.path.split('/').pop()!;
  }

  doc(id?: string) {
    return new FakeDocRef(this.store, `${this.path}/${id ?? this.store.nextId()}`);
  }
}

export class FakeTransaction {
  readonly pending: Array<() => void> = [];

  constructor(private readonly store: FakeFirestore) {}

  async get(target: FakeDocRef | FakeQuery) {
    return target.get();
  }

  set(ref: FakeDocRef, data: Data) {
    this.pending.push(() => this.store.commitSet(ref.path, data));
    return this;
  }

  update(ref: FakeDocRef, data: Data) {
    this.pending.push(() => this.store.commitUpdate(ref.path, data));
    return this;
  }

  delete(ref: FakeDocRef) {
    this.pending.push(() => this.store.commitDelete(ref.path));
    return this;
  }
}
