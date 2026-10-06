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
