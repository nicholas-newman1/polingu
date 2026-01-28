import { useState, useCallback, memo } from 'react';
import { TextField, Box, Button, Typography, Chip, CircularProgress, Stack } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import type { CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { discoverCurriculum, type CurriculumSuggestion } from '../../lib/generateSentences';
import { Section, ChipGroup, SuggestionCard } from './shared';
import type { CurriculumTabProps } from './types';

export const CurriculumTab = memo(function CurriculumTab({
  sentenceTags,
  addSentenceTag,
  showSnackbar,
  onGenerateFromSuggestion,
}: CurriculumTabProps) {
  const [discoveryMode, setDiscoveryMode] = useState<
    'grammar' | 'topics' | 'polish-specific' | 'freeform'
  >('grammar');
  const [discoveryLevel, setDiscoveryLevel] = useState<CEFRLevel | ''>('');
  const [freeformQuestion, setFreeformQuestion] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [suggestions, setSuggestions] = useState<CurriculumSuggestion[]>([]);

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setSuggestions([]);
    try {
      const result = await discoverCurriculum({
        mode: discoveryMode,
        level: discoveryLevel || undefined,
        freeformQuestion: discoveryMode === 'freeform' ? freeformQuestion : undefined,
        existingTags: sentenceTags,
      });
      setSuggestions(result.suggestions);
    } catch (e) {
      console.error('Discovery failed:', e);
      showSnackbar('Discovery failed. Please try again.', 'error');
    } finally {
      setDiscovering(false);
    }
  }, [discoveryMode, discoveryLevel, freeformQuestion, sentenceTags, showSnackbar]);

  const handleAddSuggestion = useCallback(
    async (suggestion: CurriculumSuggestion) => {
      await addSentenceTag(suggestion.category, suggestion.tag);
      showSnackbar(`Added "${suggestion.tag}" to ${suggestion.category}`, 'success');
    },
    [addSentenceTag, showSnackbar]
  );

  const handleGenerateFromSuggestion = useCallback(
    (suggestion: CurriculumSuggestion) => {
      const level = suggestion.relevantLevels.length > 0 ? suggestion.relevantLevels[0] : 'B1';
      onGenerateFromSuggestion(level, suggestion.tag);
    },
    [onGenerateFromSuggestion]
  );

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        Ask AI to discover grammar concepts, topics, or Polish-specific features missing from your
        curriculum.
      </Typography>

      <Section>
        <Typography variant="subtitle2" color="text.secondary">
          Discovery Mode
        </Typography>
        <ChipGroup>
          {(
            [
              { value: 'grammar', label: 'Grammar' },
              { value: 'topics', label: 'Topics' },
              { value: 'polish-specific', label: 'Polish-Specific' },
              { value: 'freeform', label: 'Custom Question' },
            ] as const
          ).map((mode) => (
            <Chip
              key={mode.value}
              label={mode.label}
              size="small"
              variant={discoveryMode === mode.value ? 'filled' : 'outlined'}
              color={discoveryMode === mode.value ? 'primary' : 'default'}
              onClick={() => setDiscoveryMode(mode.value)}
            />
          ))}
        </ChipGroup>
      </Section>

      <Section>
        <Typography variant="subtitle2" color="text.secondary">
          Focus Level (optional)
        </Typography>
        <ChipGroup>
          <Chip
            label="All"
            size="small"
            variant={discoveryLevel === '' ? 'filled' : 'outlined'}
            color={discoveryLevel === '' ? 'primary' : 'default'}
            onClick={() => setDiscoveryLevel('')}
          />
          {ALL_LEVELS.map((level) => (
            <Chip
              key={level}
              label={level}
              size="small"
              variant={discoveryLevel === level ? 'filled' : 'outlined'}
              color={discoveryLevel === level ? 'primary' : 'default'}
              onClick={() => setDiscoveryLevel(level)}
            />
          ))}
        </ChipGroup>
      </Section>

      {discoveryMode === 'freeform' && (
        <TextField
          label="Your Question"
          placeholder="e.g., What Polish grammar concepts am I missing for B1 learners?"
          value={freeformQuestion}
          onChange={(e) => setFreeformQuestion(e.target.value)}
          multiline
          rows={2}
          fullWidth
        />
      )}

      <Button
        variant="contained"
        onClick={handleDiscover}
        disabled={discovering || (discoveryMode === 'freeform' && !freeformQuestion.trim())}
        startIcon={discovering ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {discovering ? 'Discovering...' : 'Discover Missing Concepts'}
      </Button>

      {suggestions.length > 0 && (
        <Section>
          <Typography variant="subtitle2" gutterBottom>
            AI Suggestions
          </Typography>
          {suggestions.map((suggestion, i) => (
            <SuggestionCard key={i} $priority={suggestion.priority}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <Box>
                  <Typography variant="subtitle2">
                    {suggestion.tag}
                    <Chip
                      label={suggestion.category}
                      size="small"
                      sx={{ ml: 1 }}
                      variant="outlined"
                    />
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {suggestion.priority.toUpperCase()} PRIORITY · Levels:{' '}
                    {suggestion.relevantLevels.join(', ')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddSuggestion(suggestion)}
                  >
                    Add Tag
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleGenerateFromSuggestion(suggestion)}
                  >
                    Generate
                  </Button>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {suggestion.explanation}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Examples: {suggestion.exampleConcepts.join(', ')}
              </Typography>
            </SuggestionCard>
          ))}
        </Section>
      )}
    </Stack>
  );
});
