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
import { startDayIfNeeded } from '../../lib/reviewSession/sessionLists';
import { useLocalChanges } from './localChanges';
import { useToday } from './useToday';

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
  /** When a load started reading this data (latestLocalChange); changes made since are kept. */
  readAt?: number;
}

const EMPTY_CUSTOM_CARDS: CustomDeclensionCard[] = [];
const EMPTY_SYSTEM_CARDS: DeclensionCard[] = [];

export function DeclensionProvider({
  children,
  initialCustomCards = EMPTY_CUSTOM_CARDS,
  initialSystemCards = EMPTY_SYSTEM_CARDS,
  initialReviewStore,
  initialSettings = DEFAULT_DECLENSION_SETTINGS,
  readAt,
}: DeclensionProviderProps) {
  const [customDeclensionCards, setCustomDeclensionCardsState] =
    useState<CustomDeclensionCard[]>(initialCustomCards);
  const [systemDeclensionCards, setSystemDeclensionCards] =
    useState<DeclensionCard[]>(initialSystemCards);
  const [declensionReviewStore, setDeclensionReviewStore] = useState<DeclensionReviewDataStore>(
    initialReviewStore ?? getDefaultDeclensionReviewStore()
  );
  const storeRef = useRef(declensionReviewStore);
  const [declensionSettings, setDeclensionSettings] = useState<DeclensionSettings>(initialSettings);
  const localChanges = useLocalChanges();

  useSyncProps(
    { initialCustomCards, initialSystemCards, initialReviewStore, initialSettings },
    () => {
      if (!localChanges.changedSince('customItems', readAt)) {
        setCustomDeclensionCardsState(initialCustomCards);
      }
      setSystemDeclensionCards(initialSystemCards);
      if (!localChanges.changedSince('reviewStore', readAt)) {
        const next = initialReviewStore ?? getDefaultDeclensionReviewStore();
        setDeclensionReviewStore(next);
        storeRef.current = next;
      }
      if (!localChanges.changedSince('settings', readAt)) setDeclensionSettings(initialSettings);
    }
  );

  const today = useToday();
  const todaysReviewStore = useMemo(
    () => startDayIfNeeded(declensionReviewStore, ['reviewedToday', 'newCardsToday'], today),
    [declensionReviewStore, today]
  );

  const declensionCards = useMemo<DeclensionCard[]>(
    () => [...customDeclensionCards, ...systemDeclensionCards],
    [customDeclensionCards, systemDeclensionCards]
  );

  // Listener snapshots and page edits; a load that read the list before them must not undo them.
  const setCustomDeclensionCards = useCallback(
    (cards: CustomDeclensionCard[]) => {
      setCustomDeclensionCardsState(cards);
      localChanges.note('customItems');
    },
    [localChanges]
  );

  const { user } = useAuthContext();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsub = subscribeCustomDeclension((items) => {
      // Dropped if the listener closed (sign-out or account switch) while it was being handled.
      if (active) setCustomDeclensionCards(items);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user, setCustomDeclensionCards]);

  const updateDeclensionReviewStore = useCallback(
    async (store: DeclensionReviewDataStore) => {
      const prev = storeRef.current;
      storeRef.current = store;
      setDeclensionReviewStore(store);
      localChanges.note('reviewStore');
      try {
        await saveDeclensionReviewData(prev, store);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const updateDeclensionSettings = useCallback(
    async (settings: DeclensionSettings) => {
      setDeclensionSettings(settings);
      localChanges.note('settings');
      try {
        await saveDeclensionSettings(settings);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const clearDeclensionDataFn = useCallback(async () => {
    try {
      await clearDeclensionData();
      const freshStore = getDefaultDeclensionReviewStore();
      storeRef.current = freshStore;
      setDeclensionReviewStore(freshStore);
      setDeclensionSettings(DEFAULT_DECLENSION_SETTINGS);
      localChanges.note('reviewStore');
      localChanges.note('settings');
    } catch (e) {
      showSaveError(e);
    }
  }, [localChanges]);

  return (
    <DeclensionContext.Provider
      value={{
        declensionCards,
        customDeclensionCards,
        systemDeclensionCards,
        declensionReviewStore: todaysReviewStore,
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
