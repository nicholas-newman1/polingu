import { useState, useMemo, useCallback } from 'react';
import { Typography, Chip, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { EditDeclensionModal } from '../components/EditDeclensionModal';
import { InlineAudioRegenerator } from '../components/AudioRegenerator';
import { saveCustomDeclension, subscribeCustomDeclension } from '../lib/storage/customDeclension';
import { findCustomDeclensionDuplicate } from '../lib/utils/findDuplicateCustomDeclension';
import reprioritizeDeclensionCard, {
  canReprioritizeDeclensionCard,
} from '../lib/storage/reprioritizeDeclensionCard';
import type { CustomDeclensionCard, Case, Gender, Number, DeclensionCard } from '../types';
import { createCustomItem } from '../types/customItems';
import { useAuthContext } from '../hooks/useAuthContext';
import { useCustomCollection } from '../hooks/useCustomCollection';
import { useDeclension } from '../hooks/useReviewData';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import {
  PageContainer,
  FiltersRow,
  StyledTableContainer,
  TruncatedCell,
  MetaChip,
  CustomItemPageHeader,
  CustomItemEmptyState,
  CustomItemLoadingState,
  CustomItemActions,
  CustomItemSearchField,
  FilterSelectField,
  SortableHeaderCell,
  formatDate,
  sortItems,
  useSortState,
  FilterResultCount,
  CustomItemTableHead,
  byCreatedAt,
} from '../components/CustomItemPage';

type SortField = 'front' | 'declined' | 'case' | 'gender' | 'number' | 'createdAt';

const COMPARATORS: Record<SortField, (a: CustomDeclensionCard, b: CustomDeclensionCard) => number> =
  {
    front: (a, b) => a.front.localeCompare(b.front, 'pl'),
    declined: (a, b) => a.declined.localeCompare(b.declined, 'pl'),
    case: (a, b) => a.case.localeCompare(b.case),
    gender: (a, b) => a.gender.localeCompare(b.gender),
    number: (a, b) => a.number.localeCompare(b.number),
    createdAt: byCreatedAt,
  };

const GenderChip = styled(Chip)<{
  $gender: 'Masculine' | 'Feminine' | 'Neuter' | 'Pronoun';
}>(({ theme, $gender }) => {
  const genderKey =
    $gender === 'Pronoun'
      ? 'neuter'
      : ($gender.toLowerCase() as 'masculine' | 'feminine' | 'neuter');
  return {
    height: 24,
    fontSize: '0.75rem',
    fontWeight: 500,
    backgroundColor: alpha(theme.palette.gender[genderKey].main, 0.12),
    color: theme.palette.gender[genderKey].main,
  };
});

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

export function CustomDeclensionPage() {
  const { isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const { declensionReviewStore, updateDeclensionReviewStore } = useDeclension();
  const {
    items: customCardsBase,
    setItems: setCustomCardsBase,
    isLoading,
  } = useCustomCollection(subscribeCustomDeclension);
  const [customCards, applyOptimisticCustomCards] = useOptimistic(customCardsBase, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomDeclensionCard | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseFilter, setCaseFilter] = useState<Case | ''>('');
  const [genderFilter, setGenderFilter] = useState<Gender | ''>('');
  const [numberFilter, setNumberFilter] = useState<Number | ''>('');
  const sort = useSortState<SortField>('createdAt');

  const handleReprioritize = useCallback(
    (cardId: string) => {
      const next = reprioritizeDeclensionCard(declensionReviewStore, cardId);
      if (next === declensionReviewStore) return;
      void updateDeclensionReviewStore(next);
      showSnackbar('Card queued for review again.', 'success');
    },
    [declensionReviewStore, updateDeclensionReviewStore, showSnackbar]
  );

  const handleAddCard = (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
    const duplicate = findCustomDeclensionDuplicate(customCards, cardData);
    if (duplicate) {
      const reviewable = canReprioritizeDeclensionCard(declensionReviewStore, duplicate.id);
      showSnackbar(
        'This declension card is already in your collection.',
        'error',
        reviewable
          ? {
              action: {
                label: 'Review again',
                onClick: () => handleReprioritize(duplicate.id),
              },
            }
          : undefined
      );
      return false;
    }

    const newCustomCards: CustomDeclensionCard[] = [createCustomItem(cardData), ...customCardsBase];

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setCustomCardsBase(newCustomCards);
    });
  };

  const handleEditCard = (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
    if (!editingCard) return;
    if (findCustomDeclensionDuplicate(customCards, cardData, editingCard.id)) {
      showSnackbar('This declension card is already in your collection.', 'error');
      return false;
    }
    const newCustomCards = customCards.map((c) =>
      c.id === editingCard.id ? { ...c, ...cardData } : c
    );
    setEditingCard(null);

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setCustomCardsBase(newCustomCards);
    });
  };

  const handleDeleteCard = (cardId: string) => {
    if (!window.confirm('Are you sure you want to delete this card?')) {
      return;
    }

    const newCustomCards = customCards.filter((c) => c.id !== cardId);

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setCustomCardsBase(newCustomCards);
    });
  };

  const handleOpenEditModal = (card: CustomDeclensionCard) => {
    setEditingCard(card);
    setShowAddModal(true);
  };

  const handleAudioSaved = useCallback(
    (cardId: string, audioUrl: string) => {
      setCustomCardsBase((prev) => prev.map((c) => (c.id === cardId ? { ...c, audioUrl } : c)));
    },
    [setCustomCardsBase]
  );

  const { sortField, sortDirection } = sort;
  const filteredAndSortedCards = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = customCards.filter(
      (card) =>
        (!query ||
          card.front.toLowerCase().includes(query) ||
          card.back.toLowerCase().includes(query) ||
          card.declined.toLowerCase().includes(query) ||
          card.hint?.toLowerCase().includes(query)) &&
        (!caseFilter || card.case === caseFilter) &&
        (!genderFilter || card.gender === genderFilter) &&
        (!numberFilter || card.number === numberFilter)
    );
    return sortItems(filtered, COMPARATORS, { sortField, sortDirection });
  }, [customCards, searchQuery, caseFilter, genderFilter, numberFilter, sortField, sortDirection]);

  if (isLoading) {
    return <CustomItemLoadingState />;
  }

  return (
    <PageContainer>
      <CustomItemPageHeader
        title="My Declensions"
        subtitle="Your personal declension card collection"
        count={customCards.length}
        addLabel="Add Card"
        onAdd={() => setShowAddModal(true)}
      />

      {customCards.length === 0 ? (
        <CustomItemEmptyState
          title="No custom declension cards yet"
          description="Add your own declension cards to drill alongside the standard card set."
          addLabel="Add Your First Card"
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <>
          <FiltersRow>
            <CustomItemSearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search cards..."
            />
            <FilterSelectField
              label="Case"
              value={caseFilter}
              options={CASES}
              onChange={setCaseFilter}
            />
            <FilterSelectField
              label="Gender"
              value={genderFilter}
              options={GENDERS}
              onChange={setGenderFilter}
            />
            <FilterSelectField
              label="Number"
              value={numberFilter}
              options={NUMBERS}
              onChange={setNumberFilter}
            />
            <FilterResultCount
              visible={Boolean(searchQuery || caseFilter || genderFilter || numberFilter)}
              shown={filteredAndSortedCards.length}
              total={customCards.length}
              noun="cards"
            />
          </FiltersRow>

          <StyledTableContainer elevation={0}>
            <Table>
              <CustomItemTableHead isAdmin={isAdmin}>
                <SortableHeaderCell field="front" label="Question" sort={sort} />
                <SortableHeaderCell field="declined" label="Answer" sort={sort} />
                <SortableHeaderCell field="case" label="Case" sort={sort} />
                <SortableHeaderCell field="gender" label="Gender" sort={sort} />
                <SortableHeaderCell field="number" label="Number" sort={sort} />
                <SortableHeaderCell field="createdAt" label="Added" sort={sort} />
              </CustomItemTableHead>
              <TableBody>
                {filteredAndSortedCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <CustomItemActions
                        onEdit={() => handleOpenEditModal(card)}
                        onDelete={() => handleDeleteCard(card.id)}
                        editLabel="edit card"
                        deleteLabel="delete card"
                        onReprioritize={() => handleReprioritize(card.id)}
                        canReprioritize={canReprioritizeDeclensionCard(
                          declensionReviewStore,
                          card.id
                        )}
                        reprioritizeLabel="review card again"
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <InlineAudioRegenerator
                          text={card.back}
                          type="custom-declension"
                          id={card.id}
                          currentAudioUrl={card.audioUrl}
                          onAudioSaved={(audioUrl) => handleAudioSaved(card.id, audioUrl)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <TruncatedCell title={card.front}>{card.front}</TruncatedCell>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={500}>{card.declined}</Typography>
                    </TableCell>
                    <TableCell>
                      <MetaChip label={card.case} size="small" />
                    </TableCell>
                    <TableCell>
                      <GenderChip $gender={card.gender} label={card.gender} size="small" />
                    </TableCell>
                    <TableCell>
                      <MetaChip label={card.number} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(card.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedCards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No cards match your filters</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </>
      )}

      <EditDeclensionModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingCard(null);
        }}
        onSave={editingCard ? handleEditCard : handleAddCard}
        onDelete={
          editingCard
            ? () => {
                handleDeleteCard(editingCard.id);
                setShowAddModal(false);
                setEditingCard(null);
              }
            : undefined
        }
        card={editingCard}
        isCreating={!editingCard}
      />
    </PageContainer>
  );
}
