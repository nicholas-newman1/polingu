import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { TextField } from '@mui/material';
import { FieldEndAdornment } from './FieldEndAdornment';
import type {
  PolishEnglishFieldNames,
  SinglePolishEnglishAutoTranslate,
} from '../hooks/usePolishEnglishAutoTranslate';

const REQUIRED_TEXT_RULES = { required: true, validate: (v: string) => v.trim().length > 0 };

type Side = keyof PolishEnglishFieldNames;

interface FieldConfig {
  side: Side;
  label: string;
  required: boolean;
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  isTranslating: boolean;
  placeholder?: string;
}

interface PolishEnglishFieldsProps<T extends FieldValues> {
  control: Control<T>;
  translation: SinglePolishEnglishAutoTranslate;
  dataQaPrefix: string;
  autoFocus?: boolean;
  multiline?: boolean;
  placeholders?: { polish: string; english: string };
  /** Form field names for each side; defaults to `polish` and `english`. */
  names?: PolishEnglishFieldNames;
  labels?: { polish: string; english: string };
  /** Whether English must be filled in; Polish is always required. */
  englishRequired?: boolean;
}

/** Polish and English text fields that auto-translate into each other. */
export function PolishEnglishFields<T extends FieldValues>({
  control,
  translation,
  dataQaPrefix,
  autoFocus,
  multiline,
  placeholders,
  names = { polish: 'polish', english: 'english' },
  labels = { polish: 'Polish', english: 'English' },
  englishRequired = true,
}: PolishEnglishFieldsProps<T>) {
  const fields: FieldConfig[] = [
    {
      side: 'polish',
      label: labels.polish,
      required: true,
      onTextChange: translation.handlePolishChange,
      onTextBlur: translation.handlePolishBlur,
      isTranslating: translation.isTranslatingPolish,
      placeholder: placeholders?.polish,
    },
    {
      side: 'english',
      label: labels.english,
      required: englishRequired,
      onTextChange: translation.handleEnglishChange,
      onTextBlur: translation.handleEnglishBlur,
      isTranslating: translation.isTranslatingEnglish,
      placeholder: placeholders?.english,
    },
  ];

  return fields.map(
    ({ side, label, required, onTextChange, onTextBlur, isTranslating, placeholder }) => (
      <Controller
        key={side}
        name={names[side]}
        // react-hook-form can't resolve literal paths against an unresolved generic form type.
        control={control as unknown as Control<Record<string, string>>}
        rules={required ? REQUIRED_TEXT_RULES : undefined}
        render={({ field: { ref, ...field } }) => (
          <TextField
            {...field}
            inputRef={ref}
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
            autoFocus={autoFocus && side === 'polish'}
            required={required}
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
                    dataQa={`${dataQaPrefix}-clear-${side}`}
                    isTranslating={isTranslating}
                  />
                ),
              },
            }}
          />
        )}
      />
    )
  );
}
