import { describe, expect, test, vi } from 'vitest';
import { isAdmin } from '../../src/shared/auth.js';
import { auth, createUser, installFakes } from '../support/sdk.js';

vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));

installFakes();

describe('isAdmin', () => {
  test('is true for a user with the admin custom claim', async () => {
    createUser('boss', { admin: true });
    expect(await isAdmin('boss')).toBe(true);
  });

  test('is false for a user without the claim', async () => {
    createUser('learner');
    expect(await isAdmin('learner')).toBe(false);
  });

  test('is false for a user with no custom claims at all', async () => {
    auth.users.set('bare', {});
    expect(await isAdmin('bare')).toBe(false);
  });

  test('is false for a falsy admin claim', async () => {
    auth.users.set('demoted', { customClaims: { admin: false } });
    expect(await isAdmin('demoted')).toBe(false);
  });

  test('is false for an unknown user', async () => {
    expect(await isAdmin('ghost')).toBe(false);
  });

  test('is false when the auth lookup fails', async () => {
    createUser('boss', { admin: true });
    auth.failure = new Error('auth backend unavailable');
    expect(await isAdmin('boss')).toBe(false);
  });
});
