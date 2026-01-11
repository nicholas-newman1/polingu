import { CheatSheetDrawer } from './CheatSheetDrawer';
import { YiRuleCheatSheet } from './YiRuleCheatSheet';

interface YiRuleCheatSheetDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function YiRuleCheatSheetDrawer({
  open,
  onClose,
}: YiRuleCheatSheetDrawerProps) {
  return (
    <CheatSheetDrawer open={open} onClose={onClose} title="-y/-i Rule">
      <YiRuleCheatSheet />
    </CheatSheetDrawer>
  );
}

