import { useState } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { DialogTitle, IconButton, Box, Typography, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { styled } from '../lib/styled';
import { ModalDialog, ModalHeader, ModalContent } from './modalStyles';
import { ModalFooter } from './ModalFooter';
import { VerbDetailsFields } from './FormFields';
import { useBackClose } from '../hooks/useBackClose';
import { useAuthContext } from '../hooks/useAuthContext';
import { AudioRegenerator } from './AudioRegenerator';
import type { AspectPairCard } from '../types/aspectPairs';
import type { Aspect, VerbClass } from '../types/conjugation';

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
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
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

type VerbSlot = 'verb1' | 'verb2';

interface VerbSlotSectionProps {
  slot: VerbSlot;
  control: Control<FormData>;
  verb: AspectPairCard['verb'] | undefined;
  infinitive: string;
  pendingAudioUrl: string | null;
  onAudioSaved: (audioUrl: string) => void;
  showAudio: boolean;
  withAspect?: boolean;
  autoFocus?: boolean;
}

function VerbSlotSection({
  slot,
  control,
  verb,
  infinitive,
  pendingAudioUrl,
  onAudioSaved,
  showAudio,
  withAspect,
  autoFocus,
}: VerbSlotSectionProps) {
  return (
    <VerbSection>
      {showAudio && verb && (
        <AudioRegenerator
          text={infinitive}
          type="verb-infinitive"
          id={verb.id}
          currentAudioUrl={pendingAudioUrl || verb.infinitiveAudioUrl}
          onAudioSaved={onAudioSaved}
          label="Infinitive Audio"
        />
      )}
      <VerbDetailsFields
        control={control}
        names={{
          infinitive: `${slot}Infinitive` as const,
          infinitiveEn: `${slot}InfinitiveEn` as const,
          aspect: withAspect ? (`${slot}Aspect` as const) : undefined,
          verbClass: `${slot}VerbClass` as const,
        }}
        autoFocus={autoFocus}
      />
    </VerbSection>
  );
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
    handleClose();
  };

  const handleVerb2AudioSaved = (audioUrl: string) => {
    setPendingVerb2AudioUrl(audioUrl);
    onVerb2AudioUpdated?.(audioUrl);
    handleClose();
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

  const slots = {
    verb1: {
      verb: card?.verb,
      infinitive: verb1Infinitive,
      pendingAudioUrl: pendingVerb1AudioUrl,
      onAudioSaved: handleVerb1AudioSaved,
      showAudio: isAdmin,
    },
    verb2: {
      verb: card?.pairVerb,
      infinitive: verb2Infinitive,
      pendingAudioUrl: pendingVerb2AudioUrl,
      onAudioSaved: handleVerb2AudioSaved,
      showAudio: isAdmin,
    },
  };

  return (
    <ModalDialog open={open} onClose={handleClose}>
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Aspect Pair</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <ModalContent>
        {isBiaspectual ? (
          <>
            <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
              This is a biaspectual verb — the same form is used for both aspects.
            </Typography>

            <SectionLabel>Verb Details</SectionLabel>
            <VerbSlotSection slot="verb1" control={control} {...slots.verb1} autoFocus />
          </>
        ) : (
          <>
            <SectionLabel>
              {card?.verb.aspect} Verb ({card?.verb.infinitive})
            </SectionLabel>
            <VerbSlotSection slot="verb1" control={control} {...slots.verb1} withAspect autoFocus />

            <Divider sx={{ my: 1 }} />

            <SectionLabel>
              {card?.pairVerb.aspect} Verb ({card?.pairVerb.infinitive})
            </SectionLabel>
            <VerbSlotSection slot="verb2" control={control} {...slots.verb2} withAspect />
          </>
        )}
      </ModalContent>
      <ModalFooter
        onCancel={handleClose}
        onSubmit={handleSubmit(onSubmit)}
        submitLabel="Save Changes"
        submitDisabled={!isValid}
        destructiveAction={
          onUnlink && !isBiaspectual
            ? { label: 'Unlink Pair', icon: <LinkOffIcon />, onClick: handleUnlink }
            : undefined
        }
      />
    </ModalDialog>
  );
}
