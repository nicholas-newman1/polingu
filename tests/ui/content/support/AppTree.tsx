// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- BottomMenuBar reads the build globals declared there
/// <reference path="../../../../src/vite-env.d.ts" />
/**
 * The component tree of src/main.tsx, with a MemoryRouter in place of the BrowserRouter
 * and without StrictMode's development-only double effects. PwaUpdatePrompt is left out:
 * its `virtual:pwa-register` import only resolves under the PWA build plugin, which the
 * test config does not load. Pages owned by other parts of the suite render as a plain
 * "<Name> page" marker; the conjugation drill is included only so its admin edit dialog
 * can be tested end to end.
 */
import type { ReactNode } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ColorModeProvider } from '../../../../src/contexts/ColorModeContext';
import { ThemedApp } from '../../../../src/components/ThemedApp';
import { AuthProvider } from '../../../../src/contexts/AuthContext';
import { TranslationProvider } from '../../../../src/contexts/TranslationContext';
import { CheatSheetProvider } from '../../../../src/contexts/CheatSheetContext';
import { SnackbarProvider } from '../../../../src/contexts/SnackbarContext';
import { ReviewDataProvider } from '../../../../src/contexts/review';
import { AppSettingsProvider } from '../../../../src/contexts/AppSettingsContext';
import { UserFiltersProvider } from '../../../../src/contexts/UserFiltersContext';
import { AudioPlayerProvider } from '../../../../src/contexts/AudioPlayerContext';
import { ListeningProvider } from '../../../../src/contexts/ListeningContext';
import { AuthGate } from '../../../../src/components/AuthGate';
import { SignIn } from '../../../../src/components/SignIn';
import { Layout } from '../../../../src/components/Layout';
import { AppSnackbar } from '../../../../src/components/AppSnackbar';
import { OfflineIndicator } from '../../../../src/components/OfflineIndicator';
import { CustomVocabularyPage } from '../../../../src/pages/CustomVocabularyPage';
import { CustomDeclensionPage } from '../../../../src/pages/CustomDeclensionPage';
import { CustomSentencesPage } from '../../../../src/pages/CustomSentencesPage';
import { SettingsPage } from '../../../../src/pages/SettingsPage';
import { LibraryPage } from '../../../../src/pages/LibraryPage';
import { ReaderPage } from '../../../../src/pages/ReaderPage';
import { SentenceGeneratorPage } from '../../../../src/pages/SentenceGenerator';
import { AdminContentPage } from '../../../../src/pages/AdminContentPage';
import { ConjugationPage } from '../../../../src/pages/ConjugationPage';

function OtherPage({ name }: { name: string }) {
  return <p>{name} page</p>;
}

function LocationDisplay() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

const OTHER_PAGES: Array<[string, string]> = [
  ['/dashboard', 'Dashboard'],
  ['/declension', 'Declension'],
  ['/vocabulary', 'Vocabulary'],
  ['/sentences', 'Sentences'],
  ['/conjugation', 'Conjugation'],
  ['/aspect-pairs', 'Aspect pairs'],
  ['/consonant-driller', 'Consonant driller'],
  ['/stats', 'Statistics'],
  ['/audio', 'Audio'],
  ['/listen', 'Listening'],
];

export function App({ route }: { route: string }) {
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
                        <AudioPlayerProvider>
                          <ListeningProvider>
                            <MemoryRouter initialEntries={[route]}>
                              <LocationDisplay />
                              <Routes>
                                <Route path="/login" element={<SignIn />} />
                                <Route element={<Layout />}>
                                  {OTHER_PAGES.map(([path, name]) => (
                                    <Route
                                      key={path}
                                      path={path}
                                      element={<OtherPage name={name} />}
                                    />
                                  ))}
                                  <Route
                                    path="/conjugation/recognition"
                                    element={<ConjugationPage mode="pl-to-en" />}
                                  />
                                  <Route path="/my-vocabulary" element={<CustomVocabularyPage />} />
                                  <Route
                                    path="/my-declensions"
                                    element={<CustomDeclensionPage />}
                                  />
                                  <Route path="/my-sentences" element={<CustomSentencesPage />} />
                                  <Route path="/settings" element={<SettingsPage />} />
                                  <Route path="/library" element={<LibraryPage />} />
                                  <Route path="/reader/:bookId" element={<ReaderPage />} />
                                  <Route
                                    path="/admin/generator"
                                    element={<SentenceGeneratorPage />}
                                  />
                                  <Route
                                    path="/admin/content"
                                    element={<Navigate to="/admin/content/vocabulary" replace />}
                                  />
                                  <Route
                                    path="/admin/content/:tab"
                                    element={<AdminContentPage />}
                                  />
                                </Route>
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                              </Routes>
                            </MemoryRouter>
                          </ListeningProvider>
                        </AudioPlayerProvider>
                      </CheatSheetProvider>
                    </TranslationProvider>
                  </AppSettingsProvider>
                </ReviewDataProvider>
              </UserFiltersProvider>
            </AuthGate>
          </AuthProvider>
          <AppSnackbar />
          <OfflineIndicator />
        </SnackbarProvider>
      </ThemedApp>
    </ColorModeProvider>
  );
}

/** The app's outer shell only (theme, snackbar, sign-in), for dialogs used on their own. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <ColorModeProvider>
      <ThemedApp>
        <SnackbarProvider>
          <AuthProvider>
            <AuthGate>{children}</AuthGate>
          </AuthProvider>
          <AppSnackbar />
        </SnackbarProvider>
      </ThemedApp>
    </ColorModeProvider>
  );
}
