import { Chip } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { EditSentenceModal } from '../components/EditSentenceModal';
import { customSentenceStorage } from '../lib/storage/customSentences';
import { findCustomSentenceWithSamePolish } from '../lib/utils/findDuplicateCustomSentence';
import type { CustomSentence, CEFRLevel, Sentence } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { createCustomItem } from '../types/customItems';
import { useReprioritizeSentence } from '../hooks/useReprioritizeSentence';
import { useReviewDataLoading, useSentences } from '../hooks/useReviewData';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  CustomItemPage,
  useCustomItemPage,
  TruncatedCell,
  byPolish,
  byEnglish,
  type CustomItemColumn,
  type CustomItemFilter,
} from '../components/CustomItemPage';

const LevelChip = styled(Chip)<{ $level: CEFRLevel }>(({ theme, $level }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.levels[$level], 0.12),
  color: theme.palette.levels[$level],
}));

const COLUMNS: CustomItemColumn<CustomSentence>[] = [
  {
    label: 'Polish',
    compare: byPolish,
    render: (sentence) => <TruncatedCell title={sentence.polish}>{sentence.polish}</TruncatedCell>,
  },
  {
    label: 'English',
    compare: byEnglish,
    render: (sentence) => (
      <TruncatedCell title={sentence.english}>{sentence.english}</TruncatedCell>
    ),
  },
  {
    label: 'Level',
    compare: (a, b) => a.level.localeCompare(b.level),
    render: (sentence) => <LevelChip $level={sentence.level} label={sentence.level} size="small" />,
  },
];

const FILTERS: CustomItemFilter<CustomSentence>[] = [
  { label: 'Level', options: ALL_LEVELS, value: (sentence) => sentence.level },
];

export function CustomSentencesPage() {
  const loading = useReviewDataLoading();
  const { customSentences, setCustomSentences } = useSentences();
  const { showSnackbar } = useSnackbar();
  const { canReprioritize, reprioritize, showDuplicateError } = useReprioritizeSentence();
  const page = useCustomItemPage({
    items: customSentences,
    setItems: setCustomSentences,
    loading,
    storage: customSentenceStorage,
    noun: 'sentence',
  });
  const { editing } = page;

  const handleSave = (sentenceData: Omit<Sentence, 'id'>) => {
    if (!editing) {
      const duplicate = findCustomSentenceWithSamePolish(customSentences, sentenceData.polish);
      if (duplicate) {
        showDuplicateError(duplicate.id);
        return false;
      }
      return page.add(createCustomItem(sentenceData));
    }
    if (findCustomSentenceWithSamePolish(customSentences, sentenceData.polish, editing.id)) {
      showSnackbar('This sentence is already in your collection.', 'error');
      return false;
    }
    const { polish, english, level, tags, translations } = sentenceData;
    return page.update(editing.id, { polish, english, level, tags, translations });
  };

  return (
    <CustomItemPage
      title="My Sentences"
      subtitle="Your personal sentence collection"
      emptyTitle="No custom sentences yet"
      emptyDescription="Add your own sentences to drill alongside the standard sentence set. Custom sentences are prioritized first!"
      page={page}
      columns={COLUMNS}
      filters={FILTERS}
      searchFields={(sentence) => [sentence.polish, sentence.english]}
      audio={{ type: 'custom-sentence', text: (sentence) => sentence.polish }}
      canReprioritize={canReprioritize}
      onReprioritize={reprioritize}
    >
      <EditSentenceModal
        open={page.modalOpen}
        onClose={page.closeModal}
        onSave={handleSave}
        sentence={editing}
      />
    </CustomItemPage>
  );
}
