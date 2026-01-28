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
import { EditDeclensionModal } from '../components/EditDeclensionModal';
import { loadCustomDeclension, saveCustomDeclension } from '../lib/storage/customDeclension';
import type { CustomDeclensionCard, Case, Gender, Number, DeclensionCard } from '../types';
import { useAuthContext } from '../hooks/useAuthContext';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import {
  PageContainer,
  FiltersRow,
  SearchField,
  FilterSelect,
  StyledTableContainer,
  TruncatedCell,
  MetaChip,
  CustomItemPageHeader,
  CustomItemEmptyState,
  CustomItemLoadingState,
  CustomItemActions,
  formatDate,
} from '../components/CustomItemPage';

type SortField = 'front' | 'declined' | 'case' | 'gender' | 'number' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const GenderChip = styled(Chip)<{
  $gender: 'Masculine' | 'Feminine' | 'Neuter' | 'Pronoun';
}>(({ theme, $gender }) => {
  const genderKey =
    $gender === 'Pronoun'
      ? 'neuter'
      : ($gender.toLowerCase() as 'masculine' | 'feminine' | 'neuter');
  return {
    height: 24,
    fontSize: '0.75rem',
    fontWeight: 500,
    backgroundColor: alpha(theme.palette.gender[genderKey].main, 0.12),
    color: theme.palette.gender[genderKey].main,
  };
});

const CASES: Case[] = [
  'Nominative',
  'Genitive',
  'Dative',
  'Accusative',
  'Instrumental',
  'Locative',
  'Vocative',
];

const GENDERS: Gender[] = ['Masculine', 'Feminine', 'Neuter', 'Pronoun'];

const NUMBERS: Number[] = ['Singular', 'Plural'];

export function CustomDeclensionPage() {
  const { user } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(true);
  const [customCardsBase, setCustomCardsBase] = useState<CustomDeclensionCard[]>([]);
  const [customCards, applyOptimisticCustomCards] = useOptimistic(customCardsBase, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomDeclensionCard | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseFilter, setCaseFilter] = useState<Case | ''>('');
  const [genderFilter, setGenderFilter] = useState<Gender | ''>('');
  const [numberFilter, setNumberFilter] = useState<Number | ''>('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const loadedCustomCards = await loadCustomDeclension();
      setCustomCardsBase(loadedCustomCards);
      setIsLoading(false);
    };
    loadData();
  }, [user]);

  const handleAddCard = (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
    const newCard: CustomDeclensionCard = {
      ...cardData,
      id: `custom_${Date.now()}`,
      isCustom: true,
      createdAt: Date.now(),
    };
    const newCustomCards = [newCard, ...customCardsBase];

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setCustomCardsBase(newCustomCards);
    });
  };

  const handleEditCard = (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
    if (!editingCard) return;
    const newCustomCards = customCards.map((c) =>
      c.id === editingCard.id ? { ...c, ...cardData } : c
    );
    setEditingCard(null);

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setCustomCardsBase(newCustomCards);
    });
  };

  const handleDeleteCard = (cardId: string) => {
    if (!window.confirm('Are you sure you want to delete this card?')) {
      return;
    }

    const newCustomCards = customCards.filter((c) => c.id !== cardId);

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setCustomCardsBase(newCustomCards);
    });
  };

  const handleOpenEditModal = (card: CustomDeclensionCard) => {
    setEditingCard(card);
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

  const filteredAndSortedCards = useMemo(() => {
    let result = [...customCards];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (card) =>
          card.front.toLowerCase().includes(query) ||
          card.back.toLowerCase().includes(query) ||
          card.declined.toLowerCase().includes(query) ||
          card.hint?.toLowerCase().includes(query)
      );
    }

    if (caseFilter) {
      result = result.filter((card) => card.case === caseFilter);
    }

    if (genderFilter) {
      result = result.filter((card) => card.gender === genderFilter);
    }

    if (numberFilter) {
      result = result.filter((card) => card.number === numberFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'front':
          comparison = a.front.localeCompare(b.front, 'pl');
          break;
        case 'declined':
          comparison = a.declined.localeCompare(b.declined, 'pl');
          break;
        case 'case':
          comparison = a.case.localeCompare(b.case);
          break;
        case 'gender':
          comparison = a.gender.localeCompare(b.gender);
          break;
        case 'number':
          comparison = a.number.localeCompare(b.number);
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [customCards, searchQuery, caseFilter, genderFilter, numberFilter, sortField, sortDirection]);

  if (isLoading) {
    return <CustomItemLoadingState />;
  }

  return (
    <PageContainer>
      <CustomItemPageHeader
        title="My Declensions"
        subtitle="Your personal declension card collection"
        count={customCards.length}
        addLabel="Add Card"
        onAdd={() => setShowAddModal(true)}
      />

      {customCards.length === 0 ? (
        <CustomItemEmptyState
          title="No custom declension cards yet"
          description="Add your own declension cards to practice alongside the standard card set."
          addLabel="Add Your First Card"
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <>
          <FiltersRow>
            <SearchField
              size="small"
              placeholder="Search cards..."
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
              <InputLabel>Case</InputLabel>
              <Select
                value={caseFilter}
                onChange={(e) => setCaseFilter(e.target.value as Case | '')}
                label="Case"
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {CASES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FilterSelect>
            <FilterSelect size="small">
              <InputLabel>Gender</InputLabel>
              <Select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as Gender | '')}
                label="Gender"
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {GENDERS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FilterSelect>
            <FilterSelect size="small">
              <InputLabel>Number</InputLabel>
              <Select
                value={numberFilter}
                onChange={(e) => setNumberFilter(e.target.value as Number | '')}
                label="Number"
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {NUMBERS.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FilterSelect>
            {(searchQuery || caseFilter || genderFilter || numberFilter) && (
              <Typography variant="body2" color="text.secondary">
                {filteredAndSortedCards.length} of {customCards.length} cards
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
                      active={sortField === 'front'}
                      direction={sortField === 'front' ? sortDirection : 'asc'}
                      onClick={() => handleSort('front')}
                    >
                      Question
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'declined'}
                      direction={sortField === 'declined' ? sortDirection : 'asc'}
                      onClick={() => handleSort('declined')}
                    >
                      Answer
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'case'}
                      direction={sortField === 'case' ? sortDirection : 'asc'}
                      onClick={() => handleSort('case')}
                    >
                      Case
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
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'number'}
                      direction={sortField === 'number' ? sortDirection : 'asc'}
                      onClick={() => handleSort('number')}
                    >
                      Number
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
                {filteredAndSortedCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <CustomItemActions
                        onEdit={() => handleOpenEditModal(card)}
                        onDelete={() => handleDeleteCard(card.id)}
                        editLabel="edit card"
                        deleteLabel="delete card"
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell title={card.front}>{card.front}</TruncatedCell>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={500}>{card.declined}</Typography>
                    </TableCell>
                    <TableCell>
                      <MetaChip label={card.case} size="small" />
                    </TableCell>
                    <TableCell>
                      <GenderChip $gender={card.gender} label={card.gender} size="small" />
                    </TableCell>
                    <TableCell>
                      <MetaChip label={card.number} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(card.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedCards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No cards match your filters</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </>
      )}

      <EditDeclensionModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingCard(null);
        }}
        onSave={editingCard ? handleEditCard : handleAddCard}
        onDelete={
          editingCard
            ? () => {
                handleDeleteCard(editingCard.id);
                setShowAddModal(false);
                setEditingCard(null);
              }
            : undefined
        }
        card={editingCard}
        isCreating={!editingCard}
      />
    </PageContainer>
  );
}
