import { useContext } from 'react';
import { CheatSheetContext } from '../contexts/CheatSheetContext';

export function useCheatSheetContext() {
  const context = useContext(CheatSheetContext);
  if (!context) {
    throw new Error(
      'useCheatSheetContext must be used within a CheatSheetProvider'
    );
  }
  return context;
}

