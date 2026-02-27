import { useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
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
  Typography,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { styled } from '../lib/styled';
import { useBackClose } from '../hooks/useBackClose';
import { useAuthContext } from '../hooks/useAuthContext';
import { AudioRegenerator } from './AudioRegenerator';
import type { AspectPairCard } from '../types/aspectPairs';
import type { Aspect, VerbClass } from '../types/conjugation';
import { ALL_ASPECTS, ALL_VERB_CLASSES } from '../types/conjugation';

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

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  marginTop: theme.spacing(1),
}));

const VerbSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.spacing(1),
}));

interface FormData {
  // First verb fields
  verb1Infinitive: string;
  verb1InfinitiveEn: string;
  verb1Aspect: Aspect;
  verb1VerbClass: VerbClass;
  // Second verb fields
  verb2Infinitive: string;
  verb2InfinitiveEn: string;
  verb2Aspect: Aspect;
  verb2VerbClass: VerbClass;
}

interface VerbUpdates {
  infinitive: string;
  infinitiveEn: string;
  aspect: Aspect;
  verbClass: VerbClass;
}

interface EditAspectPairsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (verb1Updates: VerbUpdates, verb2Updates: VerbUpdates) => void;
  onUnlink?: () => void;
  card: AspectPairCard | null;
  onVerb1AudioUpdated?: (audioUrl: string) => void;
  onVerb2AudioUpdated?: (audioUrl: string) => void;
}

const getDefaultValues = (card: AspectPairCard | null): FormData => ({
  verb1Infinitive: card?.verb.infinitive || '',
  verb1InfinitiveEn: card?.verb.infinitiveEn || '',
  verb1Aspect: card?.verb.aspect || 'Imperfective',
  verb1VerbClass: card?.verb.verbClass || '-ać',
  verb2Infinitive: card?.pairVerb.infinitive || '',
  verb2InfinitiveEn: card?.pairVerb.infinitiveEn || '',
  verb2Aspect: card?.pairVerb.aspect || 'Perfective',
  verb2VerbClass: card?.pairVerb.verbClass || '-ać',
});

export function EditAspectPairsModal({
  open,
  onClose,
  onSave,
  onUnlink,
  card,
  onVerb1AudioUpdated,
  onVerb2AudioUpdated,
}: EditAspectPairsModalProps) {
  const { isAdmin } = useAuthContext();
  const [pendingVerb1AudioUrl, setPendingVerb1AudioUrl] = useState<string | null>(null);
  const [pendingVerb2AudioUrl, setPendingVerb2AudioUrl] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(card),
    mode: 'onChange',
  });

  const verb1Infinitive = useWatch({ control, name: 'verb1Infinitive' });
  const verb2Infinitive = useWatch({ control, name: 'verb2Infinitive' });

  const handleClose = () => {
    reset(getDefaultValues(null));
    setPendingVerb1AudioUrl(null);
    setPendingVerb2AudioUrl(null);
    onClose();
  };

  const handleVerb1AudioSaved = (audioUrl: string) => {
    setPendingVerb1AudioUrl(audioUrl);
    onVerb1AudioUpdated?.(audioUrl);
  };

  const handleVerb2AudioSaved = (audioUrl: string) => {
    setPendingVerb2AudioUrl(audioUrl);
    onVerb2AudioUpdated?.(audioUrl);
  };

  useBackClose(open, handleClose);

  const onSubmit = (data: FormData) => {
    const verb1Updates: VerbUpdates = {
      infinitive: data.verb1Infinitive.trim(),
      infinitiveEn: data.verb1InfinitiveEn.trim(),
      aspect: data.verb1Aspect,
      verbClass: data.verb1VerbClass,
    };

    const verb2Updates: VerbUpdates = {
      infinitive: data.verb2Infinitive.trim(),
      infinitiveEn: data.verb2InfinitiveEn.trim(),
      aspect: data.verb2Aspect,
      verbClass: data.verb2VerbClass,
    };

    onSave(verb1Updates, verb2Updates);
    handleClose();
  };

  const handleUnlink = () => {
    if (
      onUnlink &&
      window.confirm(
        'Are you sure you want to unlink this aspect pair? The verbs will remain but will no longer be paired together. This affects all users.'
      )
    ) {
      onUnlink();
      handleClose();
    }
  };

  const isBiaspectual = card?.verb.id === card?.pairVerb.id;

  return (
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Aspect Pair</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
        {isBiaspectual ? (
          <>
            <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
              This is a biaspectual verb — the same form is used for both aspects.
            </Typography>

            <SectionLabel>Verb Details</SectionLabel>
            <VerbSection>
              {isAdmin && card && (
                <Box sx={{ mb: 2 }}>
                  <AudioRegenerator
                    text={verb1Infinitive}
                    type="verb-infinitive"
                    id={card.verb.id}
                    currentAudioUrl={pendingVerb1AudioUrl || card.verb.infinitiveAudioUrl}
                    onAudioSaved={handleVerb1AudioSaved}
                    label="Infinitive Audio"
                  />
                </Box>
              )}

              <Controller
                name="verb1Infinitive"
                control={control}
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Polish Infinitive"
                    fullWidth
                    autoFocus
                    required
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Controller
                name="verb1InfinitiveEn"
                control={control}
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="English Infinitive"
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Controller
                name="verb1VerbClass"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <FormControl fullWidth required>
                    <InputLabel>Verb Class</InputLabel>
                    <Select {...field} label="Verb Class">
                      {ALL_VERB_CLASSES.map((vc) => (
                        <MenuItem key={vc} value={vc}>
                          {vc}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </VerbSection>
          </>
        ) : (
          <>
            <SectionLabel>
              {card?.verb.aspect} Verb ({card?.verb.infinitive})
            </SectionLabel>
            <VerbSection>
              {isAdmin && card && (
                <Box sx={{ mb: 2 }}>
                  <AudioRegenerator
                    text={verb1Infinitive}
                    type="verb-infinitive"
                    id={card.verb.id}
                    currentAudioUrl={pendingVerb1AudioUrl || card.verb.infinitiveAudioUrl}
                    onAudioSaved={handleVerb1AudioSaved}
                    label="Infinitive Audio"
                  />
                </Box>
              )}

              <Controller
                name="verb1Infinitive"
                control={control}
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Polish Infinitive"
                    fullWidth
                    autoFocus
                    required
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Controller
                name="verb1InfinitiveEn"
                control={control}
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="English Infinitive"
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="verb1Aspect"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormControl fullWidth required>
                      <InputLabel>Aspect</InputLabel>
                      <Select {...field} label="Aspect">
                        {ALL_ASPECTS.map((a) => (
                          <MenuItem key={a} value={a}>
                            {a}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="verb1VerbClass"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormControl fullWidth required>
                      <InputLabel>Verb Class</InputLabel>
                      <Select {...field} label="Verb Class">
                        {ALL_VERB_CLASSES.map((vc) => (
                          <MenuItem key={vc} value={vc}>
                            {vc}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>
            </VerbSection>

            <Divider sx={{ my: 1 }} />

            <SectionLabel>
              {card?.pairVerb.aspect} Verb ({card?.pairVerb.infinitive})
            </SectionLabel>
            <VerbSection>
              {isAdmin && card && (
                <Box sx={{ mb: 2 }}>
                  <AudioRegenerator
                    text={verb2Infinitive}
                    type="verb-infinitive"
                    id={card.pairVerb.id}
                    currentAudioUrl={pendingVerb2AudioUrl || card.pairVerb.infinitiveAudioUrl}
                    onAudioSaved={handleVerb2AudioSaved}
                    label="Infinitive Audio"
                  />
                </Box>
              )}

              <Controller
                name="verb2Infinitive"
                control={control}
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Polish Infinitive"
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Controller
                name="verb2InfinitiveEn"
                control={control}
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="English Infinitive"
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="verb2Aspect"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormControl fullWidth required>
                      <InputLabel>Aspect</InputLabel>
                      <Select {...field} label="Aspect">
                        {ALL_ASPECTS.map((a) => (
                          <MenuItem key={a} value={a}>
                            {a}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="verb2VerbClass"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormControl fullWidth required>
                      <InputLabel>Verb Class</InputLabel>
                      <Select {...field} label="Verb Class">
                        {ALL_VERB_CLASSES.map((vc) => (
                          <MenuItem key={vc} value={vc}>
                            {vc}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>
            </VerbSection>
          </>
        )}
      </Content>
      <Actions>
        <Box>
          {onUnlink && !isBiaspectual && (
            <Button onClick={handleUnlink} color="error" startIcon={<LinkOffIcon />}>
              Unlink Pair
            </Button>
          )}
        </Box>
        <RightActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} variant="contained" disabled={!isValid}>
            Save Changes
          </Button>
        </RightActions>
      </Actions>
    </StyledDialog>
  );
}
