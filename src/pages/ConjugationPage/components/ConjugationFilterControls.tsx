import { Box, Stack } from '@mui/material';
import { ClearButton } from '../../../components/ClearButton';
import { PracticeModeButton } from '../../../components/PracticeModeButton';
import { SettingsButton } from '../../../components/SettingsButton';
import type { ConjugationFilters, GrammaticalNumber } from '../../../types/conjugation';
import {
  ALL_TENSES,
  ALL_PERSONS,
  ALL_ASPECTS,
  ALL_VERB_CLASSES,
  ALL_CONJUGATION_GENDERS,
  TENSE_LABELS,
} from '../../../types/conjugation';
import { getDefaultFilters } from '../../../lib/conjugationUtils';
import {
  FilterChips,
  MultiSelectFilter,
  NumberFilter,
  NumberFilterChip,
} from '../../../components/FilterControls';

const NUMBER_OPTIONS: GrammaticalNumber[] = ['Singular', 'Plural'];

interface ConjugationFilterControlsProps {
  filters: ConjugationFilters;
  practiceMode: boolean;
  showSettings: boolean;
  onChange: (filters: ConjugationFilters) => void;
  onTogglePractice: () => void;
  onToggleSettings: () => void;
}

export function ConjugationFilterControls({
  filters,
  practiceMode,
  showSettings,
  onChange,
  onTogglePractice,
  onToggleSettings,
}: ConjugationFilterControlsProps) {
  const { tenses, persons, number, aspects, verbClasses, genders } = filters;
  const set =
    <F extends keyof ConjugationFilters>(field: F) =>
    (value: ConjugationFilters[F]) =>
      onChange({ ...filters, [field]: value });
  const hasActiveFilters =
    tenses.length > 0 ||
    persons.length > 0 ||
    number !== 'All' ||
    aspects.length > 0 ||
    verbClasses.length > 0 ||
    genders.length > 0;

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <PracticeModeButton active={practiceMode} onClick={onTogglePractice} />

        <SettingsButton active={showSettings} onClick={onToggleSettings} />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <MultiSelectFilter
          label="Tense"
          options={ALL_TENSES}
          value={tenses}
          onChange={set('tenses')}
          getLabel={(t) => TENSE_LABELS[t]}
        />
        <MultiSelectFilter
          label="Person"
          options={ALL_PERSONS}
          value={persons}
          onChange={set('persons')}
        />
        <NumberFilter options={NUMBER_OPTIONS} value={number} onChange={set('number')} />
        <MultiSelectFilter
          label="Aspect"
          options={ALL_ASPECTS}
          value={aspects}
          onChange={set('aspects')}
        />
        <MultiSelectFilter
          label="Verb Class"
          options={ALL_VERB_CLASSES}
          value={verbClasses}
          onChange={set('verbClasses')}
        />
        <MultiSelectFilter
          label="Gender"
          options={ALL_CONJUGATION_GENDERS}
          value={genders}
          onChange={set('genders')}
        />

        {hasActiveFilters && <ClearButton onClick={() => onChange(getDefaultFilters())} />}
      </Box>

      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
          <FilterChips values={tenses} onChange={set('tenses')} getLabel={(t) => TENSE_LABELS[t]} />
          <FilterChips values={persons} onChange={set('persons')} />
          <NumberFilterChip value={number} onChange={set('number')} />
          <FilterChips values={aspects} onChange={set('aspects')} />
          <FilterChips values={verbClasses} onChange={set('verbClasses')} />
          <FilterChips values={genders} onChange={set('genders')} />
        </Box>
      )}
    </Box>
  );
}
