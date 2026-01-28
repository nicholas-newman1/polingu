import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
} from '@mui/material';
import { styled } from '../lib/styled';
import FilterListIcon from '@mui/icons-material/FilterList';
import { ClearButton } from './ClearButton';
import { PracticeModeButton } from './PracticeModeButton';
import { SettingsButton } from './SettingsButton';
import type {
  Tense,
  Person,
  GrammaticalNumber,
  Aspect,
  VerbClass,
  ConjugationGender,
} from '../types/conjugation';
import {
  ALL_TENSES,
  ALL_PERSONS,
  ALL_ASPECTS,
  ALL_VERB_CLASSES,
  ALL_CONJUGATION_GENDERS,
  TENSE_LABELS,
} from '../types/conjugation';

const FilterFormControl = styled(FormControl)(({ theme }) => ({
  minWidth: 120,
  flex: 1,
  [theme.breakpoints.up('sm')]: {
    flex: 'none',
  },
}));

const FilterSelect = styled(Select)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
}));

interface FilterButtonProps {
  $active: boolean;
}

const FilterButton = styled(Button)<FilterButtonProps>(({ theme, $active }) => ({
  minWidth: 100,
  ...($active
    ? {
        backgroundColor: theme.palette.success.main,
        '&:hover': { backgroundColor: theme.palette.success.dark },
      }
    : {
        borderColor: theme.palette.divider,
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.background.paper,
        '&:hover': { backgroundColor: theme.palette.action.hover },
      }),
}));

interface ConjugationFilterControlsProps {
  tenseFilter: Tense[];
  personFilter: Person[];
  numberFilter: GrammaticalNumber | 'All';
  aspectFilter: Aspect[];
  verbClassFilter: VerbClass[];
  genderFilter: ConjugationGender[];
  practiceMode: boolean;
  showSettings: boolean;
  onTenseChange: (value: Tense[]) => void;
  onPersonChange: (value: Person[]) => void;
  onNumberChange: (value: GrammaticalNumber | 'All') => void;
  onAspectChange: (value: Aspect[]) => void;
  onVerbClassChange: (value: VerbClass[]) => void;
  onGenderChange: (value: ConjugationGender[]) => void;
  onClearFilters: () => void;
  onTogglePractice: () => void;
  onToggleSettings: () => void;
}

export function ConjugationFilterControls({
  tenseFilter,
  personFilter,
  numberFilter,
  aspectFilter,
  verbClassFilter,
  genderFilter,
  practiceMode,
  showSettings,
  onTenseChange,
  onPersonChange,
  onNumberChange,
  onAspectChange,
  onVerbClassChange,
  onGenderChange,
  onClearFilters,
  onTogglePractice,
  onToggleSettings,
}: ConjugationFilterControlsProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    (tenseFilter.length > 0 ? 1 : 0) +
    (personFilter.length > 0 ? 1 : 0) +
    (numberFilter !== 'All' ? 1 : 0) +
    (aspectFilter.length > 0 ? 1 : 0) +
    (verbClassFilter.length > 0 ? 1 : 0) +
    (genderFilter.length > 0 ? 1 : 0);

  const handleTenseSelectChange = (event: SelectChangeEvent<Tense[]>) => {
    const value = event.target.value;
    onTenseChange(typeof value === 'string' ? (value.split(',') as Tense[]) : value);
  };

  const handlePersonSelectChange = (event: SelectChangeEvent<Person[]>) => {
    const value = event.target.value;
    onPersonChange(typeof value === 'string' ? (value.split(',') as Person[]) : value);
  };

  const handleAspectSelectChange = (event: SelectChangeEvent<Aspect[]>) => {
    const value = event.target.value;
    onAspectChange(typeof value === 'string' ? (value.split(',') as Aspect[]) : value);
  };

  const handleVerbClassSelectChange = (event: SelectChangeEvent<VerbClass[]>) => {
    const value = event.target.value;
    onVerbClassChange(typeof value === 'string' ? (value.split(',') as VerbClass[]) : value);
  };

  const handleGenderSelectChange = (event: SelectChangeEvent<ConjugationGender[]>) => {
    const value = event.target.value;
    onGenderChange(typeof value === 'string' ? (value.split(',') as ConjugationGender[]) : value);
  };

  const hasActiveFilters =
    tenseFilter.length > 0 ||
    personFilter.length > 0 ||
    numberFilter !== 'All' ||
    aspectFilter.length > 0 ||
    verbClassFilter.length > 0 ||
    genderFilter.length > 0;

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
          <FilterButton
            variant={showFilters ? 'contained' : 'outlined'}
            onClick={() => setShowFilters(!showFilters)}
            $active={showFilters}
            startIcon={<FilterListIcon />}
          >
            Filters
          </FilterButton>
        </Badge>

        <PracticeModeButton active={practiceMode} onClick={onTogglePractice} />

        <SettingsButton active={showSettings} onClick={onToggleSettings} />
      </Stack>

      <Collapse in={showFilters}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          <FilterFormControl size="small">
            <InputLabel>Tense</InputLabel>
            <Select<Tense[]>
              multiple
              value={tenseFilter}
              label="Tense"
              onChange={handleTenseSelectChange}
              renderValue={() => 'Tense'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {ALL_TENSES.map((t) => (
                <MenuItem
                  key={t}
                  value={t}
                  sx={{
                    fontWeight: tenseFilter.includes(t) ? 600 : 400,
                    backgroundColor: tenseFilter.includes(t) ? 'action.selected' : 'transparent',
                  }}
                >
                  {TENSE_LABELS[t]}
                </MenuItem>
              ))}
            </Select>
          </FilterFormControl>

          <FilterFormControl size="small">
            <InputLabel>Person</InputLabel>
            <Select<Person[]>
              multiple
              value={personFilter}
              label="Person"
              onChange={handlePersonSelectChange}
              renderValue={() => 'Person'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {ALL_PERSONS.map((p) => (
                <MenuItem
                  key={p}
                  value={p}
                  sx={{
                    fontWeight: personFilter.includes(p) ? 600 : 400,
                    backgroundColor: personFilter.includes(p) ? 'action.selected' : 'transparent',
                  }}
                >
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FilterFormControl>

          <FilterFormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Number</InputLabel>
            <FilterSelect
              value={numberFilter}
              label="Number"
              onChange={(e) => onNumberChange(e.target.value as GrammaticalNumber | 'All')}
            >
              <MenuItem value="All">Sing./Plural</MenuItem>
              <MenuItem value="Singular">Singular</MenuItem>
              <MenuItem value="Plural">Plural</MenuItem>
            </FilterSelect>
          </FilterFormControl>

          <FilterFormControl size="small">
            <InputLabel>Aspect</InputLabel>
            <Select<Aspect[]>
              multiple
              value={aspectFilter}
              label="Aspect"
              onChange={handleAspectSelectChange}
              renderValue={() => 'Aspect'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {ALL_ASPECTS.map((a) => (
                <MenuItem
                  key={a}
                  value={a}
                  sx={{
                    fontWeight: aspectFilter.includes(a) ? 600 : 400,
                    backgroundColor: aspectFilter.includes(a) ? 'action.selected' : 'transparent',
                  }}
                >
                  {a}
                </MenuItem>
              ))}
            </Select>
          </FilterFormControl>

          <FilterFormControl size="small">
            <InputLabel>Verb Class</InputLabel>
            <Select<VerbClass[]>
              multiple
              value={verbClassFilter}
              label="Verb Class"
              onChange={handleVerbClassSelectChange}
              renderValue={() => 'Verb Class'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {ALL_VERB_CLASSES.map((v) => (
                <MenuItem
                  key={v}
                  value={v}
                  sx={{
                    fontWeight: verbClassFilter.includes(v) ? 600 : 400,
                    backgroundColor: verbClassFilter.includes(v)
                      ? 'action.selected'
                      : 'transparent',
                  }}
                >
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FilterFormControl>

          <FilterFormControl size="small">
            <InputLabel>Gender</InputLabel>
            <Select<ConjugationGender[]>
              multiple
              value={genderFilter}
              label="Gender"
              onChange={handleGenderSelectChange}
              renderValue={() => 'Gender'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {ALL_CONJUGATION_GENDERS.map((g) => (
                <MenuItem
                  key={g}
                  value={g}
                  sx={{
                    fontWeight: genderFilter.includes(g) ? 600 : 400,
                    backgroundColor: genderFilter.includes(g) ? 'action.selected' : 'transparent',
                  }}
                >
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FilterFormControl>

          {activeFilterCount > 0 && <ClearButton onClick={onClearFilters} />}
        </Box>

        {hasActiveFilters && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
            {tenseFilter.map((t) => (
              <Chip
                key={t}
                label={TENSE_LABELS[t]}
                size="small"
                onClick={() => onTenseChange(tenseFilter.filter((x) => x !== t))}
                onDelete={() => onTenseChange(tenseFilter.filter((x) => x !== t))}
                sx={{ cursor: 'pointer' }}
              />
            ))}
            {personFilter.map((p) => (
              <Chip
                key={p}
                label={p}
                size="small"
                onClick={() => onPersonChange(personFilter.filter((x) => x !== p))}
                onDelete={() => onPersonChange(personFilter.filter((x) => x !== p))}
                sx={{ cursor: 'pointer' }}
              />
            ))}
            {numberFilter !== 'All' && (
              <Chip
                label={numberFilter}
                size="small"
                onClick={() => onNumberChange('All')}
                onDelete={() => onNumberChange('All')}
                sx={{ cursor: 'pointer' }}
              />
            )}
            {aspectFilter.map((a) => (
              <Chip
                key={a}
                label={a}
                size="small"
                onClick={() => onAspectChange(aspectFilter.filter((x) => x !== a))}
                onDelete={() => onAspectChange(aspectFilter.filter((x) => x !== a))}
                sx={{ cursor: 'pointer' }}
              />
            ))}
            {verbClassFilter.map((v) => (
              <Chip
                key={v}
                label={v}
                size="small"
                onClick={() => onVerbClassChange(verbClassFilter.filter((x) => x !== v))}
                onDelete={() => onVerbClassChange(verbClassFilter.filter((x) => x !== v))}
                sx={{ cursor: 'pointer' }}
              />
            ))}
            {genderFilter.map((g) => (
              <Chip
                key={g}
                label={g}
                size="small"
                onClick={() => onGenderChange(genderFilter.filter((x) => x !== g))}
                onDelete={() => onGenderChange(genderFilter.filter((x) => x !== g))}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
