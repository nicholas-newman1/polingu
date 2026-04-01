import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb } from '../offlineDb/userDb';
import type { TagCategory } from '../../types/sentences';

export interface SentenceTagsData {
  topics: string[];
  grammar: string[];
  style: string[];
}

const DEFAULT_TAGS: SentenceTagsData = {
  topics: [],
  grammar: [],
  style: [],
};

const TAGS_DOC_PATH = 'config/sentenceTags';
const CACHE_KEY = '__config__sentenceTags';

function parseTags(data: unknown): SentenceTagsData {
  const raw = data as SentenceTagsData;
  return {
    topics: raw.topics || DEFAULT_TAGS.topics,
    grammar: raw.grammar || DEFAULT_TAGS.grammar,
    style: raw.style || DEFAULT_TAGS.style,
  };
}

export async function loadSentenceTags(): Promise<SentenceTagsData> {
  const cached = await userDb.userData.get(CACHE_KEY);
  if (cached) return parseTags(cached.data);

  try {
    const docRef = doc(db, TAGS_DOC_PATH);
    const docSnap = await getDoc(docRef);
    const result = docSnap.exists() ? parseTags(docSnap.data()) : DEFAULT_TAGS;
    await userDb.userData.put({
      key: CACHE_KEY,
      data: result,
      lastModified: Date.now(),
      pendingSync: 0,
    });
    return result;
  } catch (e) {
    console.error('Failed to load sentence tags:', e);
  }
  return DEFAULT_TAGS;
}

export async function refreshSentenceTagsFromFirestore(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const docRef = doc(db, TAGS_DOC_PATH);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await userDb.userData.put({
        key: CACHE_KEY,
        data: parseTags(docSnap.data()),
        lastModified: Date.now(),
        pendingSync: 0,
      });
    }
  } catch (e) {
    console.error('Background refresh of sentence tags failed:', e);
  }
}

export async function saveSentenceTags(tags: SentenceTagsData): Promise<void> {
  await userDb.userData.put({
    key: CACHE_KEY,
    data: tags,
    lastModified: Date.now(),
    pendingSync: 0,
  });
  const docRef = doc(db, TAGS_DOC_PATH);
  await setDoc(docRef, tags);
}

export async function addTag(category: TagCategory, tag: string): Promise<SentenceTagsData> {
  const current = await loadSentenceTags();
  if (!current[category].includes(tag)) {
    current[category] = [...current[category], tag];
    await saveSentenceTags(current);
  }
  return current;
}

export async function removeTag(category: TagCategory, tag: string): Promise<SentenceTagsData> {
  const current = await loadSentenceTags();
  current[category] = current[category].filter((t) => t !== tag);
  await saveSentenceTags(current);
  return current;
}

export { DEFAULT_TAGS };
