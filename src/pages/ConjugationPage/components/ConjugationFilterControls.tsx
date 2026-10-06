import { Box, Stack } from '@mui/material';
import { ClearButton } from '../../../components/ClearButton';
import { PracticeModeButton } from '../../../components/PracticeModeButton';
import { SettingsButton } from '../../../components/SettingsButton';
import type {
  Tense,
  Person,
  GrammaticalNumber,
  Aspect,
  VerbClass,
  ConjugationGender,
} from '../../../types/conjugation';
import {
  ALL_TENSES,
  ALL_PERSONS,
  ALL_ASPECTS,
  ALL_VERB_CLASSES,
  ALL_CONJUGATION_GENDERS,
  TENSE_LABELS,
} from '../../../types/conjugation';
import {
  FilterChips,
  MultiSelectFilter,
  NumberFilter,
  NumberFilterChip,
} from '../../../components/FilterControls';

const NUMBER_OPTIONS: GrammaticalNumber[] = ['Singular', 'Plural'];

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
  const hasActiveFilters =
    tenseFilter.length > 0 ||
    personFilter.length > 0 ||
    numberFilter !== 'All' ||
    aspectFilter.length > 0 ||
    verbClassFilter.length > 0 ||
    genderFilter.length > 0;

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
          value={tenseFilter}
          onChange={onTenseChange}
          getLabel={(t) => TENSE_LABELS[t]}
        />
        <MultiSelectFilter
          label="Person"
          options={ALL_PERSONS}
          value={personFilter}
          onChange={onPersonChange}
        />
        <NumberFilter options={NUMBER_OPTIONS} value={numberFilter} onChange={onNumberChange} />
        <MultiSelectFilter
          label="Aspect"
          options={ALL_ASPECTS}
          value={aspectFilter}
          onChange={onAspectChange}
        />
        <MultiSelectFilter
          label="Verb Class"
          options={ALL_VERB_CLASSES}
          value={verbClassFilter}
          onChange={onVerbClassChange}
        />
        <MultiSelectFilter
          label="Gender"
          options={ALL_CONJUGATION_GENDERS}
          value={genderFilter}
          onChange={onGenderChange}
        />

        {hasActiveFilters && <ClearButton onClick={onClearFilters} />}
      </Box>

      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
          <FilterChips
            values={tenseFilter}
            onChange={onTenseChange}
            getLabel={(t) => TENSE_LABELS[t]}
          />
          <FilterChips values={personFilter} onChange={onPersonChange} />
          <NumberFilterChip value={numberFilter} onChange={onNumberChange} />
          <FilterChips values={aspectFilter} onChange={onAspectChange} />
          <FilterChips values={verbClassFilter} onChange={onVerbClassChange} />
          <FilterChips values={genderFilter} onChange={onGenderChange} />
        </Box>
      )}
    </Box>
  );
}
