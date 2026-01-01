import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rating, type Grade } from 'ts-fsrs';
import { Flashcard, type RatingIntervals } from './components/Flashcard';
import cardsData from './data/cards.json';
import type {
  Card,
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
  rateCard,
  getNextIntervals,
  type SessionCard,
} from './lib/scheduler';
import { useAuth } from './lib/useAuth';

const allCards: Card[] = cardsData as Card[];

const CASES: Case[] = [
  'Nominative',
  'Genitive',
  'Dative',
  'Accusative',
  'Instrumental',
  'Locative',
  'Vocative',
];
const GENDERS: Gender[] = ['Masculine', 'Feminine', 'Neuter', 'Pronoun'];
const NUMBERS: Number[] = ['Singular', 'Plural'];

const DEFAULT_SETTINGS: Settings = { newCardsPerDay: 10 };

function getDefaultReviewStore(): ReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: new Date().toISOString().split('T')[0],
  };
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function App() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [reviewStore, setReviewStore] = useState<ReviewDataStore>(
    getDefaultReviewStore
  );
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);

  const [caseFilter, setCaseFilter] = useState<Case | 'All'>('All');
  const [genderFilter, setGenderFilter] = useState<Gender | 'All'>('All');
  const [numberFilter, setNumberFilter] = useState<Number | 'All'>('All');

  const [learningQueue, setLearningQueue] = useState<SessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<Card[]>([]);
  const [sessionQueue, setSessionQueue] = useState<SessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);

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

  const checkForNewCards = useCallback(async () => {
    const freshStore = await loadReviewData();
    setReviewStore(freshStore);
    buildSession(freshStore, settings);
  }, [buildSession, settings]);

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
    await saveReviewData(newStore);
    setRatingCounter((c) => c + 1);
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading your progress...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {user ? (
          <>
            <span className="text-slate-400 text-sm">
              {user.displayName || user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-white text-sm transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <span className="text-amber-500/80 text-sm">
            Guest mode · Progress not saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-4xl font-light text-white tracking-tight">
          Polish Declension
        </h1>
        <button
          onClick={togglePracticeMode}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            practiceMode
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Practice {practiceMode ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-slate-400 hover:text-white transition-colors"
          title="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {showSettings && !practiceMode && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6 w-96 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-sm">New cards per day:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.newCardsPerDay}
              onChange={(e) =>
                handleSettingsChange(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-20 bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-rose-500"
            />
          </div>
          {user && (
            <div className="border-t border-slate-700 pt-4">
              <button
                onClick={handleResetAllData}
                className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
              >
                Reset All Progress
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6 justify-center">
        <select
          value={caseFilter}
          onChange={(e) => {
            setCaseFilter(e.target.value as Case | 'All');
            resetSession();
            if (practiceMode) {
              setPracticeCards(
                shuffleArray(
                  allCards.filter((card) => {
                    if (
                      e.target.value !== 'All' &&
                      card.case !== e.target.value
                    )
                      return false;
                    if (genderFilter !== 'All' && card.gender !== genderFilter)
                      return false;
                    if (numberFilter !== 'All' && card.number !== numberFilter)
                      return false;
                    return true;
                  })
                )
              );
              setPracticeIndex(0);
            }
          }}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
        >
          <option value="All">All Cases</option>
          {CASES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={genderFilter}
          onChange={(e) => {
            setGenderFilter(e.target.value as Gender | 'All');
            resetSession();
            if (practiceMode) {
              setPracticeCards(
                shuffleArray(
                  allCards.filter((card) => {
                    if (caseFilter !== 'All' && card.case !== caseFilter)
                      return false;
                    if (
                      e.target.value !== 'All' &&
                      card.gender !== e.target.value
                    )
                      return false;
                    if (numberFilter !== 'All' && card.number !== numberFilter)
                      return false;
                    return true;
                  })
                )
              );
              setPracticeIndex(0);
            }
          }}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
        >
          <option value="All">All Genders</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={numberFilter}
          onChange={(e) => {
            setNumberFilter(e.target.value as Number | 'All');
            resetSession();
            if (practiceMode) {
              setPracticeCards(
                shuffleArray(
                  allCards.filter((card) => {
                    if (caseFilter !== 'All' && card.case !== caseFilter)
                      return false;
                    if (genderFilter !== 'All' && card.gender !== genderFilter)
                      return false;
                    if (
                      e.target.value !== 'All' &&
                      card.number !== e.target.value
                    )
                      return false;
                    return true;
                  })
                )
              );
              setPracticeIndex(0);
            }
          }}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
        >
          <option value="All">All Numbers</option>
          {NUMBERS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <p className="text-slate-500 mb-8">
        {practiceMode
          ? `Practice Mode · ${practiceCards.length} cards`
          : isFinished
          ? ''
          : `${reviewCount} reviews · ${newCount} new · ${totalRemaining} remaining`}
      </p>

      {practiceMode ? (
        currentPracticeCard ? (
          <Flashcard
            key={`practice-${currentPracticeCard.id}-${practiceIndex}`}
            card={currentPracticeCard}
            practiceMode
            onNext={handlePracticeNext}
          />
        ) : (
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 via-white to-rose-500 rounded-3xl blur opacity-30" />
            <div className="relative bg-slate-800 border border-slate-700 rounded-3xl p-10 w-96 text-center">
              <p className="text-xl text-slate-400">
                No cards match your filters
              </p>
            </div>
          </div>
        )
      ) : isFinished ? (
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 via-white to-rose-500 rounded-3xl blur opacity-30" />
          <div className="relative bg-slate-800 border border-slate-700 rounded-3xl p-10 w-96 text-center">
            <p className="text-3xl font-light text-white mb-2">
              Done for today!
            </p>
            <p className="text-slate-400 mb-8">
              Come back tomorrow for more practice
            </p>
            <button
              onClick={checkForNewCards}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
            >
              Check for new cards
            </button>
          </div>
        </div>
      ) : currentSessionCard ? (
        <Flashcard
          key={`${currentSessionCard.card.id}-${ratingCounter}`}
          card={currentSessionCard.card}
          intervals={intervals}
          onRate={handleRate}
        />
      ) : null}
    </div>
  );
}
