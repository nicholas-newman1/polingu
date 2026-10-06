import { InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { SearchField } from './styles';

interface CustomItemSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function CustomItemSearchField({
  value,
  onChange,
  placeholder,
}: CustomItemSearchFieldProps) {
  return (
    <SearchField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
