export type TranslationDirection = 'en-to-pl' | 'pl-to-en';

/** When each id was last added to or removed from a day's session list, keyed `${list}:${id}`. */
export type SessionChanges = Record<string, number>;
