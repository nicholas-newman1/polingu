import { useState, useCallback, memo } from 'react';
import { TextField, Box, Button, Typography, Chip, CircularProgress, Stack } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import type { CEFRLevel, Sentence } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { processSentence } from '../../lib/processSentence';
import { createSentence, getNextSentenceIds } from '../../lib/storage/systemSentences';
import { Section, ChipGroup } from './shared';
import type { AddCustomTabProps } from './types';

export const AddCustomTab = memo(function AddCustomTab({
  sentences,
  setSentences,
  sentenceTags,
  showSnackbar,
}: AddCustomTabProps) {
  const [customText, setCustomText] = useState('');
  const [customSourceLang, setCustomSourceLang] = useState<'EN' | 'PL'>('PL');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [customPolish, setCustomPolish] = useState('');
  const [customEnglish, setCustomEnglish] = useState('');
  const [customLevel, setCustomLevel] = useState<CEFRLevel>('B1');
  const [hasProcessed, setHasProcessed] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  const toggleCustomTag = useCallback((tag: string) => {
    setCustomTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const handleProcess = useCallback(async () => {
    if (!customText.trim()) return;
    setProcessing(true);
    setHasProcessed(false);
    try {
      const result = await processSentence({
        text: customText.trim(),
        sourceLang: customSourceLang,
      });
      setCustomPolish(result.polish);
      setCustomEnglish(result.english);
      setCustomLevel(result.level);
      setHasProcessed(true);
    } catch (e) {
      console.error('Processing failed:', e);
      showSnackbar('Failed to process sentence.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [customText, customSourceLang, showSnackbar]);

  const handleSaveCustom = useCallback(async () => {
    if (!customPolish || !customEnglish) return;
    setSavingCustom(true);
    try {
      const nextIds = await getNextSentenceIds([customLevel]);
      const id = `${customLevel.toLowerCase()}_${String(nextIds[customLevel]).padStart(3, '0')}`;
      const sentence: Sentence = {
        id,
        polish: customPolish,
        english: customEnglish,
        level: customLevel,
        tags: customTags,
      };
      await createSentence(sentence);
      setSentences([...sentences, sentence]);
      showSnackbar('Sentence saved!', 'success');
      setCustomText('');
      setCustomPolish('');
      setCustomEnglish('');
      setCustomTags([]);
      setHasProcessed(false);
    } catch (e) {
      console.error('Save failed:', e);
      showSnackbar('Failed to save sentence.', 'error');
    } finally {
      setSavingCustom(false);
    }
  }, [customPolish, customEnglish, customLevel, customTags, sentences, setSentences, showSnackbar]);

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        Add a sentence manually. Enter either Polish or English and the system will translate and
        assess the CEFR level.
      </Typography>

      <Section>
        <Typography variant="subtitle2" color="text.secondary">
          Input Language
        </Typography>
        <ChipGroup>
          <Chip
            label="Polish"
            size="small"
            variant={customSourceLang === 'PL' ? 'filled' : 'outlined'}
            color={customSourceLang === 'PL' ? 'primary' : 'default'}
            onClick={() => setCustomSourceLang('PL')}
          />
          <Chip
            label="English"
            size="small"
            variant={customSourceLang === 'EN' ? 'filled' : 'outlined'}
            color={customSourceLang === 'EN' ? 'primary' : 'default'}
            onClick={() => setCustomSourceLang('EN')}
          />
        </ChipGroup>
      </Section>

      <TextField
        label={customSourceLang === 'PL' ? 'Polish Sentence' : 'English Sentence'}
        placeholder={
          customSourceLang === 'PL' ? 'Enter a Polish sentence...' : 'Enter an English sentence...'
        }
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        multiline
        rows={2}
        fullWidth
      />

      <Button
        variant="contained"
        onClick={handleProcess}
        disabled={processing || !customText.trim()}
        startIcon={processing ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {processing ? 'Processing...' : 'Translate & Assess'}
      </Button>

      {hasProcessed && (
        <Stack spacing={2}>
          <Typography variant="subtitle2">Result (editable)</Typography>

          <TextField
            label="Polish"
            value={customPolish}
            onChange={(e) => setCustomPolish(e.target.value)}
            fullWidth
          />

          <TextField
            label="English"
            value={customEnglish}
            onChange={(e) => setCustomEnglish(e.target.value)}
            fullWidth
          />

          <Section>
            <Typography variant="subtitle2" color="text.secondary">
              CEFR Level
            </Typography>
            <ChipGroup>
              {ALL_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  size="small"
                  variant={customLevel === level ? 'filled' : 'outlined'}
                  color={customLevel === level ? 'primary' : 'default'}
                  onClick={() => setCustomLevel(level)}
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
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ mb: 0.5, display: 'block' }}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Typography>
                <ChipGroup>
                  {sentenceTags[category].map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant={customTags.includes(tag) ? 'filled' : 'outlined'}
                      color={customTags.includes(tag) ? 'secondary' : 'default'}
                      onClick={() => toggleCustomTag(tag)}
                    />
                  ))}
                </ChipGroup>
              </Box>
            ))}
          </Section>

          <Button
            variant="contained"
            color="success"
            onClick={handleSaveCustom}
            disabled={savingCustom || !customPolish.trim() || !customEnglish.trim()}
            startIcon={savingCustom ? <CircularProgress size={16} /> : <AddIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            {savingCustom ? 'Saving...' : 'Save Sentence'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
});
