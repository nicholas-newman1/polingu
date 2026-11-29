import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type SnackbarSeverity = 'error' | 'success' | 'info' | 'warning';

export interface SnackbarAction {
  label: string;
  onClick: () => void;
}

export interface SnackbarOptions {
  action?: SnackbarAction;
}

export interface SnackbarMessage {
  id: number;
  message: string;
  severity: SnackbarSeverity;
  action?: SnackbarAction;
}

export interface SnackbarContextType {
  snackbar: SnackbarMessage | null;
  showSnackbar: (message: string, severity?: SnackbarSeverity, options?: SnackbarOptions) => void;
  hideSnackbar: () => void;
}

export const SnackbarContext = createContext<SnackbarContextType | null>(null);

let snackbarId = 0;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);

  const showSnackbar = useCallback(
    (message: string, severity: SnackbarSeverity = 'error', options?: SnackbarOptions) => {
      snackbarId += 1;
      setSnackbar({ id: snackbarId, message, severity, action: options?.action });
    },
    []
  );

  const hideSnackbar = useCallback(() => {
    setSnackbar(null);
  }, []);

  return (
    <SnackbarContext.Provider value={{ snackbar, showSnackbar, hideSnackbar }}>
      {children}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextType {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
