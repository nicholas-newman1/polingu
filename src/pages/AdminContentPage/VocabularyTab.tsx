import { useState, memo } from 'react';
import { Box, Chip } from '@mui/material';
import { useVocabulary } from '../../hooks/useReviewData';
import {
  updateSystemVocabularyWord,
  deleteSystemVocabularyWord,
} from '../../lib/storage/systemVocabulary';
import { AddVocabularyModal } from '../../components/AddVocabularyModal';
import type { VocabularyWord, CustomVocabularyWord } from '../../types/vocabulary';
import { AdminItemList } from './AdminItemList';
import { useAdminItems } from './useAdminItems';
import { InlineTranslation } from './InlineTranslation';

const getSearchFields = (word: VocabularyWord) => [word.polish, word.english];

function WordRowContent({ word }: { word: VocabularyWord }) {
  return (
    <>
      <InlineTranslation primary={word.polish} secondary={word.english} />
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        {word.partOfSpeech && <Chip label={word.partOfSpeech} size="small" variant="outlined" />}
        {word.gender && <Chip label={word.gender} size="small" variant="outlined" />}
      </Box>
    </>
  );
}

export const VocabularyTab = memo(function VocabularyTab() {
  const { systemWords, setSystemWords } = useVocabulary();
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const { deleteItem, patchItem } = useAdminItems<
    VocabularyWord,
    Partial<Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>>
  >({
    items: systemWords,
    setItems: setSystemWords,
    update: (word, patch) => updateSystemVocabularyWord(word.id as number, patch),
    remove: (word) => deleteSystemVocabularyWord(word.id as number),
    label: 'Word',
  });

  return (
    <>
      <AdminItemList
        items={systemWords}
        noun="words"
        searchPlaceholder="Search vocabulary..."
        estimateSize={72}
        getId={(word) => word.id}
        getSearchFields={getSearchFields}
        getAudioUrl={(word) => word.audioUrl}
        renderContent={(word) => <WordRowContent word={word} />}
        onSelect={setEditingWord}
        onDelete={(word) => {
          if (window.confirm(`Delete "${word.polish}"?`)) void deleteItem(word);
        }}
      />

      <AddVocabularyModal
        open={!!editingWord}
        onClose={() => setEditingWord(null)}
        onSave={(data) => patchItem(editingWord, data)}
        editWord={editingWord}
        onAudioUpdated={(audioUrl) =>
          patchItem(editingWord, { audioUrl }, { error: 'Failed to update audio' })
        }
      />
    </>
  );
});
