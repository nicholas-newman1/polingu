import { useState, memo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useDeclension } from '../../hooks/useReviewData';
import { useConfirm } from '../../hooks/useConfirm';
import { updateDeclensionCard, deleteDeclensionCard } from '../../lib/storage/systemDeclension';
import { EditDeclensionModal } from '../../components/EditDeclensionModal';
import type { DeclensionCard } from '../../types';
import { AdminItemList } from './AdminItemList';
import { useAdminItems } from './useAdminItems';

const getSearchFields = (card: DeclensionCard) => [card.front, card.back, card.declined];

function DeclensionRowContent({ card }: { card: DeclensionCard }) {
  return (
    <>
      <Typography variant="body2" fontWeight={500} noWrap>
        {card.declined}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap>
        {card.front}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        <Chip label={card.case} size="small" variant="outlined" />
        <Chip label={card.gender} size="small" variant="outlined" />
        <Chip label={card.number} size="small" variant="outlined" />
      </Box>
    </>
  );
}

export const DeclensionsTab = memo(function DeclensionsTab() {
  const { systemCards: systemDeclensionCards, setSystemCards: setSystemDeclensionCards } =
    useDeclension();
  const [editingCard, setEditingCard] = useState<DeclensionCard | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const { deleteItem, patchItem, mirrorItem } = useAdminItems<
    DeclensionCard,
    Partial<Omit<DeclensionCard, 'id' | 'isCustom'>>
  >({
    items: systemDeclensionCards,
    setItems: setSystemDeclensionCards,
    update: (card, patch) => updateDeclensionCard(card.id as number, patch),
    remove: (card) => deleteDeclensionCard(card.id as number),
    label: 'Card',
  });

  return (
    <>
      <AdminItemList
        items={systemDeclensionCards}
        noun="cards"
        searchPlaceholder="Search declensions..."
        estimateSize={88}
        getId={(card) => card.id}
        getSearchFields={getSearchFields}
        getAudioUrl={(card) => card.audioUrl}
        renderContent={(card) => <DeclensionRowContent card={card} />}
        onSelect={setEditingCard}
        onDelete={async (card) => {
          const confirmed = await confirm({
            title: 'Delete Card',
            message: `Delete card "${card.declined}"?`,
            confirmLabel: 'Delete',
          });
          if (confirmed) void deleteItem(card);
        }}
      />

      <EditDeclensionModal
        open={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSave={(data) => patchItem(editingCard, data)}
        card={editingCard}
        onAudioUpdated={(audioUrl) => mirrorItem(editingCard, { audioUrl })}
      />
      {confirmDialog}
    </>
  );
});
