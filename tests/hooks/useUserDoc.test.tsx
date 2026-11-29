import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useUserDoc } from '../../src/hooks/useUserDoc';
import type { UserDoc } from '../../src/lib/storage/userDocs';
import { withAuth, withSnackbar } from './support/providers';

interface Prefs {
  speed: number;
}

function fakeDoc(stored: Record<string, Prefs>) {
  let uid: string | null = null;
  const doc: UserDoc<Prefs> & { as: (id: string | null) => void } = {
    defaults: { speed: 1 },
    load: vi.fn(async () => (uid && stored[uid]) || { speed: 1 }),
    save: vi.fn(async (value: Prefs) => {
      if (uid) stored[uid] = value;
    }),
    as: (id) => {
      uid = id;
    },
  };
  return doc;
}

/** Renders useUserDoc for the user `auth` signs in, recording the snackbars it shows. */
function renderUserDoc(doc: UserDoc<Prefs>, auth: ReturnType<typeof withAuth>) {
  const { wrapper: Snackbar, showSnackbar } = withSnackbar();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <auth.wrapper>
      <Snackbar>{children}</Snackbar>
    </auth.wrapper>
  );
  return { ...renderHook(() => useUserDoc(doc), { wrapper }), showSnackbar };
}

describe('useUserDoc', () => {
  test('loads the signed-in user’s document, and shows the defaults while loading', async () => {
    const doc = fakeDoc({ ana: { speed: 2 } });
    doc.as('ana');
    const auth = withAuth('ana');
    const { result } = renderUserDoc(doc, auth);

    expect(result.current).toMatchObject({ value: { speed: 1 }, loading: true });
    await waitFor(() =>
      expect(result.current).toMatchObject({ value: { speed: 2 }, loading: false })
    );
  });

  test('signed out, it is the defaults and not loading', () => {
    const doc = fakeDoc({});
    const auth = withAuth(null);
    const { result } = renderUserDoc(doc, auth);

    expect(result.current).toMatchObject({ value: { speed: 1 }, loading: false });
    expect(doc.load).not.toHaveBeenCalled();
  });

  test('switching accounts drops the previous account’s values and loads the new ones', async () => {
    const doc = fakeDoc({ ana: { speed: 2 }, ben: { speed: 0.75 } });
    doc.as('ana');
    const auth = withAuth('ana');
    const { result, rerender } = renderUserDoc(doc, auth);
    await waitFor(() => expect(result.current.value).toEqual({ speed: 2 }));

    doc.as('ben');
    auth.signInAs('ben');
    rerender();

    expect(result.current).toMatchObject({ value: { speed: 1 }, loading: true });
    await waitFor(() => expect(result.current.value).toEqual({ speed: 0.75 }));
  });

  test('an update shows at once and is saved', async () => {
    const stored = { ana: { speed: 2 } };
    const doc = fakeDoc(stored);
    doc.as('ana');
    const auth = withAuth('ana');
    const { result } = renderUserDoc(doc, auth);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.update({ speed: 1.5 }));

    expect(result.current.value).toEqual({ speed: 1.5 });
    expect(stored.ana).toEqual({ speed: 1.5 });
  });

  test('a failed save keeps the change and reports the failure', async () => {
    const doc = fakeDoc({});
    doc.as('ana');
    vi.mocked(doc.save).mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const auth = withAuth('ana');
    const { result, showSnackbar } = renderUserDoc(doc, auth);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.update({ speed: 0.5 }));

    expect(result.current.value).toEqual({ speed: 0.5 });
    expect(showSnackbar).toHaveBeenCalledWith('Failed to save. Please try again.', 'error');
  });
});
