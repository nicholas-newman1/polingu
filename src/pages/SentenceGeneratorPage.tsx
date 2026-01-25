import { useState, useMemo,  } from 'react';
import { Navigate } from 'react-router-dom';
import {
  TextField,
  Box,
  Button,
  Typography,
  Chip,
  CircularProgress,
  Checkbox,
  Tabs,
  Tab,
  Stack,
  IconButton,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '../lib/styled';
import { useReviewData } from '../hooks/useReviewData';
import { useSnackbar } from '../hooks/useSnackbar';
import { useAuthContext } from '../hooks/useAuthContext';
import type { CEFRLevel, Sentence, TagCategory } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import type { Timestamp } from 'firebase/firestore';
import {
  generateSentences,
  discoverCurriculum,
  type GeneratedSentence,
  type CurriculumSuggestion,
} from '../lib/generateSentences';

function formatCreatedAt(createdAt: unknown): string | null {
  if (!createdAt) return null;
  const ts = createdAt as Timestamp;
  if (typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return null;
}
import { createSentences, getNextSentenceIds, deleteSentence } from '../lib/storage/systemSentences';
import { alpha } from '../lib/theme';

const PageContainer = styled(Box)(() => ({
  maxWidth: 900,
  margin: '0 auto',
  width: '100%',
}));

const Section = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const ChipGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
}));

const SentenceCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>(({ theme, $selected }) => ({
  padding: theme.spacing(2),
  backgroundColor: $selected
    ? alpha(theme.palette.primary.main, 0.08)
    : theme.palette.action.hover,
  borderRadius: theme.spacing(1),
  border: $selected
    ? `2px solid ${theme.palette.primary.main}`
    : '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: $selected
      ? alpha(theme.palette.primary.main, 0.12)
      : theme.palette.action.selected,
  },
}));

const SuggestionCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$priority',
})<{ $priority: 'high' | 'medium' | 'low' }>(({ theme, $priority }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.spacing(1),
  borderLeft: `4px solid ${
    $priority === 'high'
      ? theme.palette.error.main
      : $priority === 'medium'
        ? theme.palette.warning.main
        : theme.palette.info.main
  }`,
}));

const TabPanel = ({ value, index, children }: { value: number; index: number; children: React.ReactNode }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

interface CoverageStats {
  byLevel: Record<CEFRLevel, number>;
  byTag: Record<string, number>;
}

function computeCoverageStats(sentences: Sentence[]): CoverageStats {
  const byLevel: Record<CEFRLevel, number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
  };
  const byTag: Record<string, number> = {};

  for (const s of sentences) {
    byLevel[s.level]++;
    for (const tag of s.tags) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
  }

  return { byLevel, byTag };
}

export function SentenceGeneratorPage() {
  const { isAdmin } = useAuthContext();
  const { sentences, setSentences, sentenceTags, addSentenceTag } = useReviewData();
  const { showSnackbar } = useSnackbar();

  const [tabIndex, setTabIndex] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>('B1');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [countInput, setCountInput] = useState('5');
  const [guidance, setGuidance] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedSentences, setGeneratedSentences] = useState<GeneratedSentence[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [discoveryMode, setDiscoveryMode] = useState<'grammar' | 'topics' | 'polish-specific' | 'freeform'>('grammar');
  const [discoveryLevel, setDiscoveryLevel] = useState<CEFRLevel | ''>('');
  const [freeformQuestion, setFreeformQuestion] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [suggestions, setSuggestions] = useState<CurriculumSuggestion[]>([]);

  const [browseLevel, setBrowseLevel] = useState<CEFRLevel | ''>('');
  const [browseTag, setBrowseTag] = useState('');
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseDateFrom, setBrowseDateFrom] = useState('');
  const [browseDateTo, setBrowseDateTo] = useState('');

  const [newTagInputs, setNewTagInputs] = useState<Record<TagCategory, string>>({
    topics: '',
    grammar: '',
    style: '',
  });

  const handleAddTag = async (category: TagCategory) => {
    const tag = newTagInputs[category].trim();
    if (!tag) return;
    await addSentenceTag(category, tag);
    setNewTagInputs((prev) => ({ ...prev, [category]: '' }));
    showSnackbar(`Added "${tag}" to ${category}`, 'success');
  };

  const handleDeleteSentence = async (sentenceId: string) => {
    if (!window.confirm('Delete this sentence?')) return;
    try {
      await deleteSentence(sentenceId);
      setSentences(sentences.filter((s) => s.id !== sentenceId));
      showSnackbar('Sentence deleted', 'success');
    } catch (e) {
      console.error('Delete failed:', e);
      showSnackbar('Failed to delete sentence', 'error');
    }
  };

  const coverage = useMemo(() => computeCoverageStats(sentences), [sentences]);

  const generateFilteredSentences = useMemo(
    () => sentences.filter((s) => s.level === selectedLevel),
    [sentences, selectedLevel]
  );

  const generateCoverage = useMemo(
    () => computeCoverageStats(generateFilteredSentences),
    [generateFilteredSentences]
  );

  const levelFilteredSentences = useMemo(() => {
    if (!browseLevel) return sentences;
    return sentences.filter((s) => s.level === browseLevel);
  }, [sentences, browseLevel]);

  const browseCoverage = useMemo(
    () => computeCoverageStats(levelFilteredSentences),
    [levelFilteredSentences]
  );

  const filteredSentences = useMemo(() => {
    let result = levelFilteredSentences;
    if (browseTag) {
      result = result.filter((s) => s.tags.includes(browseTag));
    }
    if (browseSearch.trim()) {
      const search = browseSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.polish.toLowerCase().includes(search) ||
          s.english.toLowerCase().includes(search)
      );
    }
    if (browseDateFrom) {
      const fromTime = new Date(browseDateFrom).getTime();
      result = result.filter((s) => {
        if (!s.createdAt || typeof (s.createdAt as Timestamp).toMillis !== 'function') return false;
        return (s.createdAt as Timestamp).toMillis() >= fromTime;
      });
    }
    if (browseDateTo) {
      const toTime = new Date(browseDateTo).getTime();
      result = result.filter((s) => {
        if (!s.createdAt || typeof (s.createdAt as Timestamp).toMillis !== 'function') return false;
        return (s.createdAt as Timestamp).toMillis() <= toTime;
      });
    }
    return [...result].sort((a, b) => {
      const aTime = a.createdAt && typeof (a.createdAt as Timestamp).toMillis === 'function'
        ? (a.createdAt as Timestamp).toMillis()
        : 0;
      const bTime = b.createdAt && typeof (b.createdAt as Timestamp).toMillis === 'function'
        ? (b.createdAt as Timestamp).toMillis()
        : 0;
      return bTime - aTime;
    });
  }, [levelFilteredSentences, browseTag, browseSearch, browseDateFrom, browseDateTo]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGenerate = async () => {
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
  };

  const toggleSentenceSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSave = async () => {
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
  };

  const handleDiscover = async () => {
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
  };

  const handleAddSuggestion = async (suggestion: CurriculumSuggestion) => {
    await addSentenceTag(suggestion.category, suggestion.tag);
    showSnackbar(`Added "${suggestion.tag}" to ${suggestion.category}`, 'success');
  };

  const handleGenerateFromSuggestion = (suggestion: CurriculumSuggestion) => {
    setSelectedTags([suggestion.tag]);
    if (suggestion.relevantLevels.length > 0) {
      setSelectedLevel(suggestion.relevantLevels[0]);
    }
    setTabIndex(0);
  };

  return (
    <PageContainer>
      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Generate" />
        <Tab label={`Browse (${sentences.length})`} />
        <Tab label="Curriculum" />
      </Tabs>

      <TabPanel value={tabIndex} index={0}>
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
                    onChange={(e) =>
                      setNewTagInputs((prev) => ({ ...prev, [category]: e.target.value }))
                    }
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
      </TabPanel>

      <TabPanel value={tabIndex} index={1}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <ChipGroup sx={{ flex: 1, minWidth: 200 }}>
              <Chip
                label="All Levels"
                size="small"
                variant={browseLevel === '' ? 'filled' : 'outlined'}
                color={browseLevel === '' ? 'primary' : 'default'}
                onClick={() => setBrowseLevel('')}
              />
              {ALL_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={`${level} (${coverage.byLevel[level]})`}
                  size="small"
                  variant={browseLevel === level ? 'filled' : 'outlined'}
                  color={browseLevel === level ? 'primary' : 'default'}
                  onClick={() => setBrowseLevel(level)}
                />
              ))}
            </ChipGroup>
            <TextField
              size="small"
              placeholder="Search sentences..."
              value={browseSearch}
              onChange={(e) => setBrowseSearch(e.target.value)}
              sx={{ width: 200 }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="datetime-local"
              label="From"
              value={browseDateFrom}
              onChange={(e) => setBrowseDateFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 200 }}
            />
            <TextField
              size="small"
              type="datetime-local"
              label="To"
              value={browseDateTo}
              onChange={(e) => setBrowseDateTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 200 }}
            />
            {(browseDateFrom || browseDateTo) && (
              <Button
                size="small"
                onClick={() => {
                  setBrowseDateFrom('');
                  setBrowseDateTo('');
                }}
              >
                Clear dates
              </Button>
            )}
          </Stack>

          <ChipGroup>
            <Chip
              label="All Tags"
              size="small"
              variant={browseTag === '' ? 'filled' : 'outlined'}
              color={browseTag === '' ? 'secondary' : 'default'}
              onClick={() => setBrowseTag('')}
            />
            {[...sentenceTags.topics, ...sentenceTags.grammar, ...sentenceTags.style].map((tag) => (
              <Chip
                key={tag}
                label={`${tag} (${browseCoverage.byTag[tag] || 0})`}
                size="small"
                variant={browseTag === tag ? 'filled' : 'outlined'}
                color={browseTag === tag ? 'secondary' : 'default'}
                onClick={() => setBrowseTag(tag)}
              />
            ))}
          </ChipGroup>

          <Typography variant="body2" color="text.secondary">
            Showing {filteredSentences.length} of {sentences.length} sentences
          </Typography>

          <Stack spacing={1} sx={{ maxHeight: 500, overflow: 'auto' }}>
            {filteredSentences.map((sentence) => {
              const createdDate = formatCreatedAt(sentence.createdAt);
              return (
                <Box
                  key={sentence.id}
                  sx={{
                    p: 1.5,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {sentence.polish}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {sentence.english}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip label={sentence.level} size="small" color="primary" variant="outlined" />
                      {sentence.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                      {createdDate && (
                        <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                          {createdDate}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteSentence(sentence.id)}
                    sx={{ alignSelf: 'flex-start', color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
            {filteredSentences.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                No sentences match your filters
              </Typography>
            )}
          </Stack>
        </Stack>
      </TabPanel>

      <TabPanel value={tabIndex} index={2}>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Ask AI to discover grammar concepts, topics, or Polish-specific features missing from your curriculum.
          </Typography>

          <Section>
            <Typography variant="subtitle2" color="text.secondary">
              Discovery Mode
            </Typography>
            <ChipGroup>
              {([
                { value: 'grammar', label: 'Grammar' },
                { value: 'topics', label: 'Topics' },
                { value: 'polish-specific', label: 'Polish-Specific' },
                { value: 'freeform', label: 'Custom Question' },
              ] as const).map((mode) => (
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
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
      </TabPanel>
    </PageContainer>
  );
}

