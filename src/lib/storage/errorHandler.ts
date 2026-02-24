type ErrorHandler = (message: string) => void;

let globalErrorHandler: ErrorHandler | null = null;

export function setGlobalErrorHandler(handler: ErrorHandler | null): void {
  globalErrorHandler = handler;
}

export function showSaveError(error?: unknown): void {
  console.error('Firebase save error:', error);
  if (globalErrorHandler) {
    globalErrorHandler('Failed to save. Please try again.');
  }
}
