import { useContext, type ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageTitle } from '../../src/hooks/usePageTitle';
import { PageTitleContext, PageTitleProvider } from '../../src/contexts/PageTitleContext';

function TitledPage({ title }: { title: string | null }) {
  usePageTitle(title);
  return null;
}

/**
 * Renders the header's view of the title, next to whichever page `route.page` names
 * (null for a page without a custom title). Change `route.page`, then `rerender()`.
 */
function renderApp(initialPage: string | null) {
  const route = { page: initialPage };
  const header = renderHook(() => useContext(PageTitleContext)!.customTitle, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <PageTitleProvider>
        {children}
        {route.page !== null && <TitledPage key={route.page} title={route.page} />}
      </PageTitleProvider>
    ),
  });
  return {
    shownTitle: () => header.result.current,
    navigate: (page: string | null) => {
      route.page = page;
      header.rerender();
    },
  };
}

describe('usePageTitle', () => {
  test("sets the header's custom title", () => {
    const app = renderApp('Chapter 3');
    expect(app.shownTitle()).toBe('Chapter 3');
  });

  test('follows the page when its title changes', () => {
    const { result, rerender } = renderHook(
      ({ title }: { title: string | null }) => {
        usePageTitle(title);
        return useContext(PageTitleContext)!.customTitle;
      },
      { wrapper: PageTitleProvider, initialProps: { title: 'Chapter 3' as string | null } }
    );

    rerender({ title: 'Chapter 4' });
    expect(result.current).toBe('Chapter 4');

    rerender({ title: null });
    expect(result.current).toBeNull();
  });

  test('clears the custom title when the page goes away', () => {
    const app = renderApp('Chapter 3');

    app.navigate(null);

    expect(app.shownTitle()).toBeNull();
  });

  test("moving straight to another titled page shows that page's title", () => {
    const app = renderApp('Chapter 3');

    app.navigate('Settings');

    expect(app.shownTitle()).toBe('Settings');
  });

  test('does nothing outside a PageTitleProvider, on mount, title change or unmount', () => {
    // An error in an effect or its cleanup is rethrown by the act() around each step.
    const page = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Anything' as string | null },
    });
    expect(() => page.rerender({ title: 'Something else' })).not.toThrow();
    expect(() => page.unmount()).not.toThrow();
  });
});
