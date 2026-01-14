import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './lib/theme';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { CheatSheetProvider } from './contexts/CheatSheetContext';
import { SignIn } from './components/SignIn';
import { Layout } from './components/Layout';
import { DeclensionPage } from './pages/DeclensionPage';
import { SentencesPage } from './pages/SentencesPage';
import { VocabularyPage } from './pages/VocabularyPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <TranslationProvider>
          <CheatSheetProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<SignIn />} />
                <Route path="/app" element={<Layout />}>
                  <Route index element={<DeclensionPage />} />
                  <Route path="sentences" element={<SentencesPage />} />
                  <Route path="vocabulary" element={<VocabularyPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CheatSheetProvider>
        </TranslationProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
