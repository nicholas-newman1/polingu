/**
 * Shared emulator environment for security rules tests. Run them with
 * `npm run test:rules`, which starts the Firestore and Storage emulators under
 * a `demo-` project id, so nothing here can reach the production project.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'demo-polingu';
const root = resolve(import.meta.dirname, '../..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Rules tests need the emulators. Run them with `npm run test:rules`.');
}

export function createRulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(root, 'storage.rules'), 'utf8') },
  });
}

/** Context for a signed-in user. Pass `{ admin: true }` for the admin claim. */
export const asUser = (
  env: RulesTestEnvironment,
  uid: string,
  claims: Record<string, unknown> = {}
) => env.authenticatedContext(uid, claims);

export const asGuest = (env: RulesTestEnvironment): RulesTestContext =>
  env.unauthenticatedContext();
