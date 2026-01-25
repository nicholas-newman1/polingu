import { deleteField, FieldValue, serverTimestamp } from 'firebase/firestore';

/**
 * Firestore doesn't support `undefined` values. These utilities handle this:
 *
 * - stripUndefined: Removes undefined fields entirely (use with setDoc)
 * - undefinedToDeleteField: Converts undefined to deleteField() (use with updateDoc)
 *
 * WHEN TO USE:
 * - Always use when saving user input (forms with optional fields)
 * - Always use when saving objects with optional properties
 * - Safe to use even on objects without undefined (no-op for those fields)
 */

/**
 * Strips undefined values from an object before saving to Firestore.
 * Use this for setDoc operations where you want to omit undefined fields entirely.
 */
export function stripUndefined<T extends object>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Converts undefined values to deleteField() for Firestore updateDoc operations.
 * Use this when you want undefined fields to be removed from the document.
 */
export function undefinedToDeleteField<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown | FieldValue> {
  const result: Record<string, unknown | FieldValue> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === undefined ? deleteField() : value;
  }
  return result;
}

/**
 * Adds createdAt server timestamp to an object for new document creation.
 * The timestamp is set by the Firestore server, ensuring consistency.
 */
export function withCreatedAt<T extends object>(obj: T): T & { createdAt: FieldValue } {
  return {
    ...obj,
    createdAt: serverTimestamp(),
  };
}
