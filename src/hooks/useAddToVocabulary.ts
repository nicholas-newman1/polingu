import { useContext } from 'react';
import { AddToVocabularyContext } from '../contexts/AddToVocabularyContext';

export function useAddToVocabulary() {
  const context = useContext(AddToVocabularyContext);
  return context;
}
