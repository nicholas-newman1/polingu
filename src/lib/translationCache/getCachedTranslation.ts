import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import getCacheKey from './getCacheKey';

const COLLECTION = 'wordTranslations';

export default async function getCachedTranslation(
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

