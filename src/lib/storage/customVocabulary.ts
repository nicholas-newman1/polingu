import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { CustomVocabularyWord } from '../../types/vocabulary';
import { getUserId } from './helpers';

interface CustomVocabularyStore {
  words: CustomVocabularyWord[];
}

export async function loadCustomVocabulary(): Promise<CustomVocabularyWord[]> {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const docRef = doc(db, 'users', userId, 'data', 'customVocabulary');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as CustomVocabularyStore;
      return data.words || [];
    }
  } catch (e) {
    console.error('Failed to load custom vocabulary:', e);
  }
  return [];
}

export async function saveCustomVocabulary(
  words: CustomVocabularyWord[]
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'customVocabulary');
    await setDoc(docRef, { words });
  } catch (e) {
    console.error('Failed to save custom vocabulary:', e);
  }
}

export async function addCustomWord(
  word: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
): Promise<CustomVocabularyWord> {
  const existingWords = await loadCustomVocabulary();
  const newWord: CustomVocabularyWord = {
    ...word,
    id: `custom_${Date.now()}`,
    isCustom: true,
    createdAt: Date.now(),
  };
  await saveCustomVocabulary([...existingWords, newWord]);
  return newWord;
}

export async function updateCustomWord(
  wordId: string,
  updates: Partial<Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>>
): Promise<void> {
  const existingWords = await loadCustomVocabulary();
  const updatedWords = existingWords.map((w) =>
    w.id === wordId ? { ...w, ...updates } : w
  );
  await saveCustomVocabulary(updatedWords);
}

export async function deleteCustomWord(wordId: string): Promise<void> {
  const existingWords = await loadCustomVocabulary();
  const filteredWords = existingWords.filter((w) => w.id !== wordId);
  await saveCustomVocabulary(filteredWords);
}

