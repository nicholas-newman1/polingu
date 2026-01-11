import { CheatSheetDrawer } from './CheatSheetDrawer';
import { DeclensionCheatSheet } from './DeclensionCheatSheet';
import { allTables } from '../data/declensionPatterns';
import { useCheatSheetContext } from '../hooks/useCheatSheetContext';

export function DeclensionCheatSheetDrawer() {
  const { activeSheet, closeSheet } = useCheatSheetContext();

  return (
    <CheatSheetDrawer
      open={activeSheet === 'declension'}
      onClose={closeSheet}
      title="Declension Cheat Sheet"
    >
      <DeclensionCheatSheet tables={allTables} />
    </CheatSheetDrawer>
  );
}
