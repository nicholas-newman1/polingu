import { useState, memo } from 'react';
import { Box, Chip } from '@mui/material';
import { useConjugation } from '../../hooks/useReviewData';
import { updateVerb, deleteVerb } from '../../lib/storage/systemVerbs';
import { EditVerbModal } from '../../components/EditVerbModal';
import type { Verb } from '../../types/conjugation';
import { AdminItemList } from './AdminItemList';
import { useAdminItems } from './useAdminItems';
import { InlineTranslation } from './InlineTranslation';

const getSearchFields = (verb: Verb) => [verb.infinitive, verb.infinitiveEn];

const tenseCount = (verb: Verb) =>
  Object.keys(verb.conjugations).filter(
    (k) => verb.conjugations[k as keyof typeof verb.conjugations]
  ).length;

function VerbRowContent({ verb }: { verb: Verb }) {
  return (
    <>
      <InlineTranslation primary={verb.infinitive} secondary={verb.infinitiveEn} />
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        <Chip label={verb.aspect} size="small" variant="outlined" />
        <Chip label={verb.verbClass} size="small" variant="outlined" />
        {verb.isIrregular && (
          <Chip label="irregular" size="small" color="warning" variant="outlined" />
        )}
        {verb.isReflexive && <Chip label="się" size="small" variant="outlined" />}
        <Chip
          label={`${tenseCount(verb)} tenses`}
          size="small"
          color="default"
          variant="outlined"
        />
      </Box>
    </>
  );
}

export const VerbsTab = memo(function VerbsTab() {
  const { verbs, setVerbs } = useConjugation();
  const [editingVerb, setEditingVerb] = useState<Verb | null>(null);
  const { deleteItem, patchItem } = useAdminItems<Verb, Partial<Omit<Verb, 'id'>>>({
    items: verbs,
    setItems: setVerbs,
    update: (verb, patch) => updateVerb(verb.id, patch),
    remove: (verb) => deleteVerb(verb.id),
    label: 'Verb',
  });

  const handleModalDelete = () => {
    if (!editingVerb) return;
    const verb = editingVerb;
    setEditingVerb(null);
    void deleteItem(verb);
  };

  return (
    <>
      <AdminItemList
        items={verbs}
        noun="verbs"
        searchPlaceholder="Search verbs..."
        estimateSize={72}
        getId={(verb) => verb.id}
        getSearchFields={getSearchFields}
        getAudioUrl={(verb) => verb.infinitiveAudioUrl}
        renderContent={(verb) => <VerbRowContent verb={verb} />}
        onSelect={setEditingVerb}
        onDelete={(verb) => {
          if (
            window.confirm(
              `Delete "${verb.infinitive}" and all its conjugation forms? This affects all users.`
            )
          ) {
            void deleteItem(verb);
          }
        }}
      />

      <EditVerbModal
        open={!!editingVerb}
        onClose={() => setEditingVerb(null)}
        onSave={(updates) => patchItem(editingVerb, updates)}
        onDelete={handleModalDelete}
        verb={editingVerb}
        onAudioUpdated={(audioUrl) =>
          patchItem(
            editingVerb,
            { infinitiveAudioUrl: audioUrl },
            { error: 'Failed to update audio' }
          )
        }
      />
    </>
  );
});
