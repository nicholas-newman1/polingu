import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { styled } from '../lib/styled';
import FilterListIcon from '@mui/icons-material/FilterList';
import { PracticeModeButton } from './PracticeModeButton';
import { SettingsButton } from './SettingsButton';
import type { Case, Gender, Number } from '../types';
import { CASES, GENDERS, NUMBERS } from '../constants';

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
      }),
}));

interface FilterControlsProps {
  caseFilter: Case | 'All';
  genderFilter: Gender | 'All';
  numberFilter: Number | 'All';
  practiceMode: boolean;
  showSettings: boolean;
  onCaseChange: (value: Case | 'All') => void;
  onGenderChange: (value: Gender | 'All') => void;
  onNumberChange: (value: Number | 'All') => void;
  onTogglePractice: () => void;
  onToggleSettings: () => void;
}

export function FilterControls({
  caseFilter,
  genderFilter,
  numberFilter,
  practiceMode,
  showSettings,
  onCaseChange,
  onGenderChange,
  onNumberChange,
  onTogglePractice,
  onToggleSettings,
}: FilterControlsProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [caseFilter, genderFilter, numberFilter].filter(
    (f) => f !== 'All'
  ).length;

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Badge
          badgeContent={activeFilterCount}
          color="primary"
          invisible={activeFilterCount === 0}
        >
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
            <InputLabel>Case</InputLabel>
            <FilterSelect
              value={caseFilter}
              label="Case"
              onChange={(e) => onCaseChange(e.target.value as Case | 'All')}
            >
              <MenuItem value="All">All Cases</MenuItem>
              {CASES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </FilterSelect>
          </FilterFormControl>

          <FilterFormControl size="small">
            <InputLabel>Gender</InputLabel>
            <FilterSelect
              value={genderFilter}
              label="Gender"
              onChange={(e) => onGenderChange(e.target.value as Gender | 'All')}
            >
              <MenuItem value="All">All Genders</MenuItem>
              {GENDERS.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </FilterSelect>
          </FilterFormControl>

          <FilterFormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Number</InputLabel>
            <FilterSelect
              value={numberFilter}
              label="Number"
              onChange={(e) => onNumberChange(e.target.value as Number | 'All')}
            >
              <MenuItem value="All">Sing./Plural</MenuItem>
              {NUMBERS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </FilterSelect>
          </FilterFormControl>
        </Box>
      </Collapse>
    </Box>
  );
}
