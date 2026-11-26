/**
 * Builders for the requests and events Cloud Functions receive, so tests can run
 * a deployed function's handler through firebase-functions' own `.run(...)`.
 */
import type { CallableRequest } from 'firebase-functions/https';
import { db, type TestUser } from './sdk.js';

type Data = Record<string, unknown>;

interface Runnable<In, Out> {
  run(input: In): Out;
}

/** Calls a callable as `user` (signed out when omitted). */
export function call<Req, Res>(
  fn: Runnable<CallableRequest<Req>, Res>,
  data: Req,
  user?: TestUser
): Res {
  const authData = user && {
    uid: user.uid,
    token: { uid: user.uid, ...(user.admin && { admin: true }) },
    rawToken: 'test-id-token',
  };
  return fn.run({
    data,
    auth: authData,
    rawRequest: {},
    acceptsStreaming: false,
  } as unknown as CallableRequest<Req>);
}

/** Matches `users/u1/books/b1` against `users/{userId}/books/{bookId}`. */
function paramsFor(pattern: string, path: string): Record<string, string> {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) {
    throw new Error(`${path} does not match ${pattern}`);
  }
  const params: Record<string, string> = {};
  patternParts.forEach((part, i) => {
    const wildcard = part.match(/^\{(.+)\}$/);
    if (wildcard) params[wildcard[1]] = pathParts[i];
    else if (part !== pathParts[i]) throw new Error(`${path} does not match ${pattern}`);
  });
  return params;
}

function snapshot(path: string, data: Data | undefined) {
  return {
    exists: data !== undefined,
    id: path.split('/').pop(),
    ref: db.doc(path),
    data: () => (data === undefined ? undefined : structuredClone(data)),
  };
}

/**
 * Runs a Firestore onDocumentWritten trigger for a write of `path` from `before` to
 * `after` (undefined = absent). The fake database holds `after` when the trigger runs,
 * as Firestore does.
 */
export function runDocumentWrite<Out>(
  fn: Runnable<never, Out>,
  pattern: string,
  path: string,
  before: Data | undefined,
  after: Data | undefined
): Promise<Awaited<Out>> {
  if (after) db.seed(path, after);
  else db.docs.delete(path);
  const event = {
    params: paramsFor(pattern, path),
    data: { before: snapshot(path, before), after: snapshot(path, after) },
  };
  return Promise.resolve(fn.run(event as never));
}

export interface UploadedObject {
  name: string;
  bucket: string;
  size: number | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/** Runs a Storage onObjectFinalized trigger for `object`. */
export function runObjectFinalized<Out>(
  fn: Runnable<never, Out>,
  object: UploadedObject
): Promise<Awaited<Out>> {
  return Promise.resolve(fn.run({ data: object } as never));
}

/**
 * Runs a Cloud Tasks onTaskDispatched handler with `data` as the task payload.
 * `retryCount` mimics the X-CloudTasks-TaskRetryCount header (0 on the first attempt).
 */
export function runTask<Out>(
  fn: Runnable<never, Out>,
  data: Data,
  { retryCount }: { retryCount?: number } = {}
): Promise<Awaited<Out>> {
  return Promise.resolve(fn.run({ data, retryCount } as never));
}
