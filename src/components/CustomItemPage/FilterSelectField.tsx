import { InputLabel, Select } from '@mui/material';
import { renderSelectOptions } from '../selectOptions';
import { FilterSelect } from './styles';

interface FilterSelectFieldProps<T extends string> {
  label: string;
  value: T | '';
  options: readonly T[];
  onChange: (value: T | '') => void;
  format?: (option: T) => string;
}

export function FilterSelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  format,
}: FilterSelectFieldProps<T>) {
  return (
    <FilterSelect size="small">
      <InputLabel>{label}</InputLabel>
      <Select value={value} onChange={(e) => onChange(e.target.value as T | '')} label={label}>
        {renderSelectOptions(options, 'All', format)}
      </Select>
    </FilterSelect>
  );
}
