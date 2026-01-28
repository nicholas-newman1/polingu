import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  InputAdornment,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { loadCustomVocabulary, saveCustomVocabulary } from '../lib/storage/customVocabulary';
import type { CustomVocabularyWord, PartOfSpeech, NounGender } from '../types/vocabulary';
import { useAuthContext } from '../hooks/useAuthContext';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import {
  PageContainer,
  FiltersRow,
  SearchField,
  FilterSelect,
  StyledTableContainer,
  PrimaryCell,
  SecondaryCell,
  MetaChip,
  CustomItemPageHeader,
  CustomItemEmptyState,
  CustomItemLoadingState,
  CustomItemActions,
  formatDate,
} from '../components/CustomItemPage';

type SortField = 'polish' | 'english' | 'partOfSpeech' | 'gender' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const GenderChip = styled(Chip)<{
  $gender: 'masculine' | 'feminine' | 'neuter';
}>(({ theme, $gender }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.gender[$gender].main, 0.12),
  color: theme.palette.gender[$gender].main,
}));

const PARTS_OF_SPEECH: PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'particle',
  'numeral',
  'proper noun',
];

const GENDERS: NounGender[] = ['masculine', 'feminine', 'neuter'];

export function CustomVocabularyPage() {
  const { user } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(true);
  const [customWordsBase, setCustomWordsBase] = useState<CustomVocabularyWord[]>([]);
  const [customWords, applyOptimisticCustomWords] = useOptimistic(customWordsBase, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWord, setEditingWord] = useState<CustomVocabularyWord | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [posFilter, setPosFilter] = useState<PartOfSpeech | ''>('');
  const [genderFilter, setGenderFilter] = useState<NounGender | ''>('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const loadedCustomWords = await loadCustomVocabulary();
      setCustomWordsBase(loadedCustomWords);
      setIsLoading(false);
    };
    loadData();
  }, [user]);

  const handleAddWord = (wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
    const newWord: CustomVocabularyWord = {
      ...wordData,
      id: `custom_${Date.now()}`,
      isCustom: true,
      createdAt: Date.now(),
    };
    const newCustomWords = [newWord, ...customWordsBase];

    applyOptimisticCustomWords(newCustomWords, async () => {
      await saveCustomVocabulary(newCustomWords);
      setCustomWordsBase(newCustomWords);
    });
  };

  const handleEditWord = (
    wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => {
    if (!editingWord) return;
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedWords = useMemo(() => {
    let result = [...customWords];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (word) =>
          word.polish.toLowerCase().includes(query) ||
          word.english.toLowerCase().includes(query) ||
          word.notes?.toLowerCase().includes(query)
      );
    }

    if (posFilter) {
      result = result.filter((word) => word.partOfSpeech === posFilter);
    }

    if (genderFilter) {
      result = result.filter((word) => word.gender === genderFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'polish':
          comparison = a.polish.localeCompare(b.polish, 'pl');
          break;
        case 'english':
          comparison = a.english.localeCompare(b.english);
          break;
        case 'partOfSpeech':
          comparison = (a.partOfSpeech || '').localeCompare(b.partOfSpeech || '');
          break;
        case 'gender':
          comparison = (a.gender || '').localeCompare(b.gender || '');
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
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
          description="Add your own vocabulary words to practice alongside the standard word list."
          addLabel="Add Your First Word"
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <>
          <FiltersRow>
            <SearchField
              size="small"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FilterSelect size="small">
              <InputLabel>Part of Speech</InputLabel>
              <Select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value as PartOfSpeech | '')}
                label="Part of Speech"
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {PARTS_OF_SPEECH.map((pos) => (
                  <MenuItem key={pos} value={pos}>
                    {pos.charAt(0).toUpperCase() + pos.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FilterSelect>
            <FilterSelect size="small">
              <InputLabel>Gender</InputLabel>
              <Select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as NounGender | '')}
                label="Gender"
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {GENDERS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FilterSelect>
            {(searchQuery || posFilter || genderFilter) && (
              <Typography variant="body2" color="text.secondary">
                {filteredAndSortedWords.length} of {customWords.length} words
              </Typography>
            )}
          </FiltersRow>

          <StyledTableContainer elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Actions</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'polish'}
                      direction={sortField === 'polish' ? sortDirection : 'asc'}
                      onClick={() => handleSort('polish')}
                    >
                      Polish
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'english'}
                      direction={sortField === 'english' ? sortDirection : 'asc'}
                      onClick={() => handleSort('english')}
                    >
                      English
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'partOfSpeech'}
                      direction={sortField === 'partOfSpeech' ? sortDirection : 'asc'}
                      onClick={() => handleSort('partOfSpeech')}
                    >
                      Type
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'gender'}
                      direction={sortField === 'gender' ? sortDirection : 'asc'}
                      onClick={() => handleSort('gender')}
                    >
                      Gender
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'createdAt'}
                      direction={sortField === 'createdAt' ? sortDirection : 'asc'}
                      onClick={() => handleSort('createdAt')}
                    >
                      Added
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAndSortedWords.map((word) => (
                  <TableRow key={word.id}>
                    <TableCell>
                      <CustomItemActions
                        onEdit={() => handleOpenEditModal(word)}
                        onDelete={() => handleDeleteWord(word.id)}
                        editLabel="edit word"
                        deleteLabel="delete word"
                      />
                    </TableCell>
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
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
