/**
 * Shared plumbing for the rules tests in this folder: one emulator environment
 * per file, wiped before every test, plus helpers to seed data with the rules
 * switched off (so a test can then check who may read or change it).
 */
import type { RulesTestContext, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { asGuest, asUser, createRulesEnv } from './env';

export type TestFirestore = ReturnType<RulesTestContext['firestore']>;
export type TestStorage = ReturnType<RulesTestContext['storage']>;

/**
 * Registers the emulator lifecycle hooks for the calling test file and returns
 * a getter for the environment (it only exists once `beforeAll` has run).
 */
export function setupRulesEnv(): () => RulesTestEnvironment {
  let env: RulesTestEnvironment | undefined;

  beforeAll(async () => {
    env = await createRulesEnv();
  });
  beforeEach(async () => {
    await env!.clearFirestore();
    await env!.clearStorage();
  });
  afterAll(async () => {
    await env?.cleanup();
  });

  return () => {
    if (!env) throw new Error('The rules environment is not ready yet.');
    return env;
  };
}

/** Writes a Firestore document, bypassing the rules. */
export function seedDoc(
  env: RulesTestEnvironment,
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  return env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

/** Uploads a Storage object, bypassing the rules. */
export function seedFile(
  env: RulesTestEnvironment,
  path: string,
  contentType = 'application/octet-stream'
): Promise<void> {
  return env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), new Uint8Array([1, 2, 3]), { contentType });
  });
}

/** Everyone, other than the owner, who must be kept out of a user's data. */
export const OUTSIDERS = [
  'another signed-in user',
  'an admin who is not the owner',
  'a guest',
] as const;
export type Outsider = (typeof OUTSIDERS)[number];

export function outsider(env: RulesTestEnvironment, who: Outsider): RulesTestContext {
  switch (who) {
    case 'another signed-in user':
      return asUser(env, 'mallory');
    case 'an admin who is not the owner':
      return asUser(env, 'admin-user', { admin: true });
    case 'a guest':
      return asGuest(env);
  }
}
