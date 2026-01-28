import { CheatSheetDrawer } from './CheatSheetDrawer';
import { ConjugationCheatSheet } from './ConjugationCheatSheet';
import { useCheatSheetContext } from '../hooks/useCheatSheetContext';

export function ConjugationCheatSheetDrawer() {
  const { activeSheet, closeSheet } = useCheatSheetContext();

  return (
    <CheatSheetDrawer
      open={activeSheet === 'conjugation'}
      onClose={closeSheet}
      title="Conjugation Cheat Sheet"
    >
      <ConjugationCheatSheet />
    </CheatSheetDrawer>
  );
}
