import { useContext } from 'react';
import { TranslatableTextContext } from '../contexts/TranslatableTextContext';

export function useTranslatableText() {
  return useContext(TranslatableTextContext);
}
