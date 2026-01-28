import { doc, updateDoc, deleteDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import type { Sentence, CEFRLevel } from '../../types/sentences';
import { withCreatedAt } from './firestoreUtils';

export async function updateSentence(
  sentenceId: string,
  updates: Partial<Omit<Sentence, 'id'>>
): Promise<void> {
  const docRef = doc(db, 'sentences', sentenceId);
  await updateDoc(docRef, updates);
}

export async function deleteSentence(sentenceId: string): Promise<void> {
  const docRef = doc(db, 'sentences', sentenceId);
  await deleteDoc(docRef);
}

export async function updateSentenceTranslation(
  sentenceId: string,
  word: string,
  translation: string
): Promise<void> {
  const docRef = doc(db, 'sentences', sentenceId);
  await updateDoc(docRef, {
    [`translations.${word}`]: translation,
  });
}

export async function createSentence(sentence: Sentence): Promise<void> {
  const docRef = doc(db, 'sentences', sentence.id);
  await setDoc(docRef, withCreatedAt(sentence));
}

export async function createSentences(sentences: Sentence[]): Promise<void> {
  await Promise.all(sentences.map((s) => createSentence(s)));
}

export async function getNextSentenceId(level: CEFRLevel): Promise<string> {
  const snapshot = await getDocs(collection(db, 'sentences'));
  const prefix = level.toLowerCase();
  let maxNum = 0;

  snapshot.docs.forEach((doc) => {
    const id = doc.id;
    if (id.startsWith(prefix + '_')) {
      const numPart = parseInt(id.split('_')[1], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `${prefix}_${String(nextNum).padStart(3, '0')}`;
}

export async function getNextSentenceIds(levels: CEFRLevel[]): Promise<Record<CEFRLevel, number>> {
  const snapshot = await getDocs(collection(db, 'sentences'));
  const counters: Record<string, number> = {
    a1: 0,
    a2: 0,
    b1: 0,
    b2: 0,
    c1: 0,
    c2: 0,
  };

  snapshot.docs.forEach((doc) => {
    const id = doc.id;
    const match = id.match(/^([a-z][12])_(\d+)$/);
    if (match) {
      const level = match[1];
      const num = parseInt(match[2], 10);
      if (!isNaN(num) && num > counters[level]) {
        counters[level] = num;
      }
    }
  });

  const result: Record<string, number> = {};
  for (const level of levels) {
    const key = level.toLowerCase();
    result[level] = counters[key] + 1;
  }

  return result as Record<CEFRLevel, number>;
}
