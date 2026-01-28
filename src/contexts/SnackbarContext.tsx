import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { setGlobalErrorHandler } from '../lib/storage/errorHandler';

export type SnackbarSeverity = 'error' | 'success' | 'info' | 'warning';

export interface SnackbarMessage {
  id: number;
  message: string;
  severity: SnackbarSeverity;
}

export interface SnackbarContextType {
  snackbar: SnackbarMessage | null;
  showSnackbar: (message: string, severity?: SnackbarSeverity) => void;
  hideSnackbar: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SnackbarContext = createContext<SnackbarContextType | null>(null);

let snackbarId = 0;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);

  const showSnackbar = useCallback((message: string, severity: SnackbarSeverity = 'error') => {
    snackbarId += 1;
    setSnackbar({ id: snackbarId, message, severity });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar(null);
  }, []);

  useEffect(() => {
    setGlobalErrorHandler(showSnackbar);
    return () => setGlobalErrorHandler(null);
  }, [showSnackbar]);

  return (
    <SnackbarContext.Provider value={{ snackbar, showSnackbar, hideSnackbar }}>
      {children}
    </SnackbarContext.Provider>
  );
}
