import { Box, Stack } from '@mui/material';
import { AddButton } from '../../../components/AddButton';
import { ClearButton } from '../../../components/ClearButton';
import { PracticeModeButton } from '../../../components/PracticeModeButton';
import { SettingsButton } from '../../../components/SettingsButton';
import { ListenButton } from '../../../components/ListenButton';
import type { DeclensionFilters } from '../../../types';
import { DEFAULT_USER_FILTERS } from '../../../types/userFilters';
import { CASES, GENDERS, NUMBERS } from '../../../constants';
import {
  FilterChips,
  MultiSelectFilter,
  NumberFilter,
  NumberFilterChip,
} from '../../../components/FilterControls';

interface DeclensionFilterControlsProps {
  filters: DeclensionFilters;
  practiceMode: boolean;
  showSettings: boolean;
  onChange: (filters: DeclensionFilters) => void;
  onTogglePractice: () => void;
  onToggleSettings: () => void;
  onAddCard?: () => void;
  onStartListening?: () => void;
}

export function DeclensionFilterControls({
  filters,
  practiceMode,
  showSettings,
  onChange,
  onTogglePractice,
  onToggleSettings,
  onAddCard,
  onStartListening,
}: DeclensionFilterControlsProps) {
  const { cases, genders, number } = filters;
  const set =
    <F extends keyof DeclensionFilters>(field: F) =>
    (value: DeclensionFilters[F]) =>
      onChange({ ...filters, [field]: value });
  const hasActiveFilters = cases.length > 0 || genders.length > 0 || number !== 'All';

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
        <MultiSelectFilter label="Case" options={CASES} value={cases} onChange={set('cases')} />
        <MultiSelectFilter
          label="Gender"
          options={GENDERS}
          value={genders}
          onChange={set('genders')}
        />
        <NumberFilter options={NUMBERS} value={number} onChange={set('number')} />

        {hasActiveFilters && (
          <ClearButton onClick={() => onChange(DEFAULT_USER_FILTERS.declension)} />
        )}
      </Box>

      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
          <FilterChips values={cases} onChange={set('cases')} />
          <FilterChips values={genders} onChange={set('genders')} />
          <NumberFilterChip value={number} onChange={set('number')} />
        </Box>
      )}
    </Box>
  );
}
