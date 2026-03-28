import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Button, IconButton, CircularProgress, Typography } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
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

const AudioPreview = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.success.main, 0.08),
  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
}));

const AudioControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const PreviewActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(0.5),
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
  /** Callback when audio is accepted and saved */
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewAudioBase64, setPreviewAudioBase64] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPlayingCurrent, setIsPlayingCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPlayingPreview(false);
    }
    if (!text.trim()) {
      setError('No text to generate audio for.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPreviewAudioBase64(null);

    try {
      const audioBase64 = await generateAudioPreview(text, type);
      setPreviewAudioBase64(audioBase64);

      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      previewAudioRef.current = audio;
      setIsPlayingPreview(true);
      audio.onended = () => {
        setIsPlayingPreview(false);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingPreview(false);
        previewAudioRef.current = null;
      };
      audio.play().catch(() => setIsPlayingPreview(false));
    } catch (err) {
      console.error('Failed to generate audio:', err);
      setError('Failed to generate audio. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [text, type]);

  const handlePlayPreview = useCallback(() => {
    if (!previewAudioBase64) return;

    // Stop current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsPlayingCurrent(false);
    }

    if (isPlayingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
      return;
    }

    const audio = new Audio(`data:audio/mpeg;base64,${previewAudioBase64}`);
    previewAudioRef.current = audio;

    audio.onended = () => {
      setIsPlayingPreview(false);
      previewAudioRef.current = null;
    };

    audio.onerror = () => {
      setIsPlayingPreview(false);
      previewAudioRef.current = null;
    };

    audio.play();
    setIsPlayingPreview(true);
  }, [previewAudioBase64, isPlayingPreview]);

  const handlePlayCurrent = useCallback(() => {
    if (!currentAudioUrl) return;

    // Stop preview audio if playing
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
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

  const handleAccept = useCallback(async () => {
    if (!previewAudioBase64) return;

    setIsSaving(true);
    setError(null);

    try {
      const audioUrl = await saveAudio(previewAudioBase64, type, id, subPath);
      onAudioSaved(audioUrl);
      setPreviewAudioBase64(null);
    } catch (err) {
      console.error('Failed to save audio:', err);
      setError('Failed to save audio. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [previewAudioBase64, type, id, subPath, onAudioSaved]);

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

      {previewAudioBase64 ? (
        <AudioPreview>
          <AudioControls>
            <IconButton
              size="small"
              onClick={handlePlayPreview}
              color={isPlayingPreview ? 'error' : 'success'}
            >
              {isPlayingPreview ? (
                <StopIcon fontSize="small" />
              ) : (
                <GraphicEqIcon fontSize="small" />
              )}
            </IconButton>
            <Typography variant="body2" fontWeight={500} color="success.main" sx={{ flex: 1 }}>
              Preview generated audio
            </Typography>
          </AudioControls>

          <PreviewActions>
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
              onClick={handleAccept}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Accept'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleGenerate}
              disabled={isGenerating || isSaving}
            >
              Regenerate
            </Button>
          </PreviewActions>
        </AudioPreview>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="info"
          startIcon={
            isGenerating ? <CircularProgress size={16} color="inherit" /> : <GraphicEqIcon />
          }
          onClick={handleGenerate}
          disabled={isGenerating || !text.trim()}
          fullWidth
        >
          {isGenerating ? 'Generating...' : currentAudioUrl ? 'Regenerate Audio' : 'Generate Audio'}
        </Button>
      )}

      {!previewAudioBase64 && text.trim() && (
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewAudioBase64, setPreviewAudioBase64] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPlayingCurrent, setIsPlayingCurrent] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPlayingPreview(false);
    }

    setIsGenerating(true);
    setPreviewAudioBase64(null);

    try {
      const audioBase64 = await generateAudioPreview(text, type);
      setPreviewAudioBase64(audioBase64);

      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      previewAudioRef.current = audio;
      setIsPlayingPreview(true);
      audio.onended = () => {
        setIsPlayingPreview(false);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingPreview(false);
        previewAudioRef.current = null;
      };
      audio.play().catch(() => setIsPlayingPreview(false));
    } catch (err) {
      console.error('Failed to generate audio:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [text, type]);

  const handlePlayPreview = useCallback(() => {
    if (!previewAudioBase64) return;

    if (isPlayingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
      return;
    }

    const audio = new Audio(`data:audio/mpeg;base64,${previewAudioBase64}`);
    previewAudioRef.current = audio;

    audio.onended = () => {
      setIsPlayingPreview(false);
      previewAudioRef.current = null;
    };

    audio.play();
    setIsPlayingPreview(true);
  }, [previewAudioBase64, isPlayingPreview]);

  const handlePlayCurrent = useCallback(() => {
    if (!currentAudioUrl) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
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

  const handleAccept = useCallback(async () => {
    if (!previewAudioBase64) return;

    setIsSaving(true);

    try {
      const audioUrl = await saveAudio(previewAudioBase64, type, id, subPath);
      onAudioSaved(audioUrl);
      setPreviewAudioBase64(null);
    } catch (err) {
      console.error('Failed to save audio:', err);
    } finally {
      setIsSaving(false);
    }
  }, [previewAudioBase64, type, id, subPath, onAudioSaved]);

  if (previewAudioBase64) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={handlePlayPreview}
          color={isPlayingPreview ? 'error' : 'success'}
          sx={{ p: 0.5 }}
        >
          {isPlayingPreview ? <StopIcon fontSize="small" /> : <GraphicEqIcon fontSize="small" />}
        </IconButton>
        <IconButton
          size="small"
          onClick={handleAccept}
          disabled={isSaving}
          color="success"
          sx={{ p: 0.5 }}
        >
          {isSaving ? <CircularProgress size={14} /> : <CheckIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={handleGenerate} disabled={isGenerating} sx={{ p: 0.5 }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

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
        disabled={isGenerating || !text.trim()}
        color="info"
        sx={{ p: 0.5 }}
      >
        {isGenerating ? <CircularProgress size={16} /> : <GraphicEqIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}
