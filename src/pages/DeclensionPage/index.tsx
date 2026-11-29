import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, styled } from '@mui/material';
import { DeclensionFlashcard } from './components/DeclensionFlashcard';
import { DeclensionFilterControls } from './components/DeclensionFilterControls';
import { SettingsPanel } from '../../components/SettingsPanel';
import { ReviewStage } from '../../components/ReviewStage';
import { EmptyState } from '../../components/EmptyState';
import { ReviewMainContent } from '../../components/ReviewLayout';
import { EditDeclensionModal } from '../../components/EditDeclensionModal';
import type { DeclensionCard, DeclensionFilters } from '../../types';
import {
  updateDeclensionCard,
  updateDeclensionCardTranslation,
  deleteDeclensionCard,
} from '../../lib/storage/systemDeclension';
import { customDeclensionStorage } from '../../lib/storage/customDeclension';
import { writeBuiltIn } from '../../lib/storage/writeBuiltIn';
import { createCustomItem } from '../../types/customItems';
import { itemsMatching } from '../../lib/reviewSession/scheduler';
import { declensionDeck } from '../../lib/reviewSession/reviewDecks';
import { useAuthContext } from '../../contexts/AuthContext';
import { useDeclension, useReviewDataLoading } from '../../hooks/useReviewData';
import { useCustomItemWrites } from '../../hooks/useCustomItemWrites';
import { useSaveError } from '../../hooks/useSaveError';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useDeckReview } from '../../hooks/useDeckReview';
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
  const showSaveError = useSaveError();
  const { confirm, confirmDialog } = useConfirm();
  const loading = useReviewDataLoading();
  const { progress, cards, systemCards, setCustomCards, setSystemCards } = useDeclension();
  const customWrites = useCustomItemWrites(customDeclensionStorage, setCustomCards);

  const { filters: userFilters, filtersLoading, updateDeclensionFilters } = useUserFilters();
  const filters = userFilters.declension;

  const { start: startListening, settings: listeningSettings } = useListening();

  const [showEditModal, setShowEditModal] = useState(false);
  // Null while the modal creates a new card.
  const [editingCard, setEditingCard] = useState<DeclensionCard | null>(null);

  const review = useDeckReview(progress, 'all', {
    deck: declensionDeck,
    items: cards,
    filters,
    ready: !loading && !filtersLoading && cards.length > 0,
    getAudioUrls: (card) => [card.audioUrl],
    confirm,
    resetMessage: 'Are you sure? This will erase all your progress and cannot be undone.',
  });
  const { session } = review;
  const { practice } = session;

  const handleFiltersChange = (next: DeclensionFilters) => {
    updateDeclensionFilters(next);
    session.restart(next);
    if (practice.active) practice.reshuffle(itemsMatching(declensionDeck, cards, next));
  };

  const handleListen = () => {
    const queue = buildDeclensionListeningQueue({
      cards,
      reviewStore: review.store,
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
  };

  const openEditModal = (card: DeclensionCard | null) => {
    setEditingCard(card);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingCard(null);
  };

  const replaceCard = (updatedCard: DeclensionCard) =>
    session.updateCards(
      (c) => c.id === updatedCard.id,
      () => updatedCard
    );

  /** Saves a change to one card: the learner's own, or (for an admin) a built-in one. */
  const saveCard = (
    card: DeclensionCard,
    changes: Partial<Omit<DeclensionCard, 'id' | 'isCustom'>>,
    saveBuiltIn: () => Promise<void>
  ) =>
    card.isCustom
      ? customWrites.update(card.id as string, changes)
      : writeBuiltIn(
          systemCards,
          setSystemCards,
          systemCards.map((c) => (c.id === card.id ? { ...c, ...changes } : c)),
          saveBuiltIn
        );

  const handleSaveCard = (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
    if (!editingCard) {
      const saved = customWrites.add(createCustomItem(cardData));
      session.restartAfterRender();
      return saved;
    }
    replaceCard({ ...editingCard, ...cardData });
    return saveCard(editingCard, cardData, () =>
      updateDeclensionCard(editingCard.id as number, cardData)
    );
  };

  const removeCard = (card: DeclensionCard) => {
    session.removeCards((c) => c.id === card.id);
    const removed = card.isCustom
      ? customWrites.remove(card.id as string)
      : writeBuiltIn(
          systemCards,
          setSystemCards,
          systemCards.filter((c) => c.id !== card.id),
          () => deleteDeclensionCard(card.id as number)
        );
    void removed.catch(showSaveError);
  };

  const deleteCard = async (card: DeclensionCard): Promise<boolean> => {
    if (!card.isCustom && !isAdmin) return false;
    const confirmed = await confirm({
      title: 'Delete Card',
      message: card.isCustom
        ? 'Are you sure you want to delete this custom card?'
        : 'Are you sure you want to delete this system declension card? This will affect all users.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return false;
    removeCard(card);
    return true;
  };

  const updateTranslation = (cardId: DeclensionCard['id'], word: string, translation: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const translations = { ...card.translations, [word]: translation };
    replaceCard({ ...card, translations });
    void saveCard(card, { translations }, () =>
      updateDeclensionCardTranslation(cardId as number, word, translation)
    ).catch(showSaveError);
  };

  // No session is built without cards; the stage's fallback says so instead of a spinner.
  if (loading || filtersLoading || (cards.length > 0 && !session.isBuilt)) {
    return (
      <LoadingContainer>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </LoadingContainer>
    );
  }

  return (
    <>
      <DeclensionFilterControls
        filters={filters}
        practiceMode={practice.active}
        showSettings={review.showSettings}
        onChange={handleFiltersChange}
        onTogglePractice={session.togglePractice}
        onToggleSettings={review.toggleSettings}
        onAddCard={user ? () => openEditModal(null) : undefined}
        onStartListening={handleListen}
      />

      {review.showSettings && !practice.active && (
        <SettingsPanel {...review.settingsPanel} user={user} />
      )}

      <ReviewMainContent>
        <ReviewStage
          session={session}
          feature="declension"
          unitLabel="cards"
          practiceEmptyMessage="No cards match your filters"
          renderCard={(card, controls) => (
            <DeclensionFlashcard
              {...controls}
              card={card}
              canEdit={card.isCustom || isAdmin}
              onEdit={() => openEditModal(card)}
              onDelete={async () => {
                if (await deleteCard(card)) controls.onContinue?.();
              }}
              onUpdateTranslation={
                isAdmin
                  ? (word, translation) => updateTranslation(card.id, word, translation)
                  : undefined
              }
            />
          )}
          fallback={cards.length === 0 && <EmptyState message="No declension cards available." />}
        />
      </ReviewMainContent>

      <EditDeclensionModal
        open={showEditModal}
        onClose={closeEditModal}
        onSave={handleSaveCard}
        onDelete={
          editingCard && (editingCard.isCustom || isAdmin)
            ? () => {
                removeCard(editingCard);
                closeEditModal();
              }
            : undefined
        }
        card={editingCard}
        onAudioUpdated={(audioUrl) => {
          if (editingCard) replaceCard({ ...editingCard, audioUrl });
        }}
      />
      {confirmDialog}
    </>
  );
}
