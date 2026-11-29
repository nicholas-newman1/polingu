import { Typography, Chip } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { EditDeclensionModal } from '../components/EditDeclensionModal';
import { customDeclensionStorage } from '../lib/storage/customDeclension';
import { findCustomDeclensionDuplicate } from '../lib/utils/findDuplicateCustomDeclension';
import type { CustomDeclensionCard, DeclensionCard, Gender } from '../types';
import { CASES, GENDERS, NUMBERS } from '../constants';
import { createCustomItem } from '../types/customItems';
import { useDeclension, useReviewDataLoading } from '../hooks/useReviewData';
import { useReprioritize } from '../hooks/useReprioritize';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  CustomItemPage,
  useCustomItemPage,
  TruncatedCell,
  MetaChip,
  type CustomItemColumn,
  type CustomItemFilter,
} from '../components/CustomItemPage';

type CardFormData = Omit<DeclensionCard, 'id' | 'isCustom'>;

const DUPLICATE = 'This declension card is already in your collection.';

const GenderChip = styled(Chip)<{ $gender: Gender }>(({ theme, $gender }) => {
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

const COLUMNS: CustomItemColumn<CustomDeclensionCard>[] = [
  {
    label: 'Question',
    compare: (a, b) => a.front.localeCompare(b.front, 'pl'),
    render: (card) => <TruncatedCell title={card.front}>{card.front}</TruncatedCell>,
  },
  {
    label: 'Answer',
    compare: (a, b) => a.declined.localeCompare(b.declined, 'pl'),
    render: (card) => <Typography fontWeight={500}>{card.declined}</Typography>,
  },
  {
    label: 'Case',
    compare: (a, b) => a.case.localeCompare(b.case),
    render: (card) => <MetaChip label={card.case} size="small" />,
  },
  {
    label: 'Gender',
    compare: (a, b) => a.gender.localeCompare(b.gender),
    render: (card) => <GenderChip $gender={card.gender} label={card.gender} size="small" />,
  },
  {
    label: 'Number',
    compare: (a, b) => a.number.localeCompare(b.number),
    render: (card) => <MetaChip label={card.number} size="small" />,
  },
];

const FILTERS: CustomItemFilter<CustomDeclensionCard>[] = [
  { label: 'Case', options: CASES, value: (card) => card.case },
  { label: 'Gender', options: GENDERS, value: (card) => card.gender },
  { label: 'Number', options: NUMBERS, value: (card) => card.number },
];

export function CustomDeclensionPage() {
  const loading = useReviewDataLoading();
  const { progress, customCards, setCustomCards } = useDeclension();
  const { showSnackbar } = useSnackbar();
  const { canReprioritize, reprioritize, showDuplicateError } = useReprioritize({
    progress,
    queuedMessage: 'Card queued for review again.',
    duplicateMessage: DUPLICATE,
  });
  const page = useCustomItemPage({
    items: customCards,
    setItems: setCustomCards,
    loading,
    storage: customDeclensionStorage,
    noun: 'card',
  });
  const { editing } = page;

  const handleSave = (cardData: CardFormData) => {
    const duplicate = findCustomDeclensionDuplicate(customCards, cardData, editing?.id);
    if (duplicate) {
      if (editing) showSnackbar(DUPLICATE, 'error');
      else showDuplicateError(duplicate.id);
      return false;
    }
    return editing ? page.update(editing.id, cardData) : page.add(createCustomItem(cardData));
  };

  const handleDeleteEditing = () => {
    if (!editing) return;
    // The dialog has already asked for confirmation.
    page.deleteItem(editing.id);
    page.closeModal();
  };

  return (
    <CustomItemPage
      title="My Declensions"
      subtitle="Your personal declension card collection"
      emptyTitle="No custom declension cards yet"
      emptyDescription="Add your own declension cards to drill alongside the standard card set."
      page={page}
      columns={COLUMNS}
      filters={FILTERS}
      searchFields={(card) => [card.front, card.back, card.declined, card.hint]}
      audio={{ type: 'custom-declension', text: (card) => card.back }}
      canReprioritize={canReprioritize}
      onReprioritize={reprioritize}
    >
      <EditDeclensionModal
        open={page.modalOpen}
        onClose={page.closeModal}
        onSave={handleSave}
        onDelete={editing ? handleDeleteEditing : undefined}
        card={editing}
      />
    </CustomItemPage>
  );
}
