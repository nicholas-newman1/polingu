import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  styled,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
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

interface PracticeButtonProps {
  active: boolean;
}

const PracticeButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'active',
})<PracticeButtonProps>(({ theme, active }) => ({
  minWidth: 100,
  ...(active
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

interface SettingsButtonProps {
  active: boolean;
}

const SettingsButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<SettingsButtonProps>(({ theme, active }) => ({
  width: 40,
  height: 40,
  backgroundColor: active
    ? theme.palette.text.primary
    : theme.palette.background.paper,
  color: active ? theme.palette.background.paper : theme.palette.text.disabled,
  border: '1px solid',
  borderColor: active ? theme.palette.text.primary : theme.palette.divider,
  '&:hover': {
    backgroundColor: active
      ? theme.palette.text.secondary
      : theme.palette.background.default,
  },
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
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ sm: 'center' }}
      sx={{ mb: { xs: 2, sm: 3 } }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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

      <Stack direction="row" spacing={1}>
        <PracticeButton
          variant={practiceMode ? 'contained' : 'outlined'}
          onClick={onTogglePractice}
          active={practiceMode}
        >
          {practiceMode ? '✓ Practice' : 'Practice'}
        </PracticeButton>

        <SettingsButton
          onClick={onToggleSettings}
          size="small"
          active={showSettings}
        >
          <SettingsIcon fontSize="small" />
        </SettingsButton>
      </Stack>
    </Stack>
  );
}
