import { CheatSheetDrawer } from './CheatSheetDrawer';
import { DeclensionCheatSheet } from './DeclensionCheatSheet';
import { adjectiveDeclensionTables } from '../../data/adjectiveDeclensionPatterns';
import { useCheatSheetContext } from '../../hooks/useCheatSheetContext';

export function AdjectiveDeclensionCheatSheetDrawer() {
  const { activeSheet, closeSheet } = useCheatSheetContext();

  return (
    <CheatSheetDrawer
      open={activeSheet === 'adjective-declension'}
      onClose={closeSheet}
      title="Adjective Declension Cheat Sheet"
    >
      <DeclensionCheatSheet tables={adjectiveDeclensionTables} pluralGridColumns={2} />
    </CheatSheetDrawer>
  );
}
