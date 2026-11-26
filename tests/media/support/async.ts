/** Runs queued microtasks (fake Firestore listeners deliver on microtasks), without timers. */
export async function flushMicrotasks(rounds = 10) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
