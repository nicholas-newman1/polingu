import { useContext } from 'react';
import { TranslationContext } from '../contexts/TranslationContext';

export function useTranslationContext() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      'useTranslationContext must be used within a TranslationProvider'
    );
  }
  return context;
}

