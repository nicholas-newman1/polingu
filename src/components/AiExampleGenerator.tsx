import { useState } from 'react';
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import { styled } from '../lib/styled';
import { toExampleSentences, type GenerateExampleRequest } from '../lib/generateExample';
import { useGeneratedExamples } from '../hooks/useGeneratedExamples';
import { GeneratedExampleOptions } from './GeneratedExampleOptions';
import type { ExampleSentence } from '../types/vocabulary';

const GenerateSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const GenerateActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

const PreviewActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

interface AiExampleGeneratorProps {
  /** Word to generate examples for; generation is a no-op while null. */
  request: Omit<GenerateExampleRequest, 'context'> | null;
  onAccept: (examples: ExampleSentence[]) => void;
}

export function AiExampleGenerator({ request, onAccept }: AiExampleGeneratorProps) {
  const [context, setContext] = useState('');
  const generated = useGeneratedExamples({ errorMessage: 'Failed to generate. Please try again.' });
  const { isGenerating } = generated;

  const handleGenerate = () => {
    if (!request) return;
    void generated.generate({ ...request, context: context.trim() || undefined });
  };

  const handleAcceptSelected = () => {
    onAccept(toExampleSentences(generated.selectedItems));
    generated.clear();
    setContext('');
  };

  return (
    <Box>
      <GenerateSection>
        <TextField
          size="small"
          label="Context (optional)"
          placeholder="e.g., restaurant scenario, formal letter, casual conversation..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          fullWidth
        />

        {generated.error && (
          <Typography variant="caption" color="error">
            {generated.error}
          </Typography>
        )}

        {generated.items.length > 0 ? (
          <>
            <GeneratedExampleOptions
              examples={generated.items}
              selected={generated.selected}
              onToggle={generated.toggle}
            />
            <PreviewActions>
              <Button
                size="small"
                variant="contained"
                onClick={handleAcceptSelected}
                disabled={generated.selected.size === 0}
              >
                Accept Selected ({generated.selected.size})
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                Regenerate
              </Button>
              <Button size="small" color="inherit" onClick={generated.clear}>
                Discard
              </Button>
            </PreviewActions>
          </>
        ) : (
          <GenerateActions>
            <Button
              size="small"
              variant="contained"
              startIcon={
                isGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />
              }
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </Button>
          </GenerateActions>
        )}
      </GenerateSection>
    </Box>
  );
}
