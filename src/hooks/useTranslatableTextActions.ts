import { useContext } from 'react';
import { TranslatableTextActionsContext } from '../contexts/TranslatableTextContext';

export function useTranslatableTextActions() {
  return useContext(TranslatableTextActionsContext);
}
