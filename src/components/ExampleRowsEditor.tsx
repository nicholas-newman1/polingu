import type { Ref } from 'react';
import { Controller } from 'react-hook-form';
import { IconButton, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ExamplePairBox, ExampleRowHeader } from './modalStyles';
import { FieldEndAdornment } from './FieldEndAdornment';
import type { ExampleRows } from '../hooks/useExampleRows';

type Lang = 'polish' | 'english';

const LABELS: Record<Lang, string> = { polish: 'Polish', english: 'English' };

interface ExampleFieldProps {
  rows: ExampleRows;
  index: number;
  lang: Lang;
  dataQaPrefix: string;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
}

function ExampleField({
  rows,
  index,
  lang,
  dataQaPrefix,
  placeholder,
  inputRef,
}: ExampleFieldProps) {
  const { translation } = rows;
  const isPolish = lang === 'polish';
  const handleChange = isPolish ? translation.handlePolishChange : translation.handleEnglishChange;
  const handleBlur = isPolish ? translation.handlePolishBlur : translation.handleEnglishBlur;
  const isTranslating = isPolish
    ? translation.isTranslatingPolish
    : translation.isTranslatingEnglish;
  const label = LABELS[lang];

  return (
    <Controller
      name={`examples.${index}.${lang}`}
      control={rows.control}
      render={({ field }) => (
        <TextField
          {...field}
          onChange={(e) => {
            field.onChange(e);
            handleChange(index, e.target.value);
          }}
          onBlur={() => {
            field.onBlur();
            handleBlur(index);
          }}
          inputRef={inputRef}
          label={label}
          size="small"
          fullWidth
          placeholder={placeholder}
          slotProps={{
            input: {
              endAdornment: (
                <FieldEndAdornment
                  value={field.value}
                  onClear={() => {
                    field.onChange('');
                    handleChange(index, '');
                  }}
                  clearLabel={`Clear example ${index + 1} ${label}`}
                  dataQa={`${dataQaPrefix}-clear-${lang}`}
                  isTranslating={isTranslating(index)}
                />
              ),
            },
            htmlInput: { 'data-qa': `${dataQaPrefix}-${lang}` },
          }}
        />
      )}
    />
  );
}

interface ExampleRowsEditorProps {
  rows: ExampleRows;
  dataQaPrefix: string;
  placeholders?: Record<Lang, string>;
}

/** Numbered, removable Polish/English example sentence rows that auto-translate. */
export function ExampleRowsEditor({ rows, dataQaPrefix, placeholders }: ExampleRowsEditorProps) {
  const lastIndex = rows.fields.length - 1;

  return rows.fields.map((field, index) => (
    <ExamplePairBox key={field.id} data-qa={`${dataQaPrefix}-row`}>
      <ExampleRowHeader>
        <Typography variant="caption" color="text.disabled">
          Example {index + 1}
        </Typography>
        <IconButton
          size="small"
          onClick={() => rows.removeRow(index)}
          aria-label="remove example"
          sx={{ color: 'text.disabled' }}
          data-qa={`${dataQaPrefix}-remove`}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </ExampleRowHeader>
      <ExampleField
        rows={rows}
        index={index}
        lang="polish"
        dataQaPrefix={dataQaPrefix}
        placeholder={placeholders?.polish}
        inputRef={index === lastIndex ? rows.newRowPolishRef : undefined}
      />
      <ExampleField
        rows={rows}
        index={index}
        lang="english"
        dataQaPrefix={dataQaPrefix}
        placeholder={placeholders?.english}
      />
    </ExamplePairBox>
  ));
}
