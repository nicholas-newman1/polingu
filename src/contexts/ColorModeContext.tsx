import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ColorMode = 'light' | 'dark';

interface ColorModeContextType {
  mode: ColorMode;
  toggleMode: () => void;
}

const STORAGE_KEY = 'colorMode';

export const ColorModeContext = createContext<ColorModeContextType | null>(null);

function getInitialMode(): ColorMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can be unavailable (privacy mode); fall back below.
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

interface ColorModeProviderProps {
  children: ReactNode;
}

export function ColorModeProvider({ children }: ColorModeProviderProps) {
  const [mode, setMode] = useState<ColorMode>(getInitialMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore write failures (e.g., quota exceeded, privacy mode).
    }
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggleMode = useCallback(
    () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    []
  );

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within ColorModeProvider');
  }
  return context;
}
