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
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '../lib/styled';
import type { DeclensionCard, Case, Gender, Number } from '../types';

const CASES: Case[] = [
  'Nominative',
  'Genitive',
  'Dative',
  'Accusative',
  'Instrumental',
  'Locative',
  'Vocative',
];

const GENDERS: Gender[] = ['Masculine', 'Feminine', 'Neuter', 'Pronoun'];

const NUMBERS: Number[] = ['Singular', 'Plural'];

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 500,
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
  justifyContent: 'space-between',
}));

const RightActions = styled(Box)({
  display: 'flex',
  gap: 8,
});

interface FormData {
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  hint: string;
}

interface EditDeclensionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<DeclensionCard, 'id' | 'isCustom'>) => void;
  onDelete?: () => void;
  card: DeclensionCard | null;
  isCreating?: boolean;
}

const getDefaultValues = (card: DeclensionCard | null): FormData => ({
  front: card?.front || '',
  back: card?.back || '',
  declined: card?.declined || '',
  case: card?.case || 'Nominative',
  gender: card?.gender || 'Masculine',
  number: card?.number || 'Singular',
  hint: card?.hint || '',
});

export function EditDeclensionModal({
  open,
  onClose,
  onSave,
  onDelete,
  card,
  isCreating = false,
}: EditDeclensionModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(card),
    mode: 'onChange',
  });

  const handleClose = () => {
    reset(getDefaultValues(null));
    onClose();
  };

  const onSubmit = (data: FormData) => {
    const trimmedHint = data.hint.trim();
    onSave({
      front: data.front.trim(),
      back: data.back.trim(),
      declined: data.declined.trim(),
      case: data.case,
      gender: data.gender,
      number: data.number,
      ...(trimmedHint && { hint: trimmedHint }),
    });
    handleClose();
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this card?')) {
      onDelete();
    }
  };

  const title = isCreating
    ? 'Create Custom Card'
    : card?.isCustom
    ? 'Edit Custom Card'
    : 'Edit Declension Card';

  return (
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>{title}</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
        <Controller
          name="front"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Front (Question)"
              fullWidth
              autoFocus
              required
              multiline
              rows={2}
              placeholder="e.g., To jest _____ (kot, masculine)"
            />
          )}
        />

        <Controller
          name="back"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Back (Answer)"
              fullWidth
              required
              multiline
              rows={2}
              placeholder="e.g., To jest kot."
            />
          )}
        />

        <Controller
          name="declined"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Declined Word"
              fullWidth
              required
              placeholder="e.g., kot"
            />
          )}
        />

        <Controller
          name="case"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <FormControl fullWidth required>
              <InputLabel>Case</InputLabel>
              <Select {...field} label="Case">
                {CASES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <Controller
          name="gender"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <FormControl fullWidth required>
              <InputLabel>Gender</InputLabel>
              <Select {...field} label="Gender">
                {GENDERS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <Controller
          name="number"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <FormControl fullWidth required>
              <InputLabel>Number</InputLabel>
              <Select {...field} label="Number">
                {NUMBERS.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <Controller
          name="hint"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Hint (optional)"
              fullWidth
              multiline
              rows={2}
              placeholder="Explanation of the grammar rule..."
            />
          )}
        />
      </Content>
      <Actions>
        <Box>
          {onDelete && (
            <Button
              onClick={handleDelete}
              color="error"
              startIcon={<DeleteIcon />}
            >
              Delete
            </Button>
          )}
        </Box>
        <RightActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={!isValid}
          >
            {isCreating ? 'Create Card' : 'Save Changes'}
          </Button>
        </RightActions>
      </Actions>
    </StyledDialog>
  );
}
