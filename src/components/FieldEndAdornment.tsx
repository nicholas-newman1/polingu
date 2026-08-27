import { CircularProgress, IconButton, InputAdornment } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

interface FieldEndAdornmentProps {
  value: string;
  onClear: () => void;
  clearLabel: string;
  dataQa: string;
  isTranslating?: boolean;
}

export function FieldEndAdornment({
  value,
  onClear,
  clearLabel,
  dataQa,
  isTranslating,
}: FieldEndAdornmentProps) {
  const showClear = value.length > 0;
  if (!showClear && !isTranslating) return null;

  return (
    <InputAdornment position="end">
      {isTranslating && <CircularProgress size={16} />}
      {showClear && (
        <IconButton
          size="small"
          edge="end"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          aria-label={clearLabel}
          data-qa={dataQa}
          tabIndex={-1}
          sx={{ color: 'text.disabled' }}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
    </InputAdornment>
  );
}
