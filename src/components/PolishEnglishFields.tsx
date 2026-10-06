import { Controller, type Control } from 'react-hook-form';
import { TextField } from '@mui/material';
import { FieldEndAdornment } from './FieldEndAdornment';
import type {
  PolishEnglishFormValues,
  SinglePolishEnglishAutoTranslate,
} from '../hooks/usePolishEnglishAutoTranslate';

const REQUIRED_TEXT_RULES = { required: true, validate: (v: string) => v.trim().length > 0 };

interface FieldConfig {
  name: keyof PolishEnglishFormValues;
  label: string;
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  isTranslating: boolean;
  placeholder?: string;
}

interface PolishEnglishFieldsProps<T extends PolishEnglishFormValues> {
  control: Control<T>;
  translation: SinglePolishEnglishAutoTranslate;
  dataQaPrefix: string;
  autoFocus?: boolean;
  multiline?: boolean;
  placeholders?: { polish: string; english: string };
}

/** Required Polish and English text fields that auto-translate into each other. */
export function PolishEnglishFields<T extends PolishEnglishFormValues>({
  control,
  translation,
  dataQaPrefix,
  autoFocus,
  multiline,
  placeholders,
}: PolishEnglishFieldsProps<T>) {
  const fields: FieldConfig[] = [
    {
      name: 'polish',
      label: 'Polish',
      onTextChange: translation.handlePolishChange,
      onTextBlur: translation.handlePolishBlur,
      isTranslating: translation.isTranslatingPolish,
      placeholder: placeholders?.polish,
    },
    {
      name: 'english',
      label: 'English',
      onTextChange: translation.handleEnglishChange,
      onTextBlur: translation.handleEnglishBlur,
      isTranslating: translation.isTranslatingEnglish,
      placeholder: placeholders?.english,
    },
  ];

  return fields.map(({ name, label, onTextChange, onTextBlur, isTranslating, placeholder }) => (
    <Controller
      key={name}
      name={name}
      // react-hook-form can't resolve literal paths against an unresolved generic form type.
      control={control as unknown as Control<PolishEnglishFormValues>}
      rules={REQUIRED_TEXT_RULES}
      render={({ field }) => (
        <TextField
          {...field}
          onChange={(e) => {
            field.onChange(e);
            onTextChange(e.target.value);
          }}
          onBlur={() => {
            field.onBlur();
            onTextBlur();
          }}
          label={label}
          fullWidth
          autoFocus={autoFocus && name === 'polish'}
          required
          multiline={multiline}
          rows={multiline ? 2 : undefined}
          placeholder={placeholder}
          slotProps={{
            input: {
              endAdornment: (
                <FieldEndAdornment
                  value={field.value}
                  onClear={() => {
                    field.onChange('');
                    onTextChange('');
                  }}
                  clearLabel={`Clear ${label}`}
                  dataQa={`${dataQaPrefix}-clear-${name}`}
                  isTranslating={isTranslating}
                />
              ),
            },
          }}
        />
      )}
    />
  ));
}
