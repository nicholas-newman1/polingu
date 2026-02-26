import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './lib/theme';
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
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardPage } from './pages/DashboardPage';
import { DeclensionPage } from './pages/DeclensionPage';
import { SentencesPage } from './pages/SentencesPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { ConjugationPage } from './pages/ConjugationPage';
import { AspectPairsPage } from './pages/AspectPairsPage';
import { ConsonantDrillerPage } from './pages/ConsonantDrillerPage';
import { CustomVocabularyPage } from './pages/CustomVocabularyPage';
import { CustomDeclensionPage } from './pages/CustomDeclensionPage';
import { CustomSentencesPage } from './pages/CustomSentencesPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SentenceGeneratorPage } from './pages/SentenceGenerator';
import { LibraryPage } from './pages/LibraryPage';
import { ReaderPage } from './pages/ReaderPage';
import { AppSettingsProvider } from './contexts/AppSettingsContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <AuthProvider>
          <AuthGate>
            <ReviewDataProvider>
              <AppSettingsProvider>
                <TranslationProvider>
                  <CheatSheetProvider>
                    <BrowserRouter>
                      <Routes>
                        <Route path="/login" element={<SignIn />} />
                        <Route element={<Layout />}>
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/declension" element={<DeclensionPage />} />
                          <Route path="/vocabulary">
                            <Route index element={<VocabularyPage />} />
                            <Route
                              path="recognition"
                              element={<VocabularyPage mode="pl-to-en" />}
                            />
                            <Route path="production" element={<VocabularyPage mode="en-to-pl" />} />
                          </Route>
                          <Route path="/sentences">
                            <Route index element={<SentencesPage />} />
                            <Route path="recognition" element={<SentencesPage mode="pl-to-en" />} />
                            <Route path="production" element={<SentencesPage mode="en-to-pl" />} />
                          </Route>
                          <Route path="/conjugation">
                            <Route index element={<ConjugationPage />} />
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
                          <Route path="/consonant-driller" element={<ConsonantDrillerPage />} />
                          <Route path="/my-vocabulary" element={<CustomVocabularyPage />} />
                          <Route path="/my-declensions" element={<CustomDeclensionPage />} />
                          <Route path="/my-sentences" element={<CustomSentencesPage />} />
                          <Route path="/stats" element={<StatsPage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                          <Route path="/library" element={<LibraryPage />} />
                          <Route path="/admin/generator" element={<SentenceGeneratorPage />} />
                        </Route>
                        <Route path="/reader/:bookId" element={<ReaderPage />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </BrowserRouter>
                  </CheatSheetProvider>
                </TranslationProvider>
              </AppSettingsProvider>
            </ReviewDataProvider>
          </AuthGate>
        </AuthProvider>
        <AppSnackbar />
        <OfflineIndicator />
      </SnackbarProvider>
    </ThemeProvider>
  </StrictMode>
);
