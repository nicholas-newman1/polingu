/**
 * The per-day session lists (reviewedToday, newCardsToday, newFormsToday) are
 * shared by every device the learner studies on, so their saves are merged with
 * the server's copy rather than overwriting it.
 *
 * A plain union would make removals impossible: the id would come straight back
 * from the other copy. So each add or removal is stamped in `changedAt`, keyed
 * `${list}:${id}`, and when two copies disagree about an id the later change
 * wins. Ids neither copy has a stamp for (data saved before stamps existed)
 * fall back to the old union.
 */

import type { SessionChanges } from '../../types/common';

export type { SessionChanges };

type SessionId = string | number;

interface SessionDoc {
  lastReviewDate: string;
  changedAt?: SessionChanges;
}

/** A key of `Store` holding one of the day's id lists. */
type ListKey<Store> = keyof Store & string;

const changeKey = (list: string, id: SessionId) => `${list}:${String(id)}`;

const sameId = (a: SessionId, b: SessionId) => String(a) === String(b);

/**
 * Adds `id` to (or removes it from) one of the day's lists, recording when, so
 * the change survives being merged with another device's copy.
 */
export function setInSessionList<Store extends SessionDoc, L extends ListKey<Store>>(
  store: Store,
  list: L,
  id: SessionId,
  present: boolean,
  now: number = Date.now()
): Store {
  const ids = store[list] as unknown as SessionId[];
  const has = ids.some((existing) => sameId(existing, id));
  let nextIds = ids;
  if (present && !has) nextIds = [...ids, id];
  if (!present && has) nextIds = ids.filter((existing) => !sameId(existing, id));
  return {
    ...store,
    [list]: nextIds,
    changedAt: { ...store.changedAt, [changeKey(list, id)]: now },
  };
}

/**
 * Takes a card out of today's reviewed and new lists ("Review again"), so it is
 * offered as a new card again today.
 */
export function removeFromDayLists<
  Store extends SessionDoc & { reviewedToday: SessionId[]; newCardsToday: SessionId[] },
>(store: Store, id: SessionId, now: number = Date.now()): Store {
  const next = setInSessionList(store, 'reviewedToday', id, false, now);
  return setInSessionList(next, 'newCardsToday', id, false, now);
}

/**
 * Starts a new day's lists when `store` is dated before `today`, so reviews made
 * after midnight in a session opened the day before are counted for the new day.
 */
export function startDayIfNeeded<Store extends SessionDoc>(
  store: Store,
  lists: ListKey<Store>[],
  today: string
): Store {
  if (store.lastReviewDate === today) return store;
  const fresh: Store = { ...store, lastReviewDate: today, changedAt: {} };
  for (const list of lists) (fresh as Record<string, unknown>)[list] = [];
  return fresh;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stamps(value: unknown): SessionChanges {
  return isRecord(value) ? (value as SessionChanges) : {};
}

/** Merges one list from two copies of the same day's session doc. */
function mergeList(
  list: string,
  serverIds: SessionId[],
  localIds: SessionId[],
  serverStamps: SessionChanges,
  localStamps: SessionChanges
): SessionId[] {
  const candidates: SessionId[] = [];
  for (const id of [...serverIds, ...localIds]) {
    if (!candidates.some((existing) => sameId(existing, id))) candidates.push(id);
  }

  return candidates.filter((id) => {
    const key = changeKey(list, id);
    const serverAt = serverStamps[key];
    const localAt = localStamps[key];
    if (serverAt === undefined && localAt === undefined) return true;
    const localWins = (localAt ?? -Infinity) >= (serverAt ?? -Infinity);
    const winner = localWins ? localIds : serverIds;
    return winner.some((existing) => sameId(existing, id));
  });
}

/**
 * Combines a session doc with the server's copy. When the dates differ the later
 * date wins outright, because a new day resets the lists. On the same day each
 * list is merged id by id (see the module comment).
 */
export function mergeSessionDocs(server: unknown, local: unknown): unknown {
  if (!isRecord(server) || !isRecord(local)) return local;

  const serverDate = typeof server.lastReviewDate === 'string' ? server.lastReviewDate : '';
  const localDate = typeof local.lastReviewDate === 'string' ? local.lastReviewDate : '';
  if (serverDate !== localDate) return localDate >= serverDate ? local : server;

  const serverStamps = stamps(server.changedAt);
  const localStamps = stamps(local.changedAt);
  const merged: Record<string, unknown> = { ...server, ...local };

  for (const [key, localValue] of Object.entries(local)) {
    const serverValue = server[key];
    if (Array.isArray(localValue) && Array.isArray(serverValue)) {
      merged[key] = mergeList(key, serverValue, localValue, serverStamps, localStamps);
    }
  }

  if (server.changedAt !== undefined || local.changedAt !== undefined) {
    const changedAt: SessionChanges = { ...serverStamps };
    for (const [key, at] of Object.entries(localStamps)) {
      changedAt[key] = Math.max(at, changedAt[key] ?? -Infinity);
    }
    merged.changedAt = changedAt;
  }
  return merged;
}
