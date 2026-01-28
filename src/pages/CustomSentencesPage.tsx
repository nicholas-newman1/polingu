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
import { EditSentenceModal } from '../components/EditSentenceModal';
import { loadCustomSentences, saveCustomSentences } from '../lib/storage/customSentences';
import type { CustomSentence, CEFRLevel, Sentence } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { useAuthContext } from '../hooks/useAuthContext';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import { useReviewData } from '../hooks/useReviewData';
import {
  PageContainer,
  FiltersRow,
  SearchField,
  FilterSelect,
  StyledTableContainer,
  TruncatedCell,
  CustomItemPageHeader,
  CustomItemEmptyState,
  CustomItemLoadingState,
  CustomItemActions,
  formatDate,
} from '../components/CustomItemPage';

type SortField = 'polish' | 'english' | 'level' | 'createdAt';
type SortDirection = 'asc' | 'desc';

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
  const { user } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const { setCustomSentences: setContextCustomSentences } = useReviewData();
  const [isLoading, setIsLoading] = useState(true);
  const [customSentencesBase, setCustomSentencesBase] = useState<CustomSentence[]>([]);
  const [customSentences, applyOptimisticCustomSentences] = useOptimistic(customSentencesBase, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSentence, setEditingSentence] = useState<CustomSentence | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<CEFRLevel | ''>('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const loadedCustomSentences = await loadCustomSentences();
      setCustomSentencesBase(loadedCustomSentences);
      setIsLoading(false);
    };
    loadData();
  }, [user]);

  const handleAddSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    const newSentence: CustomSentence = {
      ...sentenceData,
      id: `custom_${Date.now()}`,
      isCustom: true,
      createdAt: Date.now(),
    };
    const newCustomSentences = [newSentence, ...customSentencesBase];

    applyOptimisticCustomSentences(newCustomSentences, async () => {
      await saveCustomSentences(newCustomSentences);
      setCustomSentencesBase(newCustomSentences);
      setContextCustomSentences(newCustomSentences);
    });
  };

  const handleEditSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    if (!editingSentence) return;
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedSentences = useMemo(() => {
    let result = [...customSentences];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (sentence) =>
          sentence.polish.toLowerCase().includes(query) ||
          sentence.english.toLowerCase().includes(query)
      );
    }

    if (levelFilter) {
      result = result.filter((sentence) => sentence.level === levelFilter);
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
        case 'level':
          comparison = a.level.localeCompare(b.level);
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
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
          description="Add your own sentences to practice alongside the standard sentence set. Custom sentences are prioritized first!"
          addLabel="Add Your First Sentence"
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <>
          <FiltersRow>
            <SearchField
              size="small"
              placeholder="Search sentences..."
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
              <InputLabel>Level</InputLabel>
              <Select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as CEFRLevel | '')}
                label="Level"
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {ALL_LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                  </MenuItem>
                ))}
              </Select>
            </FilterSelect>
            {(searchQuery || levelFilter) && (
              <Typography variant="body2" color="text.secondary">
                {filteredAndSortedSentences.length} of {customSentences.length} sentences
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
                      active={sortField === 'level'}
                      direction={sortField === 'level' ? sortDirection : 'asc'}
                      onClick={() => handleSort('level')}
                    >
                      Level
                    </TableSortLabel>
                  </TableCell>
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
                {filteredAndSortedSentences.map((sentence) => (
                  <TableRow key={sentence.id}>
                    <TableCell>
                      <CustomItemActions
                        onEdit={() => handleOpenEditModal(sentence)}
                        onDelete={() => handleDeleteSentence(sentence.id)}
                        editLabel="edit sentence"
                        deleteLabel="delete sentence"
                      />
                    </TableCell>
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
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
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
