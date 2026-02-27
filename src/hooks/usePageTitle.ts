import { useContext, useEffect } from 'react';
import { PageTitleContext } from '../contexts/PageTitleContext';

export function usePageTitle(title: string | null) {
  const context = useContext(PageTitleContext);

  useEffect(() => {
    if (context) {
      context.setCustomTitle(title);
    }

    return () => {
      if (context) {
        context.setCustomTitle(null);
      }
    };
  }, [title, context]);
}

export function usePageTitleContext() {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error('usePageTitleContext must be used within a PageTitleProvider');
  }
  return context;
}
