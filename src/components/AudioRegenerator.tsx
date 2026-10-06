import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Button, IconButton, CircularProgress, Typography } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { generateAudioPreview, saveAudio, type AudioType } from '../lib/audioGeneration';

const AudioSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.info.main, 0.04),
  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
}));

const CurrentAudioSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
}));

interface AudioRegenerationOptions {
  text: string;
  type: AudioType;
  id: string;
  subPath?: string;
  currentAudioUrl?: string;
  onAudioSaved: (audioUrl: string) => void;
}

function stopAudio(ref: React.MutableRefObject<HTMLAudioElement | null>) {
  ref.current?.pause();
  ref.current = null;
}

function useAudioRegeneration({
  text,
  type,
  id,
  subPath,
  currentAudioUrl,
  onAudioSaved,
}: AudioRegenerationOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingCurrent, setIsPlayingCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopAudio(currentAudioRef);
      stopAudio(previewAudioRef);
    };
  }, []);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setError('No text to generate audio for.');
      return;
    }

    stopAudio(currentAudioRef);
    setIsPlayingCurrent(false);
    stopAudio(previewAudioRef);

    setIsProcessing(true);
    setError(null);

    try {
      const audioBase64 = await generateAudioPreview(text, type);
      const audioUrl = await saveAudio(audioBase64, type, id, subPath);
      onAudioSaved(audioUrl);

      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      previewAudioRef.current = audio;
      audio.onended = () => {
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        previewAudioRef.current = null;
      };
      audio.play().catch(() => {});
    } catch (err) {
      console.error('Failed to generate audio:', err);
      setError('Failed to generate audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [text, type, id, subPath, onAudioSaved]);

  const playCurrent = useCallback(() => {
    if (!currentAudioUrl) return;

    stopAudio(previewAudioRef);

    if (isPlayingCurrent && currentAudioRef.current) {
      stopAudio(currentAudioRef);
      setIsPlayingCurrent(false);
      return;
    }

    const audio = new Audio(currentAudioUrl);
    currentAudioRef.current = audio;
    const reset = () => {
      setIsPlayingCurrent(false);
      currentAudioRef.current = null;
    };
    audio.onended = reset;
    audio.onerror = reset;
    audio.play().catch(reset);
    setIsPlayingCurrent(true);
  }, [currentAudioUrl, isPlayingCurrent]);

  return { isProcessing, isPlayingCurrent, error, generate, playCurrent };
}

interface AudioRegeneratorProps {
  /** The text to generate audio for */
  text: string;
  /** The type of audio (for storage path) */
  type: AudioType;
  /** The ID for storage (e.g., sentence ID, card ID) */
  id: string;
  /** Optional sub-path for conjugation forms */
  subPath?: string;
  /** Current audio URL (if any) */
  currentAudioUrl?: string;
  /** Callback when audio is saved */
  onAudioSaved: (audioUrl: string) => void;
  /** Label for the section */
  label?: string;
}

export function AudioRegenerator({
  text,
  type,
  id,
  subPath,
  currentAudioUrl,
  onAudioSaved,
  label = 'Audio',
}: AudioRegeneratorProps) {
  const { isProcessing, isPlayingCurrent, error, generate, playCurrent } = useAudioRegeneration({
    text,
    type,
    id,
    subPath,
    currentAudioUrl,
    onAudioSaved,
  });

  return (
    <AudioSection>
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {label}
      </Typography>

      {currentAudioUrl && (
        <CurrentAudioSection>
          <IconButton
            size="small"
            onClick={playCurrent}
            color={isPlayingCurrent ? 'error' : 'default'}
          >
            {isPlayingCurrent ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            Current audio
          </Typography>
        </CurrentAudioSection>
      )}

      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}

      <Button
        size="small"
        variant="outlined"
        color="info"
        startIcon={
          isProcessing ? <CircularProgress size={16} color="inherit" /> : <GraphicEqIcon />
        }
        onClick={generate}
        disabled={isProcessing || !text.trim()}
        fullWidth
      >
        {isProcessing ? 'Generating...' : currentAudioUrl ? 'Regenerate Audio' : 'Generate Audio'}
      </Button>

      {text.trim() && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: -0.5 }}>
          Text: "{text.length > 50 ? `${text.substring(0, 50)}...` : text}"
        </Typography>
      )}
    </AudioSection>
  );
}

/**
 * A simpler, inline version for compact spaces (like conjugation forms)
 */
type InlineAudioRegeneratorProps = AudioRegenerationOptions;

export function InlineAudioRegenerator({
  text,
  type,
  id,
  subPath,
  currentAudioUrl,
  onAudioSaved,
}: InlineAudioRegeneratorProps) {
  const { isProcessing, isPlayingCurrent, generate, playCurrent } = useAudioRegeneration({
    text,
    type,
    id,
    subPath,
    currentAudioUrl,
    onAudioSaved,
  });

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {currentAudioUrl && (
        <IconButton
          size="small"
          onClick={playCurrent}
          color={isPlayingCurrent ? 'error' : 'default'}
          sx={{ p: 0.5 }}
        >
          {isPlayingCurrent ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
        </IconButton>
      )}
      <IconButton
        size="small"
        onClick={generate}
        disabled={isProcessing || !text.trim()}
        color="info"
        sx={{ p: 0.5 }}
      >
        {isProcessing ? <CircularProgress size={16} /> : <GraphicEqIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}
