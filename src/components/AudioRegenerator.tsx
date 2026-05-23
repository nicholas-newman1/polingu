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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingCurrent, setIsPlayingCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      setError('No text to generate audio for.');
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlayingCurrent(false);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

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

  const handlePlayCurrent = useCallback(() => {
    if (!currentAudioUrl) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    if (isPlayingCurrent && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsPlayingCurrent(false);
      return;
    }

    const audio = new Audio(currentAudioUrl);
    currentAudioRef.current = audio;

    audio.onended = () => {
      setIsPlayingCurrent(false);
      currentAudioRef.current = null;
    };

    audio.onerror = () => {
      setIsPlayingCurrent(false);
      currentAudioRef.current = null;
    };

    audio.play();
    setIsPlayingCurrent(true);
  }, [currentAudioUrl, isPlayingCurrent]);

  return (
    <AudioSection>
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {label}
      </Typography>

      {currentAudioUrl && (
        <CurrentAudioSection>
          <IconButton
            size="small"
            onClick={handlePlayCurrent}
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
        onClick={handleGenerate}
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
interface InlineAudioRegeneratorProps {
  text: string;
  type: AudioType;
  id: string;
  subPath?: string;
  currentAudioUrl?: string;
  onAudioSaved: (audioUrl: string) => void;
}

export function InlineAudioRegenerator({
  text,
  type,
  id,
  subPath,
  currentAudioUrl,
  onAudioSaved,
}: InlineAudioRegeneratorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingCurrent, setIsPlayingCurrent] = useState(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlayingCurrent(false);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setIsProcessing(true);

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
    } finally {
      setIsProcessing(false);
    }
  }, [text, type, id, subPath, onAudioSaved]);

  const handlePlayCurrent = useCallback(() => {
    if (!currentAudioUrl) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    if (isPlayingCurrent && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlayingCurrent(false);
      return;
    }

    const audio = new Audio(currentAudioUrl);
    currentAudioRef.current = audio;
    audio.onended = () => {
      setIsPlayingCurrent(false);
      currentAudioRef.current = null;
    };
    audio.onerror = () => {
      setIsPlayingCurrent(false);
      currentAudioRef.current = null;
    };
    audio.play().catch(() => {
      setIsPlayingCurrent(false);
      currentAudioRef.current = null;
    });
    setIsPlayingCurrent(true);
  }, [currentAudioUrl, isPlayingCurrent]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {currentAudioUrl && (
        <IconButton
          size="small"
          onClick={handlePlayCurrent}
          color={isPlayingCurrent ? 'error' : 'default'}
          sx={{ p: 0.5 }}
        >
          {isPlayingCurrent ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
        </IconButton>
      )}
      <IconButton
        size="small"
        onClick={handleGenerate}
        disabled={isProcessing || !text.trim()}
        color="info"
        sx={{ p: 0.5 }}
      >
        {isProcessing ? <CircularProgress size={16} /> : <GraphicEqIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}
