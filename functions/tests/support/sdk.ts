/**
 * Fakes for every external service Cloud Functions talk to, plus the module
 * shapes that test files hand to vi.mock. Each test file declares the mocks it
 * needs at the top, for example:
 *
 *   vi.mock('firebase-admin/app', () => import('./support/sdk.js').then((m) => m.adminApp));
 *   vi.mock('firebase-admin/firestore', () => import('./support/sdk.js').then((m) => m.adminFirestore));
 *
 * and calls installFakes() once, which resets all state before each test.
 *
 * firebase-functions itself is not faked: its onCall/onDocumentWritten/
 * onTaskDispatched/onObjectFinalized wrappers expose `.run(...)` for unit tests,
 * HttpsError is the real class, and defineSecret reads process.env, which
 * installFakes() fills with dummy keys.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { FakeFirestore, FieldValue } from './fakeFirestore.js';
import { FakeStorage } from './fakeStorage.js';

export const db = new FakeFirestore();
export const storage = new FakeStorage();

// --- firebase-admin/auth -------------------------------------------------------

type AuthUser = { customClaims?: Record<string, unknown> };

class FakeAuth {
  /** Users registered with createUser(); they survive the per-test reset. */
  readonly registered = new Map<string, AuthUser>();
  readonly users = new Map<string, AuthUser>();
  failure: Error | null = null;

  async getUser(uid: string) {
    if (this.failure) throw this.failure;
    const user = this.users.get(uid);
    if (!user) {
      throw Object.assign(new Error(`There is no user record for ${uid}.`), {
        code: 'auth/user-not-found',
      });
    }
    return { uid, customClaims: user.customClaims };
  }

  reset() {
    this.users.clear();
    this.registered.forEach((user, uid) => this.users.set(uid, user));
    this.failure = null;
  }
}

export const auth = new FakeAuth();

// --- firebase-admin/functions (Cloud Tasks queues) -----------------------------

export interface EnqueuedTask {
  queue: string;
  data: Record<string, unknown>;
  options: unknown;
}

class FakeTaskQueues {
  readonly enqueued: EnqueuedTask[] = [];
  failure: Error | null = null;

  taskQueue(queue: string) {
    return {
      enqueue: async (data: Record<string, unknown>, options?: unknown) => {
        if (this.failure) throw this.failure;
        this.enqueued.push({ queue, data, options });
      },
    };
  }

  reset() {
    this.enqueued.length = 0;
    this.failure = null;
  }
}

export const tasks = new FakeTaskQueues();

// --- openai ----------------------------------------------------------------------

type ChatParams = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  [key: string]: unknown;
};
type ChatReply = string | null | Error;

export interface FakeTranscription {
  duration?: number;
  segments?: Array<{ text: string; start: number; end: number }>;
  words?: Array<{ word: string; start: number; end: number }>;
}

class FakeOpenAIState {
  /** API keys passed to `new OpenAI(...)`, in order. */
  readonly apiKeys: string[] = [];
  readonly chatRequests: ChatParams[] = [];
  readonly transcriptionRequests: Array<Record<string, unknown>> = [];
  private replies: ChatReply[] = [];
  private fallback: ((params: ChatParams) => ChatReply) | null = null;
  transcription: FakeTranscription | Error = { duration: 0, segments: [], words: [] };

  /** Queues the content of the next chat completions, in order. */
  replyWith(...replies: ChatReply[]) {
    this.replies.push(...replies);
  }

  /** Answers every chat completion not covered by replyWith(). */
  replyAlways(fn: (params: ChatParams) => ChatReply) {
    this.fallback = fn;
  }

  async chat(params: ChatParams) {
    this.chatRequests.push(params);
    const reply = this.replies.length ? this.replies.shift()! : this.fallback?.(params);
    if (reply === undefined) throw new Error('FakeOpenAI: no scripted chat reply');
    if (reply instanceof Error) throw reply;
    return { choices: [{ message: { content: reply } }] };
  }

  async transcribe(params: Record<string, unknown>) {
    this.transcriptionRequests.push(params);
    if (this.transcription instanceof Error) throw this.transcription;
    return this.transcription;
  }

  reset() {
    this.apiKeys.length = 0;
    this.chatRequests.length = 0;
    this.transcriptionRequests.length = 0;
    this.replies = [];
    this.fallback = null;
    this.transcription = { duration: 0, segments: [], words: [] };
  }
}

export const openai = new FakeOpenAIState();

class FakeOpenAIClient {
  chat = { completions: { create: (params: ChatParams) => openai.chat(params) } };
  audio = {
    transcriptions: { create: (params: Record<string, unknown>) => openai.transcribe(params) },
  };

  constructor({ apiKey }: { apiKey: string }) {
    openai.apiKeys.push(apiKey);
  }
}

// --- @google-cloud/text-to-speech ---------------------------------------------

type TtsRequest = { input: { text: string }; voice: unknown; audioConfig: unknown };

class FakeTts {
  readonly requests: TtsRequest[] = [];
  /** Returns the audio for a text; null means "no audioContent", an Error fails the call. */
  respond: (text: string) => Buffer | null | Error = (text) => Buffer.from(`mp3(${text})`);

  async synthesize(request: TtsRequest) {
    this.requests.push(request);
    const result = this.respond(request.input.text);
    if (result instanceof Error) throw result;
    return [{ audioContent: result ?? undefined }];
  }

  reset() {
    this.requests.length = 0;
    this.respond = (text) => Buffer.from(`mp3(${text})`);
  }
}

export const tts = new FakeTts();

class FakeTextToSpeechClient {
  synthesizeSpeech(request: TtsRequest) {
    return tts.synthesize(request);
  }
}

// --- Module shapes for vi.mock ---------------------------------------------------

export const adminApp = { getApps: () => [{}], initializeApp: () => ({}) };
export const adminFirestore = { getFirestore: () => db, FieldValue };
export const adminStorage = { getStorage: () => storage };
export const adminAuth = { getAuth: () => auth };
export const adminFunctions = { getFunctions: () => tasks };
export const openaiModule = {
  default: FakeOpenAIClient,
  toFile: async (buffer: Buffer, name: string) => ({ name, buffer }),
};
export const ttsModule = { TextToSpeechClient: FakeTextToSpeechClient };

// --- Lifecycle ------------------------------------------------------------------

export const OPENAI_KEY = 'test-openai-key';
export const DEEPL_KEY = 'test-deepl-key';

/**
 * Resets every fake before each test, fills the function secrets with dummy keys,
 * makes any unstubbed fetch fail, and silences the functions' console logging.
 */
export function installFakes() {
  beforeEach(() => {
    db.reset();
    storage.reset();
    auth.reset();
    tasks.reset();
    openai.reset();
    tts.reset();
    vi.stubEnv('OPENAI_API_KEY', OPENAI_KEY);
    vi.stubEnv('DEEPL_API_KEY', DEEPL_KEY);
    vi.stubGlobal('fetch', (input: unknown) => {
      throw new Error(`Unmocked fetch in a functions test: ${String(input)}`);
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
}

// --- Users -------------------------------------------------------------------------

export interface TestUser {
  uid: string;
  admin?: boolean;
}

/**
 * Registers a user with Firebase Auth for every test in the file (with the admin
 * custom claim when `admin`) and returns it for call(). Callables read the claim
 * from the ID token; some code also looks the user up with the Admin SDK.
 */
export function createUser(uid: string, { admin = false } = {}): TestUser {
  const user = { customClaims: admin ? { admin: true } : {} };
  auth.registered.set(uid, user);
  auth.users.set(uid, user);
  return { uid, admin };
}
