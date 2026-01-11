import { CheatSheetDrawer } from './CheatSheetDrawer';
import { YiRuleCheatSheet } from './YiRuleCheatSheet';
import { useCheatSheetContext } from '../hooks/useCheatSheetContext';

export function YiRuleCheatSheetDrawer() {
  const { activeSheet, closeSheet } = useCheatSheetContext();

  return (
    <CheatSheetDrawer
      open={activeSheet === 'yi-rule'}
      onClose={closeSheet}
      title="-y/-i Rule"
    >
      <YiRuleCheatSheet />
    </CheatSheetDrawer>
  );
}
