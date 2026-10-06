import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { ALL_ASPECTS, ALL_VERB_CLASSES } from '../types/conjugation';

const isNonBlank = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

interface ControlledFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
}

type FormTextFieldProps<T extends FieldValues> = ControlledFieldProps<T> &
  Pick<TextFieldProps, 'autoFocus' | 'placeholder' | 'helperText' | 'sx'> & {
    required?: boolean;
    multiline?: boolean;
  };

/** Full-width text field; `required` also rejects whitespace-only values. */
export function FormTextField<T extends FieldValues>({
  name,
  control,
  label,
  required,
  multiline,
  ...textFieldProps
}: FormTextFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: true, validate: isNonBlank } : undefined}
      render={({ field }) => (
        <TextField
          {...field}
          {...textFieldProps}
          label={label}
          fullWidth
          required={required}
          multiline={multiline}
          rows={multiline ? 2 : undefined}
        />
      )}
    />
  );
}

type FormSelectFieldProps<T extends FieldValues> = ControlledFieldProps<T> & {
  options: readonly string[];
  required?: boolean;
};

export function FormSelectField<T extends FieldValues>({
  name,
  control,
  label,
  options,
  required,
}: FormSelectFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: true } : undefined}
      render={({ field }) => (
        <FormControl fullWidth required={required}>
          <InputLabel>{label}</InputLabel>
          <Select {...field} label={label}>
            {options.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    />
  );
}

type FormYesNoFieldProps<T extends FieldValues> = ControlledFieldProps<T> & {
  yesLabel?: string;
};

/** Select bound to a boolean form value. */
export function FormYesNoField<T extends FieldValues>({
  name,
  control,
  label,
  yesLabel = 'Yes',
}: FormYesNoFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControl fullWidth>
          <InputLabel>{label}</InputLabel>
          <Select
            value={field.value ? 'yes' : 'no'}
            onChange={(e) => field.onChange(e.target.value === 'yes')}
            label={label}
          >
            <MenuItem value="no">No</MenuItem>
            <MenuItem value="yes">{yesLabel}</MenuItem>
          </Select>
        </FormControl>
      )}
    />
  );
}

interface VerbDetailsFieldsProps<T extends FieldValues> {
  control: Control<T>;
  names: {
    infinitive: FieldPath<T>;
    infinitiveEn: FieldPath<T>;
    aspect?: FieldPath<T>;
    verbClass: FieldPath<T>;
  };
  autoFocus?: boolean;
  withPlaceholders?: boolean;
}

/** Polish/English infinitive fields followed by aspect (when named) and verb class selects. */
export function VerbDetailsFields<T extends FieldValues>({
  control,
  names,
  autoFocus,
  withPlaceholders,
}: VerbDetailsFieldsProps<T>) {
  return (
    <>
      <FormTextField
        name={names.infinitive}
        control={control}
        label="Polish Infinitive"
        autoFocus={autoFocus}
        required
        placeholder={withPlaceholders ? 'e.g., robić' : undefined}
      />
      <FormTextField
        name={names.infinitiveEn}
        control={control}
        label="English Infinitive"
        required
        placeholder={withPlaceholders ? 'e.g., to do' : undefined}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        {names.aspect && (
          <FormSelectField
            name={names.aspect}
            control={control}
            label="Aspect"
            options={ALL_ASPECTS}
            required
          />
        )}
        <FormSelectField
          name={names.verbClass}
          control={control}
          label="Verb Class"
          options={ALL_VERB_CLASSES}
          required
        />
      </Box>
    </>
  );
}
