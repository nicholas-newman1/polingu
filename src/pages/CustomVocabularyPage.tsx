import { useState, useMemo, useCallback } from 'react';
import { Typography, Chip, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { InlineAudioRegenerator } from '../components/AudioRegenerator';
import { saveCustomVocabulary, subscribeCustomVocabulary } from '../lib/storage/customVocabulary';
import { findCustomWordWithSamePolish } from '../lib/utils/findDuplicateCustomVocabularyPolish';
import capitalize from '../lib/utils/capitalize';
import {
  PARTS_OF_SPEECH,
  NOUN_GENDERS,
  type CustomVocabularyWord,
  type PartOfSpeech,
  type NounGender,
} from '../types/vocabulary';
import { createCustomItem } from '../types/customItems';
import { useAuthContext } from '../hooks/useAuthContext';
import { useReprioritizeVocabularyWord } from '../hooks/useReprioritizeVocabularyWord';
import { useCustomCollection } from '../hooks/useCustomCollection';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useAppSettings } from '../contexts/AppSettingsContext';
import {
  PageContainer,
  FiltersRow,
  StyledTableContainer,
  PrimaryCell,
  SecondaryCell,
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
  byPolish,
  byEnglish,
  byCreatedAt,
} from '../components/CustomItemPage';

type SortField = 'polish' | 'english' | 'partOfSpeech' | 'gender' | 'createdAt';

const COMPARATORS: Record<SortField, (a: CustomVocabularyWord, b: CustomVocabularyWord) => number> =
  {
    polish: byPolish,
    english: byEnglish,
    partOfSpeech: (a, b) => (a.partOfSpeech || '').localeCompare(b.partOfSpeech || ''),
    gender: (a, b) => (a.gender || '').localeCompare(b.gender || ''),
    createdAt: byCreatedAt,
  };

const GenderChip = styled(Chip)<{
  $gender: 'masculine' | 'feminine' | 'neuter';
}>(({ theme, $gender }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.gender[$gender].main, 0.12),
  color: theme.palette.gender[$gender].main,
}));

export function CustomVocabularyPage() {
  const { isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const { canReprioritize, reprioritize, showDuplicateError } = useReprioritizeVocabularyWord();
  const { settings: appSettings } = useAppSettings();
  const addToVocabulary = useAddToVocabulary();
  const {
    items: customWordsBase,
    setItems: setCustomWordsBase,
    isLoading,
  } = useCustomCollection(subscribeCustomVocabulary);
  const [customWords, applyOptimisticCustomWords] = useOptimistic(customWordsBase, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWord, setEditingWord] = useState<CustomVocabularyWord | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [posFilter, setPosFilter] = useState<PartOfSpeech | ''>('');
  const [genderFilter, setGenderFilter] = useState<NounGender | ''>('');
  const sort = useSortState<SortField>('createdAt');

  const handleAddWord = (wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
    const duplicate = findCustomWordWithSamePolish(customWords, wordData.polish);
    if (duplicate) {
      showDuplicateError(duplicate.id);
      return false;
    }
    const newWord = createCustomItem(wordData);
    const newCustomWords = [newWord, ...customWordsBase];

    applyOptimisticCustomWords(newCustomWords, async () => {
      await saveCustomVocabulary(newCustomWords);
      setCustomWordsBase(newCustomWords);
    });

    if (isAdmin && appSettings.suggestExamplesAfterAddingWord) {
      addToVocabulary?.openSuggestExamples(newWord);
    }
  };

  const handleEditWord = (
    wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => {
    if (!editingWord) return;
    if (findCustomWordWithSamePolish(customWords, wordData.polish, editingWord.id)) {
      showSnackbar('This Polish word is already in your custom vocabulary.', 'error');
      return false;
    }
    const newCustomWords = customWords.map((w) =>
      w.id === editingWord.id ? { ...w, ...wordData } : w
    );
    setEditingWord(null);

    applyOptimisticCustomWords(newCustomWords, async () => {
      await saveCustomVocabulary(newCustomWords);
      setCustomWordsBase(newCustomWords);
    });
  };

  const handleDeleteWord = (wordId: string) => {
    if (!window.confirm('Are you sure you want to delete this word?')) {
      return;
    }

    const newCustomWords = customWords.filter((w) => w.id !== wordId);

    applyOptimisticCustomWords(newCustomWords, async () => {
      await saveCustomVocabulary(newCustomWords);
      setCustomWordsBase(newCustomWords);
    });
  };

  const handleOpenEditModal = (word: CustomVocabularyWord) => {
    setEditingWord(word);
    setShowAddModal(true);
  };

  const handleAudioSaved = useCallback(
    (wordId: string, audioUrl: string) => {
      setCustomWordsBase((prev) => prev.map((w) => (w.id === wordId ? { ...w, audioUrl } : w)));
    },
    [setCustomWordsBase]
  );

  const { sortField, sortDirection } = sort;
  const filteredAndSortedWords = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = customWords.filter(
      (word) =>
        (!query ||
          word.polish.toLowerCase().includes(query) ||
          word.english.toLowerCase().includes(query) ||
          word.notes?.toLowerCase().includes(query)) &&
        (!posFilter || word.partOfSpeech === posFilter) &&
        (!genderFilter || word.gender === genderFilter)
    );
    return sortItems(filtered, COMPARATORS, { sortField, sortDirection });
  }, [customWords, searchQuery, posFilter, genderFilter, sortField, sortDirection]);

  if (isLoading) {
    return <CustomItemLoadingState />;
  }

  return (
    <PageContainer>
      <CustomItemPageHeader
        title="My Vocabulary"
        subtitle="Your personal vocabulary collection"
        count={customWords.length}
        addLabel="Add Word"
        onAdd={() => setShowAddModal(true)}
      />

      {customWords.length === 0 ? (
        <CustomItemEmptyState
          title="No custom words yet"
          description="Add your own vocabulary words to drill alongside the standard word list."
          addLabel="Add Your First Word"
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <>
          <FiltersRow>
            <CustomItemSearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search words..."
            />
            <FilterSelectField
              label="Part of Speech"
              value={posFilter}
              options={PARTS_OF_SPEECH}
              onChange={setPosFilter}
              format={capitalize}
            />
            <FilterSelectField
              label="Gender"
              value={genderFilter}
              options={NOUN_GENDERS}
              onChange={setGenderFilter}
              format={capitalize}
            />
            <FilterResultCount
              visible={Boolean(searchQuery || posFilter || genderFilter)}
              shown={filteredAndSortedWords.length}
              total={customWords.length}
              noun="words"
            />
          </FiltersRow>

          <StyledTableContainer elevation={0}>
            <Table>
              <CustomItemTableHead isAdmin={isAdmin}>
                <SortableHeaderCell field="polish" label="Polish" sort={sort} />
                <SortableHeaderCell field="english" label="English" sort={sort} />
                <SortableHeaderCell field="partOfSpeech" label="Type" sort={sort} />
                <SortableHeaderCell field="gender" label="Gender" sort={sort} />
                <TableCell>Notes</TableCell>
                <SortableHeaderCell field="createdAt" label="Added" sort={sort} />
              </CustomItemTableHead>
              <TableBody>
                {filteredAndSortedWords.map((word) => (
                  <TableRow key={word.id}>
                    <TableCell>
                      <CustomItemActions
                        onEdit={() => handleOpenEditModal(word)}
                        onDelete={() => handleDeleteWord(word.id)}
                        editLabel="edit word"
                        deleteLabel="delete word"
                        onReprioritize={() => reprioritize(word.id)}
                        canReprioritize={canReprioritize(word.id)}
                        reprioritizeLabel="review word again"
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <InlineAudioRegenerator
                          text={word.polish}
                          type="custom-vocabulary"
                          id={word.id}
                          currentAudioUrl={word.audioUrl}
                          onAudioSaved={(audioUrl) => handleAudioSaved(word.id, audioUrl)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <PrimaryCell>{word.polish}</PrimaryCell>
                    </TableCell>
                    <TableCell>{word.english}</TableCell>
                    <TableCell>
                      {word.partOfSpeech && <MetaChip label={word.partOfSpeech} size="small" />}
                    </TableCell>
                    <TableCell>
                      {word.gender && (
                        <GenderChip $gender={word.gender} label={word.gender} size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {word.notes && <SecondaryCell title={word.notes}>{word.notes}</SecondaryCell>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(word.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedWords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No words match your filters</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </>
      )}

      <AddVocabularyModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingWord(null);
        }}
        onSave={editingWord ? handleEditWord : handleAddWord}
        editWord={editingWord}
      />
    </PageContainer>
  );
}
