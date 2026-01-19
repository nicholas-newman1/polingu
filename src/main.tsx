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
import { ReviewDataProvider } from './contexts/ReviewDataContext';
import { AuthGate } from './components/AuthGate';
import { SignIn } from './components/SignIn';
import { Layout } from './components/Layout';
import { AppSnackbar } from './components/AppSnackbar';
import { DashboardPage } from './pages/DashboardPage';
import { DeclensionPage } from './pages/DeclensionPage';
import { SentencesPage } from './pages/SentencesPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { CustomVocabularyPage } from './pages/CustomVocabularyPage';
import { CustomDeclensionPage } from './pages/CustomDeclensionPage';
import { StatsPage } from './pages/StatsPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <AuthProvider>
          <AuthGate>
            <ReviewDataProvider>
              <TranslationProvider>
                <CheatSheetProvider>
                  <BrowserRouter>
                    <Routes>
                      <Route path="/login" element={<SignIn />} />
                      <Route element={<Layout />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route
                          path="/declension"
                          element={<DeclensionPage />}
                        />
                        <Route path="/vocabulary">
                          <Route index element={<VocabularyPage />} />
                          <Route
                            path="recognition"
                            element={<VocabularyPage mode="pl-to-en" />}
                          />
                          <Route
                            path="production"
                            element={<VocabularyPage mode="en-to-pl" />}
                          />
                        </Route>
                        <Route path="/sentences" element={<SentencesPage />} />
                        <Route
                          path="/my-vocabulary"
                          element={<CustomVocabularyPage />}
                        />
                        <Route
                          path="/my-declensions"
                          element={<CustomDeclensionPage />}
                        />
                        <Route path="/stats" element={<StatsPage />} />
                      </Route>
                      <Route
                        path="*"
                        element={<Navigate to="/dashboard" replace />}
                      />
                    </Routes>
                  </BrowserRouter>
                </CheatSheetProvider>
              </TranslationProvider>
            </ReviewDataProvider>
          </AuthGate>
        </AuthProvider>
        <AppSnackbar />
      </SnackbarProvider>
    </ThemeProvider>
  </StrictMode>
);
