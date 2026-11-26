/**
 * Types a partial fixture as the full type. Use it when the code under test
 * only reads a few fields, so fixtures stay short and say what matters.
 */
export const stub = <T>(value: Partial<T>): T => value as T;

/** stub() for arrays of fixtures. */
export const stubs = <T>(values: Partial<T>[]): T[] => values as T[];
