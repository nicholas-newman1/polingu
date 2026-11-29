import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface PageTitleContextValue {
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
}

export const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ customTitle, setCustomTitle }), [customTitle]);

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

export function usePageTitle(title: string | null) {
  const context = useContext(PageTitleContext);

  const setCustomTitle = context?.setCustomTitle;

  useEffect(() => {
    setCustomTitle?.(title);
    return () => setCustomTitle?.(null);
  }, [title, setCustomTitle]);
}
