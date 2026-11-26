import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppSettings } from '../types/appSettings';
import { DEFAULT_APP_SETTINGS } from '../types/appSettings';
import loadAppSettings from '../lib/storage/loadAppSettings';
import saveAppSettings from '../lib/storage/saveAppSettings';
import { showSaveError } from '../lib/storage/errorHandler';
import { stripUndefined } from '../lib/storage/firestoreUtils';
import { useAuthContext } from '../hooks/useAuthContext';

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAppSettings(): AppSettingsContextType {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return context;
}

interface AppSettingsProviderProps {
  children: ReactNode;
}

export function AppSettingsProvider({ children }: AppSettingsProviderProps) {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (user) {
      loadAppSettings().then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          setLoading(false);
        }
      });
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setSettings(DEFAULT_APP_SETTINGS);
          setLoading(false);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      // An undefined value removes that setting; Firestore rejects undefined fields.
      const newSettings = stripUndefined({ ...settings, ...updates });
      setSettings(newSettings);
      try {
        await saveAppSettings(newSettings);
      } catch (e) {
        // The change is kept locally and synced later.
        showSaveError(e);
      }
    },
    [settings]
  );

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </AppSettingsContext.Provider>
  );
}
