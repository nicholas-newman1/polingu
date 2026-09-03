import { useContext } from 'react';
import { TranslatableTextUIContext } from '../contexts/TranslatableTextContext';

export function useTranslatableTextUI() {
  return useContext(TranslatableTextUIContext);
}
