import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'wordTranslations';

function hashContext(context: string): string {
  let hash = 0;
  for (let i = 0; i < context.length; i++) {
    const char = context.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function getCacheKey(word: string, context?: string): string {
  if (!context) return word;
  return `${word}__${hashContext(context)}`;
}

export async function getCachedTranslation(
  word: string,
  context?: string
): Promise<string | null> {
  const cacheKey = getCacheKey(word, context);
  const docRef = doc(db, COLLECTION, cacheKey);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data().translation as string;
  }

  return null;
}
