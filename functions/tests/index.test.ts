/**
 * Contracts between the deployed functions and their callers. A renamed export
 * deploys as a new function and deletes the old one, so these catch breakage
 * that no single function's tests would notice.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import * as deployed from '../src/index.js';
import * as queues from '../src/shared/queueNames.js';

vi.mock('firebase-admin/app', () => import('./support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () => import('./support/sdk.js').then((m) => m.adminFirestore));
vi.mock('firebase-admin/storage', () => import('./support/sdk.js').then((m) => m.adminStorage));

type Endpoint = {
  callableTrigger?: object;
  taskQueueTrigger?: object;
  eventTrigger?: { eventType: string };
  secretEnvironmentVariables?: Array<{ key: string }>;
};

const endpoints = Object.fromEntries(
  Object.entries(deployed).map(([name, fn]) => [name, (fn as { __endpoint: Endpoint }).__endpoint])
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Names passed to httpsCallable(functions, '<name>') anywhere in the web app. */
function callablesUsedByApp(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(resolve(__dirname, '../../src'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /httpsCallable[\s\S]*?\(\s*functions\s*,\s*'([A-Za-z]+)'/g
    )) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

const secretsOf = (name: string) =>
  (endpoints[name]?.secretEnvironmentVariables ?? []).map((s) => s.key).sort();

describe('deployed functions', () => {
  test('every callable the web app calls is deployed as a callable', () => {
    const used = callablesUsedByApp();
    expect(used.length).toBeGreaterThan(5);
    for (const name of used) {
      expect(endpoints[name]?.callableTrigger, `${name} is not a deployed callable`).toBeDefined();
    }
  });

  test('every task queue the code enqueues to has a deployed task handler', () => {
    for (const queue of Object.values(queues)) {
      expect(endpoints[queue]?.taskQueueTrigger, `nothing handles ${queue}`).toBeDefined();
    }
  });

  test.each([
    ['translate', ['DEEPL_API_KEY']],
    ['processSentence', ['DEEPL_API_KEY', 'OPENAI_API_KEY']],
    ['generateExample', ['OPENAI_API_KEY']],
    ['generateSentences', ['OPENAI_API_KEY']],
    ['discoverCurriculum', ['OPENAI_API_KEY']],
    ['transcribeAudio', ['OPENAI_API_KEY']],
    ['processSystemAudio', ['OPENAI_API_KEY']],
    ['processUserTextAudio', ['OPENAI_API_KEY']],
    ['onVocabularyExamplesWrite', ['OPENAI_API_KEY']],
    ['onCustomVocabularyExamplesWrite', ['OPENAI_API_KEY']],
  ])('%s is deployed with access to %j', (name, secrets) => {
    expect(secretsOf(name)).toEqual(secrets);
  });
});
