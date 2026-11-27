import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Opens every new page at the top. Without this the window keeps the previous
 * page's scroll offset, so a page could open halfway down with its header hidden.
 * Rendered before the page so a page that restores its own position (the reader)
 * still wins.
 */
export function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
