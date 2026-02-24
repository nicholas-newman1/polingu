type SnackbarSeverity = 'error' | 'success' | 'info' | 'warning';
type SnackbarHandler = (message: string, severity?: SnackbarSeverity) => void;

let globalSnackbarHandler: SnackbarHandler | null = null;

export function setGlobalErrorHandler(handler: SnackbarHandler | null): void {
  globalSnackbarHandler = handler;
}

export function showSaveError(error?: unknown): void {
  console.error('Firebase save error:', error);
  if (globalSnackbarHandler) {
    globalSnackbarHandler('Failed to save. Please try again.', 'error');
  }
}

export function showOfflineModeNotification(): void {
  if (globalSnackbarHandler) {
    globalSnackbarHandler('Using offline data', 'info');
  }
}
