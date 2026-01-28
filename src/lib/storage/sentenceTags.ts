import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
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

export async function loadSentenceTags(): Promise<SentenceTagsData> {
  try {
    const docRef = doc(db, TAGS_DOC_PATH);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as SentenceTagsData;
      return {
        topics: data.topics || DEFAULT_TAGS.topics,
        grammar: data.grammar || DEFAULT_TAGS.grammar,
        style: data.style || DEFAULT_TAGS.style,
      };
    }
  } catch (e) {
    console.error('Failed to load sentence tags:', e);
  }
  return DEFAULT_TAGS;
}

export async function saveSentenceTags(tags: SentenceTagsData): Promise<void> {
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
