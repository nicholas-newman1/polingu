import { Chip, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { styled } from '../lib/styled';

const FilterFormControl = styled(FormControl)(({ theme }) => ({
  minWidth: 120,
  flex: 1,
  [theme.breakpoints.up('sm')]: {
    flex: 'none',
  },
}));

interface MultiSelectFilterProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  getLabel?: (option: T) => string;
}

export function MultiSelectFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  getLabel = String,
}: MultiSelectFilterProps<T>) {
  return (
    <FilterFormControl size="small">
      <InputLabel>{label}</InputLabel>
      <Select<T[]>
        multiple
        value={value}
        label={label}
        onChange={(event) => {
          const next = event.target.value;
          onChange(typeof next === 'string' ? (next.split(',') as T[]) : next);
        }}
        renderValue={() => label}
        sx={{ backgroundColor: 'background.paper' }}
      >
        {options.map((option) => (
          <MenuItem
            key={option}
            value={option}
            sx={{
              fontWeight: value.includes(option) ? 600 : 400,
              backgroundColor: value.includes(option) ? 'action.selected' : 'transparent',
            }}
          >
            {getLabel(option)}
          </MenuItem>
        ))}
      </Select>
    </FilterFormControl>
  );
}

interface NumberFilterProps<T extends string> {
  options: readonly T[];
  value: T | 'All';
  onChange: (value: T | 'All') => void;
}

export function NumberFilter<T extends string>({ options, value, onChange }: NumberFilterProps<T>) {
  return (
    <FilterFormControl size="small" sx={{ minWidth: 130 }}>
      <InputLabel>Number</InputLabel>
      <Select
        value={value}
        label="Number"
        onChange={(e) => onChange(e.target.value as T | 'All')}
        sx={{ backgroundColor: 'background.paper' }}
      >
        <MenuItem value="All">Sing./Plural</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FilterFormControl>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Chip
      label={label}
      size="small"
      onClick={onRemove}
      onDelete={onRemove}
      sx={{ cursor: 'pointer' }}
    />
  );
}

interface FilterChipsProps<T extends string> {
  values: T[];
  onChange: (value: T[]) => void;
  getLabel?: (value: T) => string;
}

/** One removable chip per active value of a multi-select filter. */
export function FilterChips<T extends string>({
  values,
  onChange,
  getLabel = String,
}: FilterChipsProps<T>) {
  return values.map((value) => (
    <RemovableChip
      key={value}
      label={getLabel(value)}
      onRemove={() => onChange(values.filter((other) => other !== value))}
    />
  ));
}

export function NumberFilterChip<T extends string>({
  value,
  onChange,
}: Omit<NumberFilterProps<T>, 'options'>) {
  if (value === 'All') return null;
  return <RemovableChip label={value} onRemove={() => onChange('All')} />;
}
