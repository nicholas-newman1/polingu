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
import { AddButton } from './AddButton';
import { ClearButton } from './ClearButton';
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
        '&:hover': { backgroundColor: theme.palette.action.hover },
      }),
}));

interface DeclensionFilterControlsProps {
  caseFilter: Case[];
  genderFilter: Gender[];
  numberFilter: Number | 'All';
  practiceMode: boolean;
  showSettings: boolean;
  onCaseChange: (value: Case[]) => void;
  onGenderChange: (value: Gender[]) => void;
  onNumberChange: (value: Number | 'All') => void;
  onTogglePractice: () => void;
  onToggleSettings: () => void;
  onAddCard?: () => void;
}

export function DeclensionFilterControls({
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
  onAddCard,
}: DeclensionFilterControlsProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    (caseFilter.length > 0 ? 1 : 0) +
    (genderFilter.length > 0 ? 1 : 0) +
    (numberFilter !== 'All' ? 1 : 0);

  const handleCaseSelectChange = (event: SelectChangeEvent<Case[]>) => {
    const value = event.target.value;
    onCaseChange(typeof value === 'string' ? (value.split(',') as Case[]) : value);
  };

  const handleGenderSelectChange = (event: SelectChangeEvent<Gender[]>) => {
    const value = event.target.value;
    onGenderChange(typeof value === 'string' ? (value.split(',') as Gender[]) : value);
  };

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

        {onAddCard && <AddButton onClick={onAddCard} aria-label="Add custom card" />}
      </Stack>

      <Collapse in={showFilters}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          <FilterFormControl size="small">
            <InputLabel>Case</InputLabel>
            <Select<Case[]>
              multiple
              value={caseFilter}
              label="Case"
              onChange={handleCaseSelectChange}
              renderValue={() => 'Case'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {CASES.map((c) => (
                <MenuItem
                  key={c}
                  value={c}
                  sx={{
                    fontWeight: caseFilter.includes(c) ? 600 : 400,
                    backgroundColor: caseFilter.includes(c) ? 'action.selected' : 'transparent',
                  }}
                >
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FilterFormControl>

          <FilterFormControl size="small">
            <InputLabel>Gender</InputLabel>
            <Select<Gender[]>
              multiple
              value={genderFilter}
              label="Gender"
              onChange={handleGenderSelectChange}
              renderValue={() => 'Gender'}
              sx={{ backgroundColor: 'background.paper' }}
            >
              {GENDERS.map((g) => (
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

          {activeFilterCount > 0 && (
            <ClearButton
              onClick={() => {
                onCaseChange([]);
                onGenderChange([]);
                onNumberChange('All');
              }}
            />
          )}
        </Box>

        {(caseFilter.length > 0 || genderFilter.length > 0 || numberFilter !== 'All') && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
            {caseFilter.map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                onClick={() => onCaseChange(caseFilter.filter((x) => x !== c))}
                onDelete={() => onCaseChange(caseFilter.filter((x) => x !== c))}
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
            {numberFilter !== 'All' && (
              <Chip
                label={numberFilter}
                size="small"
                onClick={() => onNumberChange('All')}
                onDelete={() => onNumberChange('All')}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
