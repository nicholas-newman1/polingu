import { CheatSheetDrawer } from './CheatSheetDrawer';
import { ConsonantsCheatSheet } from './ConsonantsCheatSheet';
import { useCheatSheetContext } from '../hooks/useCheatSheetContext';

export function ConsonantsCheatSheetDrawer() {
  const { activeSheet, closeSheet } = useCheatSheetContext();

  return (
    <CheatSheetDrawer
      open={activeSheet === 'consonants'}
      onClose={closeSheet}
      title="Consonants Cheat Sheet"
    >
      <ConsonantsCheatSheet />
    </CheatSheetDrawer>
  );
}
