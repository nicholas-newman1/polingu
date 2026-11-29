import { StrictMode, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { ThemedApp } from './components/ThemedApp';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { CheatSheetProvider } from './contexts/CheatSheetContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { ReviewDataProvider } from './contexts/review';
import { AuthGate } from './components/AuthGate';
import { SignIn } from './components/SignIn';
import { Layout } from './components/Layout';
import { AppSnackbar } from './components/AppSnackbar';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardPage } from './pages/DashboardPage';
import { DeclensionPage } from './pages/DeclensionPage';
import { SentencesPage } from './pages/SentencesPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { ConjugationPage } from './pages/ConjugationPage';
import { ModeSelectorPage } from './pages/ModeSelectorPage';
import { AspectPairsPage } from './pages/AspectPairsPage';
import { ConsonantDrillerPage } from './pages/ConsonantDrillerPage';
import { CustomVocabularyPage } from './pages/CustomVocabularyPage';
import { CustomDeclensionPage } from './pages/CustomDeclensionPage';
import { CustomSentencesPage } from './pages/CustomSentencesPage';
import { SettingsPage } from './pages/SettingsPage';
import { LibraryPage } from './pages/LibraryPage';
import { AudioLibraryPage } from './pages/AudioLibraryPage';
import { AudioPlayerPage } from './pages/AudioPlayerPage';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { UserFiltersProvider } from './contexts/UserFiltersContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { ListeningProvider } from './contexts/ListeningContext';
import { ListeningHubPage } from './pages/ListeningHubPage';
import { ListeningPlayerPage } from './pages/ListeningPlayerPage';
import { setUpDevMute } from './lib/devMute';

// Loaded on first visit: the reader brings pdf.js, and the admin pages are for admins only.
const ReaderPage = lazy(() =>
  import('./pages/ReaderPage').then((m) => ({ default: m.ReaderPage }))
);
const SentenceGeneratorPage = lazy(() =>
  import('./pages/SentenceGenerator').then((m) => ({ default: m.SentenceGeneratorPage }))
);
const AdminContentPage = lazy(() =>
  import('./pages/AdminContentPage').then((m) => ({ default: m.AdminContentPage }))
);

if (import.meta.env.DEV) setUpDevMute();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
                            <BrowserRouter>
                              <Routes>
                                <Route path="/login" element={<SignIn />} />
                                <Route element={<Layout />}>
                                  <Route path="/dashboard" element={<DashboardPage />} />
                                  <Route path="/declension" element={<DeclensionPage />} />
                                  <Route path="/vocabulary">
                                    <Route index element={<ModeSelectorPage deck="vocabulary" />} />
                                    <Route
                                      path="recognition"
                                      element={<VocabularyPage mode="pl-to-en" />}
                                    />
                                    <Route
                                      path="production"
                                      element={<VocabularyPage mode="en-to-pl" />}
                                    />
                                  </Route>
                                  <Route path="/sentences">
                                    <Route index element={<ModeSelectorPage deck="sentences" />} />
                                    <Route
                                      path="recognition"
                                      element={<SentencesPage mode="pl-to-en" />}
                                    />
                                    <Route
                                      path="production"
                                      element={<SentencesPage mode="en-to-pl" />}
                                    />
                                  </Route>
                                  <Route path="/conjugation">
                                    <Route
                                      index
                                      element={<ModeSelectorPage deck="conjugation" />}
                                    />
                                    <Route
                                      path="recognition"
                                      element={<ConjugationPage mode="pl-to-en" />}
                                    />
                                    <Route
                                      path="production"
                                      element={<ConjugationPage mode="en-to-pl" />}
                                    />
                                  </Route>
                                  <Route path="/aspect-pairs" element={<AspectPairsPage />} />
                                  <Route
                                    path="/consonant-driller"
                                    element={<ConsonantDrillerPage />}
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
                                  <Route path="/audio" element={<AudioLibraryPage />} />
                                  <Route path="/audio/player" element={<AudioPlayerPage />} />
                                  <Route path="/listen" element={<ListeningHubPage />} />
                                  <Route path="/listen/play" element={<ListeningPlayerPage />} />
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
                            </BrowserRouter>
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
          <PwaUpdatePrompt />
          <OfflineIndicator />
        </SnackbarProvider>
      </ThemedApp>
    </ColorModeProvider>
  </StrictMode>
);

if (import.meta.env.DEV) {
  void import('./lib/devSignIn').then(({ devSignInFromUrl }) => devSignInFromUrl());
}
