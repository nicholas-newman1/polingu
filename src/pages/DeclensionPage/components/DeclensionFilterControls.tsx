import { Box, Stack } from '@mui/material';
import { AddButton } from '../../../components/AddButton';
import { ClearButton } from '../../../components/ClearButton';
import { PracticeModeButton } from '../../../components/PracticeModeButton';
import { SettingsButton } from '../../../components/SettingsButton';
import { ListenButton } from '../../../components/ListenButton';
import type { Case, Gender, Number } from '../../../types';
import { CASES, GENDERS, NUMBERS } from '../../../constants';
import {
  FilterChips,
  MultiSelectFilter,
  NumberFilter,
  NumberFilterChip,
} from '../../../components/FilterControls';

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
  onStartListening?: () => void;
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
  onStartListening,
}: DeclensionFilterControlsProps) {
  const hasActiveFilters =
    caseFilter.length > 0 || genderFilter.length > 0 || numberFilter !== 'All';

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <PracticeModeButton active={practiceMode} onClick={onTogglePractice} />

        <SettingsButton active={showSettings} onClick={onToggleSettings} />

        {onStartListening && (
          <ListenButton onClick={onStartListening} aria-label="Start listening mode" />
        )}

        {onAddCard && <AddButton onClick={onAddCard} aria-label="Add custom card" />}
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <MultiSelectFilter
          label="Case"
          options={CASES}
          value={caseFilter}
          onChange={onCaseChange}
        />
        <MultiSelectFilter
          label="Gender"
          options={GENDERS}
          value={genderFilter}
          onChange={onGenderChange}
        />
        <NumberFilter options={NUMBERS} value={numberFilter} onChange={onNumberChange} />

        {hasActiveFilters && (
          <ClearButton
            onClick={() => {
              onCaseChange([]);
              onGenderChange([]);
              onNumberChange('All');
            }}
          />
        )}
      </Box>

      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
          <FilterChips values={caseFilter} onChange={onCaseChange} />
          <FilterChips values={genderFilter} onChange={onGenderChange} />
          <NumberFilterChip value={numberFilter} onChange={onNumberChange} />
        </Box>
      )}
    </Box>
  );
}
