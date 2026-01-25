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
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '../lib/styled';
import { useBackClose } from '../hooks/useBackClose';
import { useReviewData } from '../hooks/useReviewData';
import type { Sentence, CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 600,
    margin: theme.spacing(2),
    maxHeight: '90vh',
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
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
}

interface EditSentenceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Sentence, 'id'>) => void;
  sentence: Sentence | null;
}

const getDefaultValues = (sentence: Sentence | null): FormData => ({
  polish: sentence?.polish || '',
  english: sentence?.english || '',
  level: sentence?.level || 'A1',
  tags: sentence?.tags || [],
});

export function EditSentenceModal({
  open,
  onClose,
  onSave,
  sentence,
}: EditSentenceModalProps) {
  const { sentenceTags } = useReviewData();
  const allTags = [
    ...sentenceTags.topics,
    ...sentenceTags.grammar,
    ...sentenceTags.style,
  ];

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(sentence),
    mode: 'onChange',
  });

  const handleClose = () => {
    reset(getDefaultValues(null));
    onClose();
  };

  useBackClose(open, handleClose);

  const onSubmit = (data: FormData) => {
    onSave({
      polish: data.polish.trim(),
      english: data.english.trim(),
      level: data.level,
      tags: data.tags,
    });
    handleClose();
  };

  return (
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Sentence</DialogTitle>
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
              multiline
              rows={2}
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
              multiline
              rows={2}
            />
          )}
        />

        <Stack direction="row" spacing={2}>
          <Controller
            name="level"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <FormControl fullWidth required>
                <InputLabel>Level</InputLabel>
                <Select {...field} label="Level">
                  {ALL_LEVELS.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Tags</InputLabel>
                <Select
                  {...field}
                  label="Tags"
                  multiple
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {allTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Stack>
      </Content>
      <Actions>
        <Box />
        <RightActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={!isValid}
          >
            Save Changes
          </Button>
        </RightActions>
      </Actions>
    </StyledDialog>
  );
}
