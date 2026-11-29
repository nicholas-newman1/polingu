import { Chip } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { customVocabularyStorage } from '../lib/storage/customVocabulary';
import { findWordWithSamePolish } from '../lib/utils/findDuplicateCustomVocabularyPolish';
import capitalize from '../lib/utils/capitalize';
import {
  PARTS_OF_SPEECH,
  NOUN_GENDERS,
  type CustomVocabularyWord,
  type NounGender,
} from '../types/vocabulary';
import { createCustomItem } from '../types/customItems';
import { useReprioritizeVocabularyWord } from '../hooks/useReprioritizeVocabularyWord';
import { useReviewDataLoading, useVocabulary } from '../hooks/useReviewData';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  CustomItemPage,
  useCustomItemPage,
  MetaChip,
  PrimaryCell,
  SecondaryCell,
  byPolish,
  byEnglish,
  type CustomItemColumn,
  type CustomItemFilter,
} from '../components/CustomItemPage';

type WordFormData = Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>;

const GenderChip = styled(Chip)<{ $gender: NounGender }>(({ theme, $gender }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.gender[$gender].main, 0.12),
  color: theme.palette.gender[$gender].main,
}));

const COLUMNS: CustomItemColumn<CustomVocabularyWord>[] = [
  {
    label: 'Polish',
    compare: byPolish,
    render: (word) => <PrimaryCell>{word.polish}</PrimaryCell>,
  },
  { label: 'English', compare: byEnglish, render: (word) => word.english },
  {
    label: 'Type',
    compare: (a, b) => (a.partOfSpeech || '').localeCompare(b.partOfSpeech || ''),
    render: (word) => word.partOfSpeech && <MetaChip label={word.partOfSpeech} size="small" />,
  },
  {
    label: 'Gender',
    compare: (a, b) => (a.gender || '').localeCompare(b.gender || ''),
    render: (word) =>
      word.gender && <GenderChip $gender={word.gender} label={word.gender} size="small" />,
  },
  {
    label: 'Notes',
    render: (word) => word.notes && <SecondaryCell title={word.notes}>{word.notes}</SecondaryCell>,
  },
];

const FILTERS: CustomItemFilter<CustomVocabularyWord>[] = [
  {
    label: 'Part of Speech',
    options: PARTS_OF_SPEECH,
    value: (word) => word.partOfSpeech,
    format: capitalize,
  },
  { label: 'Gender', options: NOUN_GENDERS, value: (word) => word.gender, format: capitalize },
];

export function CustomVocabularyPage() {
  const loading = useReviewDataLoading();
  const { customWords, setCustomWords } = useVocabulary();
  const { showSnackbar } = useSnackbar();
  const { canReprioritize, reprioritize, reportDuplicatePolish } = useReprioritizeVocabularyWord();
  const page = useCustomItemPage({
    items: customWords,
    setItems: setCustomWords,
    loading,
    storage: customVocabularyStorage,
    noun: 'word',
  });
  const { editing } = page;

  const handleSave = (wordData: WordFormData) => {
    if (!editing) {
      if (reportDuplicatePolish(customWords, wordData.polish)) return false;
      return page.add(createCustomItem(wordData));
    }
    if (findWordWithSamePolish(customWords, wordData.polish, editing.id)) {
      showSnackbar('This Polish word is already in your custom vocabulary.', 'error');
      return false;
    }
    return page.update(editing.id, wordData);
  };

  return (
    <CustomItemPage
      title="My Vocabulary"
      subtitle="Your personal vocabulary collection"
      emptyTitle="No custom words yet"
      emptyDescription="Add your own vocabulary words to drill alongside the standard word list."
      page={page}
      columns={COLUMNS}
      filters={FILTERS}
      searchFields={(word) => [word.polish, word.english, word.notes]}
      audio={{ type: 'custom-vocabulary', text: (word) => word.polish }}
      canReprioritize={canReprioritize}
      onReprioritize={reprioritize}
    >
      <AddVocabularyModal
        open={page.modalOpen}
        onClose={page.closeModal}
        onSave={handleSave}
        editWord={editing}
      />
    </CustomItemPage>
  );
}
