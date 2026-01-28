import { useState, useEffect } from 'react';
import { TextField } from '@mui/material';
import { styled } from '../lib/styled';

const StyledTextField = styled(TextField)<{ $width?: number }>(({ $width = 80 }) => ({
  width: $width,
  '& input': {
    fontFamily: '"JetBrains Mono", monospace',
    textAlign: 'center',
  },
}));

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  width?: number;
}

export function NumberInput({ value, onChange, min = 1, max, width }: NumberInputProps) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < min) {
      onChange(min);
      setInputValue(String(min));
    } else if (max && parsed > max) {
      onChange(max);
      setInputValue(String(max));
    } else {
      onChange(parsed);
      setInputValue(String(parsed));
    }
  };

  return (
    <StyledTextField
      type="number"
      size="small"
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      inputProps={{ min, max }}
      $width={width}
    />
  );
}
