import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, styled } from '@mui/material';
import { DeclensionFlashcard } from './components/DeclensionFlashcard';
import { DeclensionFilterControls } from './components/DeclensionFilterControls';
import { SettingsPanel } from '../../components/SettingsPanel';
import { FinishedState } from '../../components/FinishedState';
import { ReviewStage } from '../../components/ReviewStage';
import { SessionStatusLine } from '../../components/SessionStatusLine';
import { ReviewMainContent } from '../../components/ReviewLayout';
import { EditDeclensionModal } from '../../components/EditDeclensionModal';
import type { DeclensionCard, CustomDeclensionCard, Case, Gender, Number } from '../../types';
import {
  updateDeclensionCard,
  updateDeclensionCardTranslation,
  deleteDeclensionCard,
} from '../../lib/storage/systemDeclension';
import { saveCustomDeclension } from '../../lib/storage/customDeclension';
import { generateCustomId } from '../../types/customItems';
import getDeclensionSessionCards from '../../lib/declensionScheduler/getSessionCards';
import getDeclensionExtraCards from '../../lib/declensionScheduler/getExtraCards';
import matchesDeclensionFilters from '../../lib/declensionScheduler/matchesFilters';
import type { DeclensionFilters } from '../../lib/declensionScheduler/types';
import { recordCardReview } from '../../lib/reviewSession/recordReview';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useReviewData } from '../../hooks/useReviewData';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useReviewSession } from '../../hooks/useReviewSession';
import { useUserFilters } from '../../contexts/UserFiltersContext';
import { useListening } from '../../contexts/ListeningContext';
import { buildDeclensionListeningQueue } from '../../lib/listeningScheduler';

const LoadingContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export function DeclensionPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const {
    loading: contextLoading,
    customDeclensionCards: contextCustomDeclensionCards,
    systemDeclensionCards: contextSystemDeclensionCards,
    declensionReviewStore: reviewStore,
    declensionSettings: settings,
    updateDeclensionReviewStore,
    updateDeclensionSettings,
    clearDeclensionData,
    setCustomDeclensionCards: setContextCustomDeclensionCards,
    setSystemDeclensionCards: setContextSystemDeclensionCards,
  } = useReviewData();

  const [customDeclensionCards, applyOptimisticCustomCards] = useOptimistic(
    contextCustomDeclensionCards,
    {
      onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
    }
  );

  const [systemDeclensionCards, applyOptimisticSystemCards] = useOptimistic(
    contextSystemDeclensionCards,
    {
      onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
    }
  );

  const allDeclensionCards = useMemo(
    () => [...customDeclensionCards, ...systemDeclensionCards],
    [customDeclensionCards, systemDeclensionCards]
  );

  const { filters: userFilters, filtersLoading, updateDeclensionFilters } = useUserFilters();
  const filters: DeclensionFilters = userFilters.declension;

  const { start: startListening, settings: listeningSettings } = useListening();

  const [showSettings, setShowSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState<DeclensionCard | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const session = useReviewSession({
    cardKey: 'card',
    getId: (card) => card.id,
    getAudioUrls: (card) => [card.audioUrl],
    ready: !contextLoading && !filtersLoading && allDeclensionCards.length > 0,
    getSessionCards: () =>
      getDeclensionSessionCards(allDeclensionCards, reviewStore, filters, settings),
    ...getDeclensionExtraCards(allDeclensionCards, reviewStore, filters),
    reviewStore,
    recordReview: recordCardReview,
    saveReviewStore: updateDeclensionReviewStore,
  });
  const { practice, history } = session;
  const { canGoBack, goBack, goForward } = history;

  const handleFiltersChange = (newFilters: DeclensionFilters) => {
    updateDeclensionFilters(newFilters);
    session.startSession(
      getDeclensionSessionCards(allDeclensionCards, reviewStore, newFilters, settings)
    );
    if (practice.active) {
      practice.reshuffle(allDeclensionCards.filter((c) => matchesDeclensionFilters(c, newFilters)));
    }
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...settings, newCardsPerDay };
    await updateDeclensionSettings(newSettings);
  };

  const handleResetAllData = async () => {
    if (window.confirm('Are you sure? This will erase all your progress and cannot be undone.')) {
      await clearDeclensionData();
      session.rebuildSession();
      setShowSettings(false);
    }
  };

  const openEditModal = (card: DeclensionCard) => {
    setEditingCard(card);
    setIsCreatingNew(false);
    setShowEditModal(true);
  };

  const handleOpenCreateModal = useCallback(() => {
    setEditingCard(null);
    setIsCreatingNew(true);
    setShowEditModal(true);
  }, []);

  const replaceCard = (updatedCard: DeclensionCard) =>
    session.updateCards(
      (c) => c.id === updatedCard.id,
      () => updatedCard
    );

  const handleSaveCard = (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
    if (isCreatingNew) {
      const newCard: CustomDeclensionCard = {
        ...cardData,
        id: generateCustomId(),
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomCards = [...customDeclensionCards, newCard];

      applyOptimisticCustomCards(newCustomCards, async () => {
        await saveCustomDeclension(newCustomCards);
        setContextCustomDeclensionCards(newCustomCards);
      });

      session.startSession(
        getDeclensionSessionCards(
          [...newCustomCards, ...systemDeclensionCards],
          reviewStore,
          filters,
          settings
        )
      );
      return;
    }

    if (!editingCard) return;
    const updatedCard = { ...editingCard, ...cardData };
    replaceCard(updatedCard);

    if (editingCard.isCustom === true) {
      const newCustomCards = customDeclensionCards.map((card) =>
        card.id === editingCard.id ? { ...card, ...cardData } : card
      );
      applyOptimisticCustomCards(newCustomCards, async () => {
        await saveCustomDeclension(newCustomCards);
        setContextCustomDeclensionCards(newCustomCards);
      });
    } else {
      const newSystemCards = systemDeclensionCards.map((card) =>
        card.id === editingCard.id ? updatedCard : card
      );
      applyOptimisticSystemCards(newSystemCards, async () => {
        await updateDeclensionCard(editingCard.id as number, cardData);
        setContextSystemDeclensionCards(newSystemCards);
      });
    }
  };

  const deleteCard = (
    card: DeclensionCard,
    { skipConfirm = false }: { skipConfirm?: boolean } = {}
  ): boolean => {
    const isCustomCard = card.isCustom === true;
    if (!isCustomCard && !isAdmin) return false;

    if (!skipConfirm) {
      const confirmMessage = isCustomCard
        ? 'Are you sure you want to delete this custom card?'
        : 'Are you sure you want to delete this system declension card? This will affect all users.';
      if (!window.confirm(confirmMessage)) return false;
    }

    session.removeCards((c) => c.id === card.id);

    if (isCustomCard) {
      const newCustomCards = customDeclensionCards.filter((c) => c.id !== card.id);
      applyOptimisticCustomCards(newCustomCards, async () => {
        await saveCustomDeclension(newCustomCards);
        setContextCustomDeclensionCards(newCustomCards);
      });
    } else {
      const newSystemCards = systemDeclensionCards.filter((c) => c.id !== card.id);
      applyOptimisticSystemCards(newSystemCards, async () => {
        await deleteDeclensionCard(card.id as number);
        setContextSystemDeclensionCards(newSystemCards);
      });
    }
    return true;
  };

  const handleDeleteEditingCard = () => {
    if (!editingCard) return;
    deleteCard(editingCard, { skipConfirm: true });
    setShowEditModal(false);
    setEditingCard(null);
  };

  const handleUpdateTranslation = (
    cardId: DeclensionCard['id'],
    word: string,
    translation: string
  ) => {
    const card = allDeclensionCards.find((c) => c.id === cardId);
    if (!card) return;

    const updatedTranslations = { ...card.translations, [word]: translation };
    const updatedCard = { ...card, translations: updatedTranslations };
    replaceCard(updatedCard);

    if (card.isCustom) {
      const newCustomCards = customDeclensionCards.map((c) =>
        c.id === cardId ? { ...c, translations: updatedTranslations } : c
      );
      applyOptimisticCustomCards(newCustomCards, async () => {
        await saveCustomDeclension(newCustomCards);
        setContextCustomDeclensionCards(newCustomCards);
      });
    } else {
      const newSystemCards = systemDeclensionCards.map((c) => (c.id === cardId ? updatedCard : c));
      applyOptimisticSystemCards(newSystemCards, async () => {
        await updateDeclensionCardTranslation(cardId as number, word, translation);
        setContextSystemDeclensionCards(newSystemCards);
      });
    }
  };

  const translationHandler = (card: DeclensionCard) =>
    isAdmin
      ? (word: string, translation: string) => handleUpdateTranslation(card.id, word, translation)
      : undefined;

  if (contextLoading || filtersLoading || !session.isBuilt) {
    return (
      <LoadingContainer>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </LoadingContainer>
    );
  }

  return (
    <>
      <DeclensionFilterControls
        caseFilter={filters.cases}
        genderFilter={filters.genders}
        numberFilter={filters.number}
        practiceMode={practice.active}
        showSettings={showSettings}
        onCaseChange={(cases: Case[]) => handleFiltersChange({ ...filters, cases })}
        onGenderChange={(genders: Gender[]) => handleFiltersChange({ ...filters, genders })}
        onNumberChange={(number: Number | 'All') => handleFiltersChange({ ...filters, number })}
        onTogglePractice={() =>
          practice.toggle(allDeclensionCards.filter((c) => matchesDeclensionFilters(c, filters)))
        }
        onToggleSettings={() => setShowSettings(!showSettings)}
        onAddCard={user ? handleOpenCreateModal : undefined}
        onStartListening={() => {
          const queue = buildDeclensionListeningQueue({
            cards: allDeclensionCards,
            reviewStore,
            ordering: listeningSettings.ordering,
            filters,
          });
          if (queue.length === 0) {
            showSnackbar('No declensions with audio for the current filters.', 'info');
            return;
          }
          startListening(queue, {
            meta: { feature: 'declension', title: 'Declension' },
          });
          navigate('/listen/play');
        }}
      />

      {showSettings && !practice.active && (
        <SettingsPanel
          newCardsPerDay={settings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
        />
      )}

      <ReviewMainContent>
        <SessionStatusLine session={session} unitLabel="cards" />

        <ReviewStage
          session={session}
          practiceEmptyMessage="No cards match your filters"
          renderPractice={(card) => (
            <DeclensionFlashcard
              key={`practice-${card.id}-${practice.index}`}
              card={card}
              practiceMode
              canEdit={card.isCustom || isAdmin}
              onNext={practice.next}
              onEdit={() => openEditModal(card)}
              onDelete={() => deleteCard(card)}
              onUpdateTranslation={translationHandler(card)}
            />
          )}
          renderHistory={(card) => (
            <DeclensionFlashcard
              key={`history-${card.id}`}
              card={card}
              isViewingHistory
              canGoBack={canGoBack}
              canEdit={card.isCustom || isAdmin}
              reassessIntervals={session.reassessIntervals}
              onGoBack={goBack}
              onContinue={goForward}
              onReassess={session.reassess}
              onEdit={() => openEditModal(card)}
              onDelete={() => {
                if (deleteCard(card)) goForward();
              }}
              onUpdateTranslation={translationHandler(card)}
            />
          )}
          renderFinished={() => (
            <FinishedState currentFeature="declension" {...session.finishedStateProps} />
          )}
          renderCurrent={({ card }) => (
            <DeclensionFlashcard
              key={`${card.id}-${session.ratingCounter}`}
              card={card}
              intervals={session.intervals}
              canGoBack={canGoBack}
              canEdit={card.isCustom || isAdmin}
              onRate={session.rate}
              onGoBack={goBack}
              onEdit={() => openEditModal(card)}
              onDelete={() => deleteCard(card)}
              onUpdateTranslation={translationHandler(card)}
            />
          )}
        />
      </ReviewMainContent>

      <EditDeclensionModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCard(null);
          setIsCreatingNew(false);
        }}
        onSave={handleSaveCard}
        onDelete={
          editingCard && !isCreatingNew && (editingCard.isCustom || isAdmin)
            ? handleDeleteEditingCard
            : undefined
        }
        card={editingCard}
        isCreating={isCreatingNew}
        onAudioUpdated={(audioUrl) => {
          if (editingCard) replaceCard({ ...editingCard, audioUrl });
        }}
      />
    </>
  );
}
