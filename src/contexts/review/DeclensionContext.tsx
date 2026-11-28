import { createContext, useMemo, type ReactNode } from 'react';
import type {
  DeclensionCard,
  CustomDeclensionCard,
  DeclensionReviewDataStore,
  DeclensionSettings,
} from '../../types';
import { subscribeCustomDeclension } from '../../lib/storage/customDeclension';
import { declensionStorage } from '../../lib/storage/reviewDeckStorage';
import { DEFAULT_DECLENSION_SETTINGS } from '../../constants';
import { useLocalChanges } from './localChanges';
import { useCustomItems, useLoadedState, useSinglePartProgress } from './deckState';

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
  const localChanges = useLocalChanges();
  const progress = useSinglePartProgress(
    declensionStorage,
    initialReviewStore,
    initialSettings,
    readAt,
    localChanges
  );
  const [customDeclensionCards, setCustomDeclensionCards] = useCustomItems(
    initialCustomCards,
    subscribeCustomDeclension,
    readAt,
    localChanges
  );
  const [systemDeclensionCards, setSystemDeclensionCards] = useLoadedState(initialSystemCards);

  const declensionCards = useMemo<DeclensionCard[]>(
    () => [...customDeclensionCards, ...systemDeclensionCards],
    [customDeclensionCards, systemDeclensionCards]
  );

  const value = useMemo<DeclensionContextType>(
    () => ({
      declensionCards,
      customDeclensionCards,
      systemDeclensionCards,
      declensionReviewStore: progress.store,
      declensionSettings: progress.settings,
      updateDeclensionReviewStore: progress.updateStore,
      updateDeclensionSettings: progress.updateSettings,
      clearDeclensionData: progress.clear,
      setCustomDeclensionCards,
      setSystemDeclensionCards,
    }),
    [
      declensionCards,
      customDeclensionCards,
      systemDeclensionCards,
      progress.store,
      progress.settings,
      progress.updateStore,
      progress.updateSettings,
      progress.clear,
      setCustomDeclensionCards,
      setSystemDeclensionCards,
    ]
  );

  return <DeclensionContext.Provider value={value}>{children}</DeclensionContext.Provider>;
}
