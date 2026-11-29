import { createContext, useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';
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
import { useCustomItems, useDeckProgress, useLoadedState, type DeckProgress } from './deckState';

export interface DeclensionContextType {
  progress: DeckProgress<'all', DeclensionReviewDataStore, DeclensionSettings>;
  /** The learner's cards first, then the built-in ones. */
  cards: DeclensionCard[];
  customCards: CustomDeclensionCard[];
  systemCards: DeclensionCard[];
  setCustomCards: Dispatch<SetStateAction<CustomDeclensionCard[]>>;
  setSystemCards: (cards: DeclensionCard[]) => void;
}

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
  const progress = useDeckProgress(
    declensionStorage,
    { all: initialReviewStore },
    { all: initialSettings },
    readAt,
    localChanges
  );
  const [customCards, setCustomCards] = useCustomItems(
    initialCustomCards,
    subscribeCustomDeclension,
    readAt,
    localChanges
  );
  const [systemCards, setSystemCards] = useLoadedState(initialSystemCards);

  const cards = useMemo(() => [...customCards, ...systemCards], [customCards, systemCards]);

  const value = useMemo<DeclensionContextType>(
    () => ({ progress, cards, customCards, systemCards, setCustomCards, setSystemCards }),
    [progress, cards, customCards, systemCards, setCustomCards, setSystemCards]
  );

  return <DeclensionContext.Provider value={value}>{children}</DeclensionContext.Provider>;
}
