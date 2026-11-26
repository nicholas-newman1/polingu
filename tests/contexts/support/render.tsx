/**
 * Renders the review contexts with the real storage layer underneath (Dexie on
 * fake-indexeddb, the in-memory Firestore fake), a real SnackbarProvider to show
 * storage errors, and a fixed AuthContext. Each test file must also install the
 * fake SDK and reset the stores between tests:
 *
 *   vi.mock('firebase/firestore', () => import('../sync/support/fakeFirestore'));
 *   setupSyncTests();
 */
import { useContext, useEffect, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { SnackbarContext, SnackbarProvider } from '../../../src/contexts/SnackbarContext';
import { ReviewDataProvider } from '../../../src/contexts/review';
import { DeclensionProvider } from '../../../src/contexts/review/DeclensionContext';
import { VocabularyProvider } from '../../../src/contexts/review/VocabularyContext';
import { SentenceProvider } from '../../../src/contexts/review/SentenceContext';
import { ConjugationProvider } from '../../../src/contexts/review/ConjugationContext';
import { AspectPairsProvider } from '../../../src/contexts/review/AspectPairsContext';
import { ReviewCountsProvider } from '../../../src/contexts/review/ReviewCountsContext';
import { UserFiltersProvider, useUserFilters } from '../../../src/contexts/UserFiltersContext';
import { useReviewData } from '../../../src/hooks/useReviewData';
import type { UserFilters } from '../../../src/types/userFilters';
import { signOutFakeUser } from '../../fakes/firebase';
import { withAuth } from '../../hooks/support/providers';
import { signIn } from '../../sync/support/harness';

type Props<C> = C extends (props: infer P) => unknown ? Omit<P, 'children'> : never;

/** Initial props for each provider, as ReviewDataProvider would pass them after a load. */
export interface InitialData {
  declension?: Props<typeof DeclensionProvider>;
  vocabulary?: Props<typeof VocabularyProvider>;
  sentences?: Props<typeof SentenceProvider>;
  conjugation?: Props<typeof ConjugationProvider>;
  aspectPairs?: Props<typeof AspectPairsProvider>;
  loading?: boolean;
}

/** Every snackbar message shown while the test ran, oldest first. */
function useReviewDataProbe(shown: string[]) {
  const data = useReviewData();
  const snackbar = useContext(SnackbarContext)?.snackbar ?? null;
  useEffect(() => {
    if (snackbar) shown.push(snackbar.message);
  }, [snackbar, shown]);
  return data;
}

function setSignedIn(uid: string | null) {
  if (uid) signIn(uid);
  else signOutFakeUser();
}

function renderWithTree(uid: string | null, tree: (children: ReactNode) => ReactNode) {
  setSignedIn(uid);
  const auth = withAuth(uid);
  const shown: string[] = [];
  const AuthWrapper = auth.wrapper;
  const hook = renderHook(() => useReviewDataProbe(shown), {
    wrapper: ({ children }) => (
      <SnackbarProvider>
        <AuthWrapper>{tree(children)}</AuthWrapper>
      </SnackbarProvider>
    ),
  });

  return {
    ...hook,
    /** The value of useReviewData() as of the last render. */
    data: () => hook.result.current,
    /** Snackbar messages shown so far. */
    errors: () => [...shown],
    /** Signs in as another account (or out, with null), as AuthProvider would. */
    switchUser(nextUid: string | null) {
      setSignedIn(nextUid);
      if (nextUid) auth.signInAs(nextUid);
      else auth.signOut();
      hook.rerender();
    },
    /** Runs a context action inside act and waits for it to finish. */
    run: <T,>(action: () => Promise<T>) => act(action),
  };
}

/** The whole ReviewDataProvider, which loads from storage and syncs in the background. */
export function renderReviewDataProvider(uid: string | null) {
  return renderWithTree(uid, (children) => <ReviewDataProvider>{children}</ReviewDataProvider>);
}

/**
 * The five review providers and the counts provider, nested as ReviewDataProvider
 * nests them, started from `initial` instead of a load. Only `provide` replaces
 * the props objects, so no other re-render looks like new data arriving.
 *
 * With `userFilters`, the app's UserFiltersProvider (which loads the learner's
 * saved session filters) wraps them all, so any provider could read the filters.
 */
export function renderReviewProviders(
  uid: string | null,
  initial: InitialData = {},
  options: { userFilters?: boolean } = {}
) {
  let current = initial;
  const filtersRef: { current: UserFilters | null } = { current: null };
  /** Records the learner's filters as UserFiltersProvider holds them (null while loading). */
  function FiltersSpy({ children }: { children: ReactNode }) {
    const { filters, filtersLoading } = useUserFilters();
    useEffect(() => {
      filtersRef.current = filtersLoading ? null : filters;
    }, [filters, filtersLoading]);
    return children;
  }
  const providers = (children: ReactNode) => (
    <DeclensionProvider {...current.declension}>
      <VocabularyProvider {...current.vocabulary}>
        <SentenceProvider {...current.sentences}>
          <ConjugationProvider {...current.conjugation}>
            <AspectPairsProvider {...current.aspectPairs}>
              <ReviewCountsProvider loading={current.loading ?? false}>
                {children}
              </ReviewCountsProvider>
            </AspectPairsProvider>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
  const rendered = renderWithTree(uid, (children) =>
    options.userFilters ? (
      <UserFiltersProvider>
        <FiltersSpy>{providers(children)}</FiltersSpy>
      </UserFiltersProvider>
    ) : (
      providers(children)
    )
  );
  return {
    ...rendered,
    /** Hands the providers new data, as ReviewDataProvider does after a load or sync. */
    provide(next: InitialData) {
      current = next;
      rendered.rerender();
    },
    /** The learner's filters once UserFiltersProvider has loaded them (with `userFilters`). */
    filters: () => filtersRef.current,
  };
}

export const SAVE_ERROR = 'Failed to save. Please try again.';
