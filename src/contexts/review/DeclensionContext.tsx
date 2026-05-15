import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  DeclensionCard,
  CustomDeclensionCard,
  DeclensionReviewDataStore,
  DeclensionSettings,
} from '../../types';
import loadDeclensionReviewData from '../../lib/storage/loadDeclensionReviewData';
import loadDeclensionSettings from '../../lib/storage/loadDeclensionSettings';
import saveDeclensionReviewData from '../../lib/storage/saveDeclensionReviewData';
import saveDeclensionSettings from '../../lib/storage/saveDeclensionSettings';
import {
  loadCustomDeclension,
  subscribeCustomDeclension,
} from '../../lib/storage/customDeclension';
import { useAuthContext } from '../../hooks/useAuthContext';
import clearDeclensionData from '../../lib/storage/clearDeclensionData';
import { getDefaultDeclensionReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';
import { DEFAULT_DECLENSION_SETTINGS } from '../../constants';
import { useSyncProps } from '../../hooks/useSyncProps';

export interface DeclensionContextType {
  declensionCards: DeclensionCard[];
  customDeclensionCards: CustomDeclensionCard[];
  systemDeclensionCards: DeclensionCard[];
  declensionReviewStore: DeclensionReviewDataStore;
  declensionSettings: DeclensionSettings;
  updateDeclensionReviewStore: (store: DeclensionReviewDataStore) => Promise<void>;
  updateDeclensionSettings: (settings: DeclensionSettings) => Promise<void>;
  clearDeclensionData: () => Promise<void>;
  setCustomDeclensionCards: (cards: CustomDeclensionCard[]) => void;
  setSystemDeclensionCards: (cards: DeclensionCard[]) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DeclensionContext = createContext<DeclensionContextType | null>(null);

interface DeclensionProviderProps {
  children: ReactNode;
  initialCustomCards?: CustomDeclensionCard[];
  initialSystemCards?: DeclensionCard[];
  initialReviewStore?: DeclensionReviewDataStore;
  initialSettings?: DeclensionSettings;
}

const EMPTY_CUSTOM_CARDS: CustomDeclensionCard[] = [];
const EMPTY_SYSTEM_CARDS: DeclensionCard[] = [];

export function DeclensionProvider({
  children,
  initialCustomCards = EMPTY_CUSTOM_CARDS,
  initialSystemCards = EMPTY_SYSTEM_CARDS,
  initialReviewStore,
  initialSettings = DEFAULT_DECLENSION_SETTINGS,
}: DeclensionProviderProps) {
  const [customDeclensionCards, setCustomDeclensionCards] =
    useState<CustomDeclensionCard[]>(initialCustomCards);
  const [systemDeclensionCards, setSystemDeclensionCards] =
    useState<DeclensionCard[]>(initialSystemCards);
  const [declensionReviewStore, setDeclensionReviewStore] = useState<DeclensionReviewDataStore>(
    initialReviewStore ?? getDefaultDeclensionReviewStore()
  );
  const storeRef = useRef(declensionReviewStore);
  const [declensionSettings, setDeclensionSettings] = useState<DeclensionSettings>(initialSettings);

  useSyncProps(
    { initialCustomCards, initialSystemCards, initialReviewStore, initialSettings },
    () => {
      setCustomDeclensionCards(initialCustomCards);
      setSystemDeclensionCards(initialSystemCards);
      const next = initialReviewStore ?? getDefaultDeclensionReviewStore();
      setDeclensionReviewStore(next);
      storeRef.current = next;
      setDeclensionSettings(initialSettings);
    }
  );

  const declensionCards = useMemo<DeclensionCard[]>(
    () => [...customDeclensionCards, ...systemDeclensionCards],
    [customDeclensionCards, systemDeclensionCards]
  );

  const { user } = useAuthContext();
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeCustomDeclension((items) => {
      setCustomDeclensionCards(items);
    });
    return unsub;
  }, [user]);

  const updateDeclensionReviewStore = useCallback(async (store: DeclensionReviewDataStore) => {
    const prev = storeRef.current;
    storeRef.current = store;
    setDeclensionReviewStore(store);
    try {
      await saveDeclensionReviewData(prev, store);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const updateDeclensionSettings = useCallback(async (settings: DeclensionSettings) => {
    setDeclensionSettings(settings);
    try {
      await saveDeclensionSettings(settings);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const clearDeclensionDataFn = useCallback(async () => {
    try {
      await clearDeclensionData();
      const freshStore = getDefaultDeclensionReviewStore();
      storeRef.current = freshStore;
      setDeclensionReviewStore(freshStore);
      setDeclensionSettings(DEFAULT_DECLENSION_SETTINGS);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  return (
    <DeclensionContext.Provider
      value={{
        declensionCards,
        customDeclensionCards,
        systemDeclensionCards,
        declensionReviewStore,
        declensionSettings,
        updateDeclensionReviewStore,
        updateDeclensionSettings,
        clearDeclensionData: clearDeclensionDataFn,
        setCustomDeclensionCards,
        setSystemDeclensionCards,
      }}
    >
      {children}
    </DeclensionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadDeclensionData() {
  const [settings, reviewData, customCards] = await Promise.all([
    loadDeclensionSettings(),
    loadDeclensionReviewData(),
    loadCustomDeclension(),
  ]);
  return { settings, reviewData, customCards };
}
