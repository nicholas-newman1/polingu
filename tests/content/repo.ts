import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

/** A file checked into the repo, read the way the content scripts read it. */
export const readRepoText = (file: string) => readFileSync(resolve(ROOT, file), 'utf8');

export const readRepoJson = <T>(file: string): T => JSON.parse(readRepoText(file)) as T;

/**
 * Checks a rule's violations against the known data errors listed for it.
 *
 * Fails on any violation that is not allowlisted, so new content has to follow the rule.
 * Also fails on an allowlisted key that no longer violates it, so the list shrinks as the
 * data gets fixed instead of silently excusing a future regression of the same item.
 */
export function expectOnlyAllowlisted(
  violations: ReadonlyMap<string | number, string>,
  allowlist: Readonly<Record<string, string>>
) {
  const unexpected = [...violations]
    .filter(([key]) => !(String(key) in allowlist))
    .map(([key, detail]) => `${key}: ${detail}`);
  const fixed = Object.keys(allowlist).filter(
    (key) => ![...violations.keys()].some((found) => String(found) === key)
  );
  expect(unexpected, 'new violations: fix the data, or allowlist them with a reason').toEqual([]);
  expect(fixed, 'allowlisted items that are now valid: remove them from the allowlist').toEqual([]);
}

/** Collects `[key, detail]` for every item that breaks a rule. */
export function violationsOf<T>(
  items: readonly T[],
  key: (item: T) => string | number,
  problem: (item: T) => string | undefined | false
): Map<string | number, string> {
  const found = new Map<string | number, string>();
  for (const item of items) {
    const detail = problem(item);
    if (detail) found.set(key(item), detail);
  }
  return found;
}
