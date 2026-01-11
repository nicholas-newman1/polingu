import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography, styled } from '@mui/material';
import { Flashcard, type RatingIntervals } from './components/Flashcard';
import { Header } from './components/Header';
import { FilterControls } from './components/FilterControls';
import { SettingsPanel } from './components/SettingsPanel';
import { FinishedState } from './components/FinishedState';
import { EmptyState } from './components/EmptyState';
import { DeclensionCheatSheetDrawer } from './components/DeclensionCheatSheetDrawer';
import { ConsonantsCheatSheetDrawer } from './components/ConsonantsCheatSheetDrawer';
import { YiRuleCheatSheetDrawer } from './components/YiRuleCheatSheetDrawer';
import { TranslatorModal } from './components/TranslatorModal';
import { LimitReachedDialog } from './components/LimitReachedDialog';
import { BottomMenuBar } from './components/BottomMenuBar';
import type { TranslationResult } from './lib/translate';
import cardsData from './data/cards.json';
import type {
  Card as CardType,
  Case,
  Gender,
  Number,
  ReviewDataStore,
  Settings,
} from './types';
import {
  loadReviewData,
  saveReviewData,
  loadSettings,
  saveSettings,
  getOrCreateCardReviewData,
  clearAllData,
} from './lib/storage';
import {
  getSessionCards,
  getPracticeAheadCards,
  getExtraNewCards,
  rateCard,
  getNextIntervals,
  type SessionCard,
} from './lib/scheduler';
import { useAuth } from './lib/useAuth';
import { DEFAULT_SETTINGS } from './constants';
import { getDefaultReviewStore, shuffleArray } from './lib/utils';

const allCards: CardType[] = cardsData as CardType[];

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  paddingBottom: theme.spacing(10),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
    paddingBottom: theme.spacing(10),
  },
}));

const LoadingContainer = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const MainContent = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

export default function App() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [reviewStore, setReviewStore] = useState<ReviewDataStore>(
    getDefaultReviewStore
  );
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeclensionCheatSheet, setShowDeclensionCheatSheet] =
    useState(false);
  const [showConsonantsCheatSheet, setShowConsonantsCheatSheet] =
    useState(false);
  const [showYiRuleCheatSheet, setShowYiRuleCheatSheet] = useState(false);
  const [showTranslator, setShowTranslator] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [limitResetTime, setLimitResetTime] = useState('');
  const [translationUsage, setTranslationUsage] = useState<{
    charsUsed: number;
    date: string;
    resetTime: string;
  } | null>(() => {
    const stored = localStorage.getItem('translationUsage');
    if (stored) {
      const parsed = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      if (parsed.date === today) {
        return parsed;
      }
    }
    return null;
  });
  const [practiceMode, setPracticeMode] = useState(false);

  const [caseFilter, setCaseFilter] = useState<Case | 'All'>('All');
  const [genderFilter, setGenderFilter] = useState<Gender | 'All'>('All');
  const [numberFilter, setNumberFilter] = useState<Number | 'All'>('All');

  const [learningQueue, setLearningQueue] = useState<SessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<CardType[]>([]);
  const [sessionQueue, setSessionQueue] = useState<SessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);
  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [isPracticeAhead, setIsPracticeAhead] = useState(false);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (caseFilter !== 'All' && card.case !== caseFilter) return false;
      if (genderFilter !== 'All' && card.gender !== genderFilter) return false;
      if (numberFilter !== 'All' && card.number !== numberFilter) return false;
      return true;
    });
  }, [caseFilter, genderFilter, numberFilter]);

  const buildSession = useCallback(
    (store: ReviewDataStore, currentSettings: Settings) => {
      const filters = {
        case: caseFilter,
        gender: genderFilter,
        number: numberFilter,
      };
      const { reviewCards, newCards } = getSessionCards(
        allCards,
        store,
        filters,
        currentSettings
      );
      setSessionQueue([...reviewCards, ...newCards]);
      setReviewCount(reviewCards.length);
      setNewCount(newCards.length);
      setLearningQueue([]);
      setCurrentIndex(0);
    },
    [caseFilter, genderFilter, numberFilter]
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [loadedSettings, loadedReviewData] = await Promise.all([
        loadSettings(),
        loadReviewData(),
      ]);
      setSettings(loadedSettings);
      setReviewStore(loadedReviewData);
      buildSession(loadedReviewData, loadedSettings);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetSession = useCallback(() => {
    buildSession(reviewStore, settings);
  }, [buildSession, reviewStore, settings]);

  const startPracticeAhead = useCallback(() => {
    const filters = {
      case: caseFilter,
      gender: genderFilter,
      number: numberFilter,
    };
    const aheadCards = getPracticeAheadCards(
      allCards,
      reviewStore,
      filters,
      practiceAheadCount
    );
    setSessionQueue(aheadCards);
    setReviewCount(aheadCards.length);
    setNewCount(0);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(true);
  }, [caseFilter, genderFilter, numberFilter, reviewStore, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const filters = {
      case: caseFilter,
      gender: genderFilter,
      number: numberFilter,
    };
    const extraCards = getExtraNewCards(
      allCards,
      reviewStore,
      filters,
      extraNewCardsCount
    );
    setSessionQueue(extraCards);
    setReviewCount(0);
    setNewCount(extraCards.length);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(false);
  }, [caseFilter, genderFilter, numberFilter, reviewStore, extraNewCardsCount]);

  const handleFilterChange = useCallback(
    (
      newCaseFilter: Case | 'All',
      newGenderFilter: Gender | 'All',
      newNumberFilter: Number | 'All'
    ) => {
      if (practiceMode) {
        setPracticeCards(
          shuffleArray(
            allCards.filter((card) => {
              if (newCaseFilter !== 'All' && card.case !== newCaseFilter)
                return false;
              if (newGenderFilter !== 'All' && card.gender !== newGenderFilter)
                return false;
              if (newNumberFilter !== 'All' && card.number !== newNumberFilter)
                return false;
              return true;
            })
          )
        );
        setPracticeIndex(0);
      }
    },
    [practiceMode]
  );

  const handleCaseChange = useCallback(
    (value: Case | 'All') => {
      setCaseFilter(value);
      resetSession();
      handleFilterChange(value, genderFilter, numberFilter);
    },
    [resetSession, handleFilterChange, genderFilter, numberFilter]
  );

  const handleGenderChange = useCallback(
    (value: Gender | 'All') => {
      setGenderFilter(value);
      resetSession();
      handleFilterChange(caseFilter, value, numberFilter);
    },
    [resetSession, handleFilterChange, caseFilter, numberFilter]
  );

  const handleNumberChange = useCallback(
    (value: Number | 'All') => {
      setNumberFilter(value);
      resetSession();
      handleFilterChange(caseFilter, genderFilter, value);
    },
    [resetSession, handleFilterChange, caseFilter, genderFilter]
  );

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      setPracticeCards(shuffleArray(filteredCards));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode, filteredCards]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished =
    currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    const updatedReviewData = rateCard(currentSessionCard.reviewData, rating);

    const newStore = { ...reviewStore };
    newStore.cards = { ...newStore.cards };
    newStore.cards[currentSessionCard.card.id] = updatedReviewData;

    if (
      currentSessionCard.isNew &&
      !newStore.newCardsToday.includes(currentSessionCard.card.id)
    ) {
      newStore.newCardsToday = [
        ...newStore.newCardsToday,
        currentSessionCard.card.id,
      ];
    }

    if (rating === Rating.Again) {
      if (currentIndex < sessionQueue.length) {
        setLearningQueue((prev) => [
          ...prev,
          { ...currentSessionCard, reviewData: updatedReviewData },
        ]);
        setCurrentIndex((prev) => prev + 1);
      } else {
        const updated = learningQueue.map((item, idx) =>
          idx === 0 ? { ...item, reviewData: updatedReviewData } : item
        );
        setLearningQueue([...updated.slice(1), updated[0]]);
      }
    } else {
      if (!newStore.reviewedToday.includes(currentSessionCard.card.id)) {
        newStore.reviewedToday = [
          ...newStore.reviewedToday,
          currentSessionCard.card.id,
        ];
      }

      if (currentIndex < sessionQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLearningQueue((prev) => prev.slice(1));
      }
    }

    setReviewStore(newStore);
    setRatingCounter((c) => c + 1);
    saveReviewData(newStore);
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...settings, newCardsPerDay };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your progress and cannot be undone.'
      )
    ) {
      await clearAllData();
      const freshStore = await loadReviewData();
      setReviewStore(freshStore);
      setSettings(await loadSettings());
      buildSession(freshStore, settings);
      setShowSettings(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const MAX_CHARS_PER_DAY = 1500;

  const handleOpenTranslator = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (
      translationUsage &&
      translationUsage.date === today &&
      translationUsage.charsUsed >= MAX_CHARS_PER_DAY
    ) {
      setLimitResetTime(translationUsage.resetTime);
      setShowLimitReached(true);
    } else {
      setShowTranslator(true);
    }
  }, [translationUsage]);

  const handleCloseTranslator = useCallback(() => {
    setShowTranslator(false);
  }, []);

  const handleDailyLimitReached = useCallback((resetTime: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newUsage = {
      charsUsed: MAX_CHARS_PER_DAY,
      date: today,
      resetTime,
    };
    setTranslationUsage(newUsage);
    localStorage.setItem('translationUsage', JSON.stringify(newUsage));
    setLimitResetTime(resetTime);
    setShowLimitReached(true);
  }, []);

  const handleTranslationSuccess = useCallback((result: TranslationResult) => {
    const today = new Date().toISOString().split('T')[0];
    const newUsage = {
      charsUsed: result.charsUsedToday,
      date: today,
      resetTime: result.resetTime,
    };
    setTranslationUsage(newUsage);
    localStorage.setItem('translationUsage', JSON.stringify(newUsage));
  }, []);

  const intervals: RatingIntervals = useMemo(() => {
    if (!currentSessionCard) {
      return {
        [Rating.Again]: '',
        [Rating.Hard]: '',
        [Rating.Good]: '',
        [Rating.Easy]: '',
      };
    }
    const allIntervals = getNextIntervals(
      getOrCreateCardReviewData(currentSessionCard.card.id, reviewStore)
        .fsrsCard
    );
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [currentSessionCard, reviewStore]);

  const totalRemaining =
    sessionQueue.length - currentIndex + learningQueue.length;

  const currentPracticeCard = practiceCards[practiceIndex];

  if (isLoading) {
    return (
      <LoadingContainer>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </LoadingContainer>
    );
  }

  return (
    <PageContainer>
      <Header user={user} onSignOut={handleSignOut} />

      <FilterControls
        caseFilter={caseFilter}
        genderFilter={genderFilter}
        numberFilter={numberFilter}
        practiceMode={practiceMode}
        showSettings={showSettings}
        onCaseChange={handleCaseChange}
        onGenderChange={handleGenderChange}
        onNumberChange={handleNumberChange}
        onTogglePractice={togglePracticeMode}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />

      {showSettings && !practiceMode && (
        <SettingsPanel
          settings={settings}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
        />
      )}

      <MainContent>
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ mb: { xs: 3, sm: 4 }, textAlign: 'center' }}
        >
          {practiceMode
            ? `Practice Mode · ${practiceCards.length} cards`
            : isFinished
            ? ''
            : isPracticeAhead
            ? `Practice Ahead · ${totalRemaining} remaining`
            : `${reviewCount} reviews · ${newCount} new · ${totalRemaining} remaining`}
        </Typography>

        {practiceMode ? (
          currentPracticeCard ? (
            <Flashcard
              key={`practice-${currentPracticeCard.id}-${practiceIndex}`}
              card={currentPracticeCard}
              practiceMode
              onNext={handlePracticeNext}
              onDailyLimitReached={handleDailyLimitReached}
            />
          ) : (
            <EmptyState message="No cards match your filters" />
          )
        ) : isFinished ? (
          <FinishedState
            practiceAheadCount={practiceAheadCount}
            setPracticeAheadCount={setPracticeAheadCount}
            extraNewCardsCount={extraNewCardsCount}
            setExtraNewCardsCount={setExtraNewCardsCount}
            onPracticeAhead={startPracticeAhead}
            onLearnExtra={startExtraNewCards}
          />
        ) : currentSessionCard ? (
          <Flashcard
            key={`${currentSessionCard.card.id}-${ratingCounter}`}
            card={currentSessionCard.card}
            intervals={intervals}
            onRate={handleRate}
            onDailyLimitReached={handleDailyLimitReached}
          />
        ) : null}
      </MainContent>

      <DeclensionCheatSheetDrawer
        open={showDeclensionCheatSheet}
        onClose={() => setShowDeclensionCheatSheet(false)}
      />

      <ConsonantsCheatSheetDrawer
        open={showConsonantsCheatSheet}
        onClose={() => setShowConsonantsCheatSheet(false)}
      />

      <YiRuleCheatSheetDrawer
        open={showYiRuleCheatSheet}
        onClose={() => setShowYiRuleCheatSheet(false)}
      />

      <TranslatorModal
        open={showTranslator}
        onClose={handleCloseTranslator}
        onDailyLimitReached={handleDailyLimitReached}
        onTranslationSuccess={handleTranslationSuccess}
      />

      <LimitReachedDialog
        open={showLimitReached}
        onClose={() => setShowLimitReached(false)}
        resetTime={limitResetTime}
      />

      <BottomMenuBar
        onOpenDeclensionCheatSheet={() => {
          setShowConsonantsCheatSheet(false);
          setShowYiRuleCheatSheet(false);
          setShowDeclensionCheatSheet((prev) => !prev);
        }}
        onOpenConsonantsCheatSheet={() => {
          setShowDeclensionCheatSheet(false);
          setShowYiRuleCheatSheet(false);
          setShowConsonantsCheatSheet((prev) => !prev);
        }}
        onOpenYiRuleCheatSheet={() => {
          setShowDeclensionCheatSheet(false);
          setShowConsonantsCheatSheet(false);
          setShowYiRuleCheatSheet((prev) => !prev);
        }}
        onOpenTranslator={handleOpenTranslator}
        showTranslator={!!user}
      />
    </PageContainer>
  );
}
