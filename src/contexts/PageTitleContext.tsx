import { createContext, useState, useCallback, useMemo } from 'react';

interface PageTitleContextValue {
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [customTitle, setCustomTitleState] = useState<string | null>(null);

  const setCustomTitle = useCallback((title: string | null) => {
    setCustomTitleState(title);
  }, []);

  const value = useMemo(() => ({ customTitle, setCustomTitle }), [customTitle, setCustomTitle]);

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}
