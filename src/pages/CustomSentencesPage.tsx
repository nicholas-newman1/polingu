import { useState, useMemo, useCallback } from 'react';
import { Typography, Chip, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { EditSentenceModal } from '../components/EditSentenceModal';
import { InlineAudioRegenerator } from '../components/AudioRegenerator';
import { saveCustomSentences, subscribeCustomSentences } from '../lib/storage/customSentences';
import { findCustomSentenceWithSamePolish } from '../lib/utils/findDuplicateCustomSentence';
import type { CustomSentence, CEFRLevel, Sentence } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { createCustomItem } from '../types/customItems';
import { useAuthContext } from '../hooks/useAuthContext';
import { useCustomCollection } from '../hooks/useCustomCollection';
import { useOptimistic } from '../hooks/useOptimistic';
import { useReprioritizeSentence } from '../hooks/useReprioritizeSentence';
import { useSnackbar } from '../hooks/useSnackbar';
import { useReviewData } from '../hooks/useReviewData';
import {
  PageContainer,
  FiltersRow,
  StyledTableContainer,
  TruncatedCell,
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
  byPolish,
  byEnglish,
  byCreatedAt,
} from '../components/CustomItemPage';

type SortField = 'polish' | 'english' | 'level' | 'createdAt';

const COMPARATORS: Record<SortField, (a: CustomSentence, b: CustomSentence) => number> = {
  polish: byPolish,
  english: byEnglish,
  level: (a, b) => a.level.localeCompare(b.level),
  createdAt: byCreatedAt,
};

const LevelChip = styled(Chip)<{ $level: CEFRLevel }>(({ theme, $level }) => {
  const levelColors: Record<CEFRLevel, string> = {
    A1: theme.palette.success.main,
    A2: theme.palette.success.light,
    B1: theme.palette.info.main,
    B2: theme.palette.info.light,
    C1: theme.palette.warning.main,
    C2: theme.palette.error.main,
  };
  return {
    height: 24,
    fontSize: '0.75rem',
    fontWeight: 500,
    backgroundColor: alpha(levelColors[$level], 0.12),
    color: levelColors[$level],
  };
});

export function CustomSentencesPage() {
  const { isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const { setCustomSentences: setContextCustomSentences } = useReviewData();
  const {
    items: customSentencesBase,
    setItems: setCustomSentencesBase,
    isLoading,
  } = useCustomCollection(subscribeCustomSentences);
  const [customSentences, applyOptimisticCustomSentences] = useOptimistic(customSentencesBase, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSentence, setEditingSentence] = useState<CustomSentence | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<CEFRLevel | ''>('');
  const sort = useSortState<SortField>('createdAt');
  const { canReprioritize, reprioritize, showDuplicateError } = useReprioritizeSentence();

  const handleAddSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    const duplicate = findCustomSentenceWithSamePolish(customSentences, sentenceData.polish);
    if (duplicate) {
      showDuplicateError(duplicate.id);
      return false;
    }

    const newCustomSentences: CustomSentence[] = [
      createCustomItem(sentenceData),
      ...customSentencesBase,
    ];

    applyOptimisticCustomSentences(newCustomSentences, async () => {
      await saveCustomSentences(newCustomSentences);
      setCustomSentencesBase(newCustomSentences);
      setContextCustomSentences(newCustomSentences);
    });
  };

  const handleEditSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    if (!editingSentence) return;
    if (
      findCustomSentenceWithSamePolish(customSentences, sentenceData.polish, editingSentence.id)
    ) {
      showSnackbar('This sentence is already in your collection.', 'error');
      return false;
    }
    const newCustomSentences = customSentences.map((s) =>
      s.id === editingSentence.id
        ? {
            ...s,
            polish: sentenceData.polish,
            english: sentenceData.english,
            level: sentenceData.level,
            tags: sentenceData.tags,
            translations: sentenceData.translations,
          }
        : s
    );
    setEditingSentence(null);

    applyOptimisticCustomSentences(newCustomSentences, async () => {
      await saveCustomSentences(newCustomSentences);
      setCustomSentencesBase(newCustomSentences);
      setContextCustomSentences(newCustomSentences);
    });
  };

  const handleDeleteSentence = (sentenceId: string) => {
    if (!window.confirm('Are you sure you want to delete this sentence?')) {
      return;
    }

    const newCustomSentences = customSentences.filter((s) => s.id !== sentenceId);

    applyOptimisticCustomSentences(newCustomSentences, async () => {
      await saveCustomSentences(newCustomSentences);
      setCustomSentencesBase(newCustomSentences);
      setContextCustomSentences(newCustomSentences);
    });
  };

  const handleOpenEditModal = (sentence: CustomSentence) => {
    setEditingSentence(sentence);
    setShowAddModal(true);
  };

  const handleAudioSaved = useCallback(
    (sentenceId: string, audioUrl: string) => {
      setCustomSentencesBase((prev) =>
        prev.map((s) => (s.id === sentenceId ? { ...s, audioUrl } : s))
      );
    },
    [setCustomSentencesBase]
  );

  const { sortField, sortDirection } = sort;
  const filteredAndSortedSentences = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = customSentences.filter(
      (sentence) =>
        (!query ||
          sentence.polish.toLowerCase().includes(query) ||
          sentence.english.toLowerCase().includes(query)) &&
        (!levelFilter || sentence.level === levelFilter)
    );
    return sortItems(filtered, COMPARATORS, { sortField, sortDirection });
  }, [customSentences, searchQuery, levelFilter, sortField, sortDirection]);

  if (isLoading) {
    return <CustomItemLoadingState />;
  }

  return (
    <PageContainer>
      <CustomItemPageHeader
        title="My Sentences"
        subtitle="Your personal sentence collection"
        count={customSentences.length}
        addLabel="Add Sentence"
        onAdd={() => setShowAddModal(true)}
      />

      {customSentences.length === 0 ? (
        <CustomItemEmptyState
          title="No custom sentences yet"
          description="Add your own sentences to drill alongside the standard sentence set. Custom sentences are prioritized first!"
          addLabel="Add Your First Sentence"
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <>
          <FiltersRow>
            <CustomItemSearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search sentences..."
            />
            <FilterSelectField
              label="Level"
              value={levelFilter}
              options={ALL_LEVELS}
              onChange={setLevelFilter}
            />
            <FilterResultCount
              visible={Boolean(searchQuery || levelFilter)}
              shown={filteredAndSortedSentences.length}
              total={customSentences.length}
              noun="sentences"
            />
          </FiltersRow>

          <StyledTableContainer elevation={0}>
            <Table>
              <CustomItemTableHead isAdmin={isAdmin}>
                <SortableHeaderCell field="polish" label="Polish" sort={sort} />
                <SortableHeaderCell field="english" label="English" sort={sort} />
                <SortableHeaderCell field="level" label="Level" sort={sort} />
                <SortableHeaderCell field="createdAt" label="Added" sort={sort} />
              </CustomItemTableHead>
              <TableBody>
                {filteredAndSortedSentences.map((sentence) => (
                  <TableRow key={sentence.id}>
                    <TableCell>
                      <CustomItemActions
                        onEdit={() => handleOpenEditModal(sentence)}
                        onDelete={() => handleDeleteSentence(sentence.id)}
                        editLabel="edit sentence"
                        deleteLabel="delete sentence"
                        onReprioritize={() => reprioritize(sentence.id)}
                        canReprioritize={canReprioritize(sentence.id)}
                        reprioritizeLabel="review sentence again"
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <InlineAudioRegenerator
                          text={sentence.polish}
                          type="custom-sentence"
                          id={sentence.id}
                          currentAudioUrl={sentence.audioUrl}
                          onAudioSaved={(audioUrl) => handleAudioSaved(sentence.id, audioUrl)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <TruncatedCell title={sentence.polish}>{sentence.polish}</TruncatedCell>
                    </TableCell>
                    <TableCell>
                      <TruncatedCell title={sentence.english}>{sentence.english}</TruncatedCell>
                    </TableCell>
                    <TableCell>
                      <LevelChip $level={sentence.level} label={sentence.level} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(sentence.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedSentences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No sentences match your filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </>
      )}

      <EditSentenceModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingSentence(null);
        }}
        onSave={editingSentence ? handleEditSentence : handleAddSentence}
        sentence={editingSentence}
        isCreating={!editingSentence}
      />
    </PageContainer>
  );
}
