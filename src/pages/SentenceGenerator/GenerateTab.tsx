import { useState, useMemo, useCallback, memo } from 'react';
import {
  TextField,
  Box,
  Button,
  Typography,
  Chip,
  CircularProgress,
  Checkbox,
  Stack,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import type { CEFRLevel, Sentence, TagCategory } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { generateSentences, type GeneratedSentence } from '../../lib/generateSentences';
import { createSentences, getNextSentenceIds } from '../../lib/storage/systemSentences';
import { Section, ChipGroup, SentenceCard } from './shared';
import { computeCoverageStats } from './utils';
import type { GenerateTabProps } from './types';

export const GenerateTab = memo(function GenerateTab({
  sentences,
  setSentences,
  sentenceTags,
  addSentenceTag,
  showSnackbar,
}: GenerateTabProps) {
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>('B1');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [countInput, setCountInput] = useState('5');
  const [guidance, setGuidance] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedSentences, setGeneratedSentences] = useState<GeneratedSentence[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [newTagInputs, setNewTagInputs] = useState<Record<TagCategory, string>>({
    topics: '',
    grammar: '',
    style: '',
  });

  const coverage = useMemo(() => computeCoverageStats(sentences), [sentences]);

  const generateFilteredSentences = useMemo(
    () => sentences.filter((s) => s.level === selectedLevel),
    [sentences, selectedLevel]
  );

  const generateCoverage = useMemo(
    () => computeCoverageStats(generateFilteredSentences),
    [generateFilteredSentences]
  );

  const handleAddTag = useCallback(async (category: TagCategory) => {
    const tag = newTagInputs[category].trim();
    if (!tag) return;
    await addSentenceTag(category, tag);
    setNewTagInputs((prev) => ({ ...prev, [category]: '' }));
    showSnackbar(`Added "${tag}" to ${category}`, 'success');
  }, [newTagInputs, addSentenceTag, showSnackbar]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGeneratedSentences([]);
    setSelectedIndices(new Set());
    try {
      const result = await generateSentences({
        level: selectedLevel,
        tags: selectedTags,
        count: parseInt(countInput, 10) || 5,
        guidance: guidance.trim() || undefined,
      });
      setGeneratedSentences(result.sentences);
      setSelectedIndices(new Set(result.sentences.map((_, i) => i)));
    } catch (e) {
      console.error('Generation failed:', e);
      showSnackbar('Generation failed. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  }, [selectedLevel, selectedTags, countInput, guidance, showSnackbar]);

  const toggleSentenceSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const toSave = generatedSentences.filter((_, i) => selectedIndices.has(i));
    if (toSave.length === 0) return;

    setSaving(true);
    try {
      const levels = [...new Set(toSave.map((s) => s.level))];
      const nextIds = await getNextSentenceIds(levels);

      const counters = { ...nextIds };
      const sentencesToCreate: Sentence[] = toSave.map((s) => {
        const id = `${s.level.toLowerCase()}_${String(counters[s.level]).padStart(3, '0')}`;
        counters[s.level]++;
        return { id, ...s };
      });

      await createSentences(sentencesToCreate);
      setSentences([...sentences, ...sentencesToCreate]);
      showSnackbar(`Saved ${sentencesToCreate.length} sentences`, 'success');

      setGeneratedSentences((prev) => prev.filter((_, i) => !selectedIndices.has(i)));
      setSelectedIndices(new Set());
    } catch (e) {
      console.error('Save failed:', e);
      showSnackbar('Failed to save sentences.', 'error');
    } finally {
      setSaving(false);
    }
  }, [generatedSentences, selectedIndices, sentences, setSentences, showSnackbar]);

  const handleNewTagInputChange = useCallback((category: TagCategory, value: string) => {
    setNewTagInputs((prev) => ({ ...prev, [category]: value }));
  }, []);

  return (
    <Stack spacing={3}>
      <Section>
        <Typography variant="subtitle2" color="text.secondary">
          Level
        </Typography>
        <ChipGroup>
          {ALL_LEVELS.map((level) => (
            <Chip
              key={level}
              label={`${level} (${coverage.byLevel[level]})`}
              size="small"
              variant={selectedLevel === level ? 'filled' : 'outlined'}
              color={selectedLevel === level ? 'primary' : 'default'}
              onClick={() => setSelectedLevel(level)}
            />
          ))}
        </ChipGroup>
      </Section>

      <Section>
        <Typography variant="subtitle2" color="text.secondary">
          Tags (optional)
        </Typography>
        {(['topics', 'grammar', 'style'] as const).map((category) => (
          <Box key={category}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" color="text.disabled">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Typography>
              <TextField
                size="small"
                placeholder="Add tag..."
                value={newTagInputs[category]}
                onChange={(e) => handleNewTagInputChange(category, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(category);
                  }
                }}
                sx={{ width: 120, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.75rem' } }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleAddTag(category)}
                disabled={!newTagInputs[category].trim()}
                sx={{ minWidth: 'auto', px: 1, py: 0.25 }}
              >
                <AddIcon fontSize="small" />
              </Button>
            </Box>
            <ChipGroup>
              {sentenceTags[category].map((tag) => (
                <Chip
                  key={tag}
                  label={`${tag} (${generateCoverage.byTag[tag] || 0})`}
                  size="small"
                  variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                  color={selectedTags.includes(tag) ? 'secondary' : 'default'}
                  onClick={() => toggleTag(tag)}
                />
              ))}
            </ChipGroup>
          </Box>
        ))}
      </Section>

      <TextField
        label="Number of sentences"
        type="number"
        value={countInput}
        onChange={(e) => setCountInput(e.target.value)}
        slotProps={{ htmlInput: { min: 1 } }}
        size="small"
        sx={{ width: 160 }}
      />

      <TextField
        label="Guidance (optional)"
        placeholder="e.g., Focus on restaurant ordering scenarios"
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        multiline
        rows={2}
        fullWidth
      />

      <Button
        variant="contained"
        onClick={handleGenerate}
        disabled={generating}
        startIcon={generating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {generating ? 'Generating...' : `Generate ${countInput || 5} Sentences`}
      </Button>

      {generatedSentences.length > 0 && (
        <Stack spacing={2}>
          <Typography variant="subtitle2">
            Generated Sentences ({selectedIndices.size} selected)
          </Typography>

          {generatedSentences.map((sentence, idx) => (
            <SentenceCard
              key={idx}
              $selected={selectedIndices.has(idx)}
              onClick={() => toggleSentenceSelection(idx)}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Checkbox
                  checked={selectedIndices.has(idx)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSentenceSelection(idx)}
                  size="small"
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={500}>
                    {sentence.polish}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {sentence.english}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={sentence.level} size="small" color="primary" variant="outlined" />
                    {sentence.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              </Box>
            </SentenceCard>
          ))}

          <Button
            variant="contained"
            color="success"
            onClick={handleSave}
            disabled={saving || selectedIndices.size === 0}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Saving...' : `Save ${selectedIndices.size} Sentences`}
          </Button>
        </Stack>
      )}
    </Stack>
  );
});

