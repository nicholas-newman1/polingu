/**
 * In-memory stand-in for the firebase-admin Storage API: buckets of files that
 * can be saved, downloaded, moved and deleted. Missing files fail the way Cloud
 * Storage does (a 404 error), so code that ignores cleanup errors can be tested.
 */

export interface StoredFile {
  data: Buffer;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

class NotFoundError extends Error {
  readonly code = 404;
}

export class FakeStorage {
  /** Keyed by `${bucket}/${path}`. */
  readonly files = new Map<string, StoredFile>();
  readonly deleted: string[] = [];
  private failingSaves: RegExp[] = [];

  reset() {
    this.files.clear();
    this.deleted.length = 0;
    this.failingSaves = [];
  }

  bucket(name: string) {
    return new FakeBucket(this, name);
  }

  /** Test setup: puts a file in a bucket. */
  seed(bucket: string, path: string, file: Partial<StoredFile> & { data: Buffer }) {
    this.files.set(`${bucket}/${path}`, file);
  }

  /** Test assertion: the file at `bucket/path`, or undefined. */
  file(bucket: string, path: string) {
    return this.files.get(`${bucket}/${path}`);
  }

  /** Makes saves to matching `${bucket}/${path}` keys throw. */
  failSaves(pattern: RegExp) {
    this.failingSaves.push(pattern);
  }

  shouldFailSave(key: string) {
    return this.failingSaves.some((p) => p.test(key));
  }
}

class FakeBucket {
  constructor(
    private readonly storage: FakeStorage,
    readonly name: string
  ) {}

  file(path: string) {
    return new FakeFile(this.storage, this.name, path);
  }
}

class FakeFile {
  constructor(
    private readonly storage: FakeStorage,
    private readonly bucketName: string,
    readonly name: string
  ) {}

  private get key() {
    return `${this.bucketName}/${this.name}`;
  }

  private stored() {
    const file = this.storage.files.get(this.key);
    if (!file) throw new NotFoundError(`No such object: ${this.key}`);
    return file;
  }

  async save(
    data: Buffer,
    options: { contentType?: string; metadata?: Record<string, unknown> } = {}
  ) {
    if (this.storage.shouldFailSave(this.key)) throw new Error(`save failed: ${this.key}`);
    this.storage.files.set(this.key, {
      data,
      contentType: options.contentType,
      metadata: options.metadata,
    });
  }

  async download(): Promise<[Buffer]> {
    return [this.stored().data];
  }

  async getMetadata(): Promise<[{ contentType?: string; size: number }]> {
    const file = this.stored();
    return [{ contentType: file.contentType, size: file.data.length }];
  }

  async move(destination: string) {
    const file = this.stored();
    this.storage.files.delete(this.key);
    this.storage.files.set(`${this.bucketName}/${destination}`, file);
  }

  async delete() {
    this.stored();
    this.storage.files.delete(this.key);
    this.storage.deleted.push(this.key);
  }
}
