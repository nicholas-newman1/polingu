import { useState, memo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useSentences } from '../../hooks/useReviewData';
import { updateSentence, deleteSentence } from '../../lib/storage/systemSentences';
import { EditSentenceModal } from '../../components/EditSentenceModal';
import type { Sentence } from '../../types/sentences';
import { AdminItemList } from './AdminItemList';
import { useAdminItems } from './useAdminItems';

const getSearchFields = (sentence: Sentence) => [sentence.polish, sentence.english];

function SentenceRowContent({ sentence }: { sentence: Sentence }) {
  return (
    <>
      <Typography variant="body2" fontWeight={500}>
        {sentence.polish}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {sentence.english}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        <Chip label={sentence.level} size="small" color="primary" variant="outlined" />
        {sentence.tags.map((tag) => (
          <Chip key={tag} label={tag} size="small" variant="outlined" />
        ))}
      </Box>
    </>
  );
}

export const SentencesTab = memo(function SentencesTab() {
  const { systemSentences, setSystemSentences } = useSentences();
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const { deleteItem, patchItem } = useAdminItems<Sentence, Partial<Omit<Sentence, 'id'>>>({
    items: systemSentences,
    setItems: setSystemSentences,
    update: (sentence, patch) => updateSentence(sentence.id, patch),
    remove: (sentence) => deleteSentence(sentence.id),
    label: 'Sentence',
  });

  return (
    <>
      <AdminItemList
        items={systemSentences}
        noun="sentences"
        searchPlaceholder="Search sentences..."
        estimateSize={96}
        getId={(sentence) => sentence.id}
        getSearchFields={getSearchFields}
        getAudioUrl={(sentence) => sentence.audioUrl}
        renderContent={(sentence) => <SentenceRowContent sentence={sentence} />}
        onSelect={setEditingSentence}
        onDelete={(sentence) => {
          if (window.confirm('Delete this sentence?')) void deleteItem(sentence);
        }}
      />

      <EditSentenceModal
        open={!!editingSentence}
        onClose={() => setEditingSentence(null)}
        onSave={(data) => patchItem(editingSentence, data)}
        sentence={editingSentence}
        onAudioUpdated={(audioUrl) =>
          patchItem(editingSentence, { audioUrl }, { error: 'Failed to update audio' })
        }
      />
    </>
  );
});
