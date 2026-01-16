import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '../lib/styled';
import type {
  CustomVocabularyWord,
  PartOfSpeech,
  NounGender,
} from '../types/vocabulary';

const PARTS_OF_SPEECH: PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'particle',
  'numeral',
  'proper noun',
];

const GENDERS: NounGender[] = ['masculine', 'feminine', 'neuter'];

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 450,
    margin: theme.spacing(2),
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Content = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const Actions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

interface FormData {
  polish: string;
  english: string;
  partOfSpeech: PartOfSpeech | '';
  gender: NounGender | '';
  notes: string;
}

interface AddVocabularyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    word: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => void;
  editWord?: CustomVocabularyWord | null;
}

const getDefaultValues = (
  editWord?: CustomVocabularyWord | null
): FormData => ({
  polish: editWord?.polish || '',
  english: editWord?.english || '',
  partOfSpeech: editWord?.partOfSpeech || '',
  gender: editWord?.gender || '',
  notes: editWord?.notes || '',
});

export function AddVocabularyModal({
  open,
  onClose,
  onSave,
  editWord,
}: AddVocabularyModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(editWord),
    mode: 'onChange',
  });

  const partOfSpeech = watch('partOfSpeech');
  const showGenderField =
    partOfSpeech === 'noun' || partOfSpeech === 'proper noun';

  const handleClose = () => {
    reset(getDefaultValues(null));
    onClose();
  };

  const onSubmit = (data: FormData) => {
    onSave({
      polish: data.polish.trim(),
      english: data.english.trim(),
      ...(data.partOfSpeech && { partOfSpeech: data.partOfSpeech }),
      ...(showGenderField && data.gender && { gender: data.gender }),
      ...(data.notes.trim() && { notes: data.notes.trim() }),
    });
    handleClose();
  };

  return (
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>
          {editWord ? 'Edit Word' : 'Add New Word'}
        </DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
        <Controller
          name="polish"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Polish"
              fullWidth
              autoFocus
              required
              placeholder="e.g., kot"
            />
          )}
        />

        <Controller
          name="english"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="English"
              fullWidth
              required
              placeholder="e.g., cat"
            />
          )}
        />

        <Controller
          name="partOfSpeech"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Part of Speech (optional)</InputLabel>
              <Select
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  if (
                    e.target.value !== 'noun' &&
                    e.target.value !== 'proper noun'
                  ) {
                    setValue('gender', '');
                  }
                }}
                label="Part of Speech (optional)"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {PARTS_OF_SPEECH.map((pos) => (
                  <MenuItem key={pos} value={pos}>
                    {pos.charAt(0).toUpperCase() + pos.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {showGenderField && (
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Gender (optional)</InputLabel>
                <Select {...field} label="Gender (optional)">
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {GENDERS.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        )}

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Notes (optional)"
              fullWidth
              multiline
              rows={2}
              placeholder="Any additional notes..."
            />
          )}
        />
      </Content>
      <Actions>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={!isValid}
        >
          {editWord ? 'Save Changes' : 'Add Word'}
        </Button>
      </Actions>
    </StyledDialog>
  );
}
