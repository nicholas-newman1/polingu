/**
 * The app as src/main.tsx assembles it: the real providers around the study routes.
 * Left out: AudioPlayerProvider (the audio library player, which none of these
 * pages use) and the Layout chrome (menus, cheat sheets). The listening player is
 * a stand-in that lists the queue it was started with.
 */
import type { ReactNode } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ColorModeProvider } from '../../../../src/contexts/ColorModeContext';
import { ThemedApp } from '../../../../src/components/ThemedApp';
import { SnackbarProvider } from '../../../../src/contexts/SnackbarContext';
import { AuthProvider } from '../../../../src/contexts/AuthContext';
import { AuthGate } from '../../../../src/components/AuthGate';
import { ReviewDataProvider } from '../../../../src/contexts/review';
import { AppSettingsProvider } from '../../../../src/contexts/AppSettingsContext';
import { UserFiltersProvider } from '../../../../src/contexts/UserFiltersContext';
import { TranslationProvider } from '../../../../src/contexts/TranslationContext';
import { CheatSheetProvider } from '../../../../src/contexts/CheatSheetContext';
import { ListeningProvider, useListening } from '../../../../src/contexts/ListeningContext';
import { AppSnackbar } from '../../../../src/components/AppSnackbar';
import { DashboardPage } from '../../../../src/pages/DashboardPage';
import { DeclensionPage } from '../../../../src/pages/DeclensionPage';
import { SentencesPage } from '../../../../src/pages/SentencesPage';
import { VocabularyPage } from '../../../../src/pages/VocabularyPage';
import { ConjugationPage } from '../../../../src/pages/ConjugationPage';
import { AspectPairsPage } from '../../../../src/pages/AspectPairsPage';
import { ConsonantDrillerPage } from '../../../../src/pages/ConsonantDrillerPage';

function CurrentPath() {
  const { pathname } = useLocation();
  return <output aria-label="Current page">{pathname}</output>;
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ColorModeProvider>
      <ThemedApp>
        <SnackbarProvider>
          <AuthProvider>
            <AuthGate>
              <UserFiltersProvider>
                <ReviewDataProvider>
                  <AppSettingsProvider>
                    <TranslationProvider>
                      <CheatSheetProvider>
                        <ListeningProvider>{children}</ListeningProvider>
                      </CheatSheetProvider>
                    </TranslationProvider>
                  </AppSettingsProvider>
                </ReviewDataProvider>
              </UserFiltersProvider>
            </AuthGate>
          </AuthProvider>
          <AppSnackbar />
        </SnackbarProvider>
      </ThemedApp>
    </ColorModeProvider>
  );
}

/** Stands in for the listening player: shows what it was asked to play. */
function ListeningPlayer() {
  const { queue } = useListening();
  return (
    <>
      <h1>Listening player</h1>
      <ol aria-label="Listening queue">
        {queue.map((item) => (
          <li key={item.id}>{item.primaryText}</li>
        ))}
      </ol>
    </>
  );
}

/** `extra` renders inside the router, beside the page (e.g. a dialog's entry point). */
export function AppTree({ path, extra }: { path: string; extra?: ReactNode }) {
  return (
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/declension" element={<DeclensionPage />} />
          <Route path="/vocabulary">
            <Route index element={<VocabularyPage />} />
            <Route path="recognition" element={<VocabularyPage mode="pl-to-en" />} />
            <Route path="production" element={<VocabularyPage mode="en-to-pl" />} />
          </Route>
          <Route path="/sentences">
            <Route index element={<SentencesPage />} />
            <Route path="recognition" element={<SentencesPage mode="pl-to-en" />} />
            <Route path="production" element={<SentencesPage mode="en-to-pl" />} />
          </Route>
          <Route path="/conjugation">
            <Route index element={<ConjugationPage />} />
            <Route path="recognition" element={<ConjugationPage mode="pl-to-en" />} />
            <Route path="production" element={<ConjugationPage mode="en-to-pl" />} />
          </Route>
          <Route path="/aspect-pairs" element={<AspectPairsPage />} />
          <Route path="/consonant-driller" element={<ConsonantDrillerPage />} />
          <Route path="/listen/play" element={<ListeningPlayer />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <CurrentPath />
        {extra}
      </MemoryRouter>
    </Providers>
  );
}
