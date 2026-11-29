import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CheatSheetKey } from '../components/BottomMenu/cheatSheets';

interface CheatSheetContextValue {
  activeSheet: CheatSheetKey | null;
  /** Opens the sheet, or closes it if it is the one open. */
  openSheet: (sheet: CheatSheetKey) => void;
  closeSheet: () => void;
}

export const CheatSheetContext = createContext<CheatSheetContextValue | null>(null);

export function CheatSheetProvider({ children }: { children: ReactNode }) {
  const [activeSheet, setActiveSheet] = useState<CheatSheetKey | null>(null);

  const openSheet = (sheet: CheatSheetKey) =>
    setActiveSheet((prev) => (prev === sheet ? null : sheet));
  const closeSheet = () => setActiveSheet(null);

  return (
    <CheatSheetContext.Provider value={{ activeSheet, openSheet, closeSheet }}>
      {children}
    </CheatSheetContext.Provider>
  );
}

export function useCheatSheetContext() {
  const context = useContext(CheatSheetContext);
  if (!context) {
    throw new Error('useCheatSheetContext must be used within a CheatSheetProvider');
  }
  return context;
}
