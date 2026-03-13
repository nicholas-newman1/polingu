import { useContext } from 'react';
import { AddSentenceContext } from '../contexts/AddSentenceContext';

export function useAddSentence() {
  const context = useContext(AddSentenceContext);
  return context;
}
