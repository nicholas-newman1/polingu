import { createContext, useState, useCallback, type ReactNode } from 'react';

export type CheatSheetType = 'declension' | 'consonants' | 'yi-rule' | null;

export interface CheatSheetContextValue {
  activeSheet: CheatSheetType;
  openSheet: (sheet: CheatSheetType) => void;
  closeSheet: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const CheatSheetContext = createContext<CheatSheetContextValue | null>(
  null
);

export function CheatSheetProvider({ children }: { children: ReactNode }) {
  const [activeSheet, setActiveSheet] = useState<CheatSheetType>(null);

  const openSheet = useCallback((sheet: CheatSheetType) => {
    setActiveSheet((prev) => (prev === sheet ? null : sheet));
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  return (
    <CheatSheetContext.Provider value={{ activeSheet, openSheet, closeSheet }}>
      {children}
    </CheatSheetContext.Provider>
  );
}
