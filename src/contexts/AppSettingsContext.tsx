import { createContext, useContext, type ReactNode } from 'react';
import type { AppSettings } from '../types/appSettings';
import { appSettingsDoc } from '../lib/storage/userDocs';
import { stripUndefined } from '../lib/storage/firestoreUtils';
import { useUserDoc } from '../hooks/useUserDoc';

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export function useAppSettings(): AppSettingsContextType {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return context;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { value: settings, loading, update } = useUserDoc(appSettingsDoc);

  // An undefined value removes that setting; Firestore rejects undefined fields.
  const updateSettings = (updates: Partial<AppSettings>) =>
    update(stripUndefined({ ...settings, ...updates }));

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </AppSettingsContext.Provider>
  );
}
