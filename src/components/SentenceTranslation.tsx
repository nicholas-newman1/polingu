import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Switch,
} from '@mui/material';
import { styled } from '../lib/styled';
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { renderTappableText } from '../lib/renderTappableText';
import { DirectionToggle, type TranslationDirection } from './DirectionToggle';
import { useReviewData } from '../hooks/useReviewData';
import { useTranslationContext } from '../hooks/useTranslationContext';
import type { Sentence, CEFRLevel, TagCategory } from '../types/sentences';
import { TAG_CATEGORY_NAMES } from '../types/sentences';
import { alpha } from '../lib/theme';

const Container = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 600,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const Card = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  boxShadow: `0 4px 20px ${alpha(theme.palette.text.primary, 0.15)}`,
  minHeight: 380,
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.up('sm')]: {
    minHeight: 420,
  },
}));

const LevelChip = styled(Chip)<{ $level: CEFRLevel; $active?: boolean }>(
  ({ theme, $level, $active = true }) => ({
    backgroundColor: $active
      ? theme.palette.levels[$level]
      : theme.palette.neutral.main,
    color: theme.palette.common.white,
    fontWeight: 600,
    fontSize: '0.75rem',
    '&:hover': {
      backgroundColor: $active
        ? theme.palette.levels[$level]
        : theme.palette.neutral.dark,
    },
  })
);

const SentenceText = styled(Box)(({ theme }) => ({
  fontSize: '1.5rem',
  lineHeight: 1.6,
  marginBottom: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.25rem',
  },
}));

const NavigationBox = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
});

const TagChip = styled(Chip)<{ $selected?: boolean }>(
  ({ theme, $selected }) => ({
    height: 24,
    fontSize: '0.7rem',
    backgroundColor: $selected
      ? theme.palette.primary.main
      : theme.palette.action.hover,
    color: $selected ? theme.palette.common.white : theme.palette.text.primary,
    '&:hover': {
      backgroundColor: $selected
        ? theme.palette.primary.dark
        : theme.palette.action.selected,
    },
  })
);

const CategorySection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
}));

const CategoryLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.7rem',
  fontWeight: 600,
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: theme.spacing(0.5),
}));

const NextButton = styled(Button)(({ theme }) => ({
  marginTop: 'auto',
  backgroundColor: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TAG_CATEGORY_ORDER: TagCategory[] = ['topics', 'grammar', 'style'];

function getAvailableTags(sentences: Sentence[]): Set<string> {
  const tagSet = new Set<string>();
  sentences.forEach((s) => s.tags.forEach((t) => tagSet.add(t)));
  return tagSet;
}

export function SentenceTranslation() {
  const { sentenceTags } = useReviewData();
  const { handleDailyLimitReached } = useTranslationContext();
  const [selectedLevels, setSelectedLevels] = useState<CEFRLevel[]>([
    'A1',
    'A2',
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [direction, setDirection] = useState<TranslationDirection>('en-to-pl');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSentences() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'sentences'),
          where('level', 'in', selectedLevels)
        );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map((doc) => doc.data() as Sentence);
        setSentences(fetched);
      } catch (err) {
        console.error('Failed to fetch sentences:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSentences();
  }, [selectedLevels]);

  const availableTags = useMemo(() => getAvailableTags(sentences), [sentences]);

  const filteredSentences = useMemo(() => {
    return sentences.filter((s) => {
      if (
        selectedTags.length > 0 &&
        !s.tags.some((t) => selectedTags.includes(t))
      ) {
        return false;
      }
      return true;
    });
  }, [sentences, selectedTags]);

  const currentSentence = filteredSentences[currentIndex];

  const toggleLevel = useCallback((level: CEFRLevel) => {
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level];
    });
    setCurrentIndex(0);
    setShowAnswer(false);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setCurrentIndex(0);
    setShowAnswer(false);
  }, []);

  const goNext = useCallback(() => {
    if (shuffleMode) {
      setCurrentIndex(Math.floor(Math.random() * filteredSentences.length));
    } else {
      setCurrentIndex((prev) => (prev + 1) % filteredSentences.length);
    }
    setShowAnswer(false);
  }, [filteredSentences.length, shuffleMode]);

  const goPrev = useCallback(() => {
    if (shuffleMode) {
      setCurrentIndex(Math.floor(Math.random() * filteredSentences.length));
    } else {
      setCurrentIndex((prev) =>
        prev === 0 ? filteredSentences.length - 1 : prev - 1
      );
    }
    setShowAnswer(false);
  }, [filteredSentences.length, shuffleMode]);

  const toggleShuffle = useCallback(() => {
    setShuffleMode((prev) => !prev);
  }, []);

  const handleRevealAnswer = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const renderPolishWithTranslation = useCallback(
    (sentence: Sentence) => {
      return renderTappableText(sentence.polish, {
        translations: sentence.translations,
        sentenceId: sentence.id,
        onDailyLimitReached: handleDailyLimitReached,
        sentenceContext: sentence.polish,
      });
    },
    [handleDailyLimitReached]
  );

  if (loading) {
    return (
      <Container>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {ALL_LEVELS.map((level) => (
            <LevelChip
              key={level}
              $level={level}
              label={level}
              $active={selectedLevels.includes(level)}
              onClick={() => toggleLevel(level)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
        <Card>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Card>
      </Container>
    );
  }

  if (filteredSentences.length === 0) {
    return (
      <Container>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {ALL_LEVELS.map((level) => (
            <LevelChip
              key={level}
              $level={level}
              label={level}
              $active={selectedLevels.includes(level)}
              onClick={() => toggleLevel(level)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
          <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={showFilters}>
          {TAG_CATEGORY_ORDER.map((category) => {
            const categoryTags = sentenceTags[category].filter((tag) =>
              availableTags.has(tag)
            );
            if (categoryTags.length === 0) return null;
            return (
              <CategorySection key={category}>
                <CategoryLabel>{TAG_CATEGORY_NAMES[category]}</CategoryLabel>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {categoryTags.map((tag) => (
                    <TagChip
                      key={tag}
                      label={tag}
                      $selected={selectedTags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </CategorySection>
            );
          })}
        </Collapse>

        <Card>
          <Typography color="text.secondary" textAlign="center">
            No sentences match your filters. Try selecting different levels or
            tags.
          </Typography>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {ALL_LEVELS.map((level) => (
            <LevelChip
              key={level}
              $level={level}
              label={level}
              $active={selectedLevels.includes(level)}
              onClick={() => toggleLevel(level)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
          <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DirectionToggle
            direction={direction}
            onToggle={() =>
              setDirection((d) => (d === 'en-to-pl' ? 'pl-to-en' : 'en-to-pl'))
            }
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Shuffle
            </Typography>
            <Switch
              size="small"
              checked={shuffleMode}
              onChange={toggleShuffle}
            />
          </Box>
        </Box>
      </Box>

      <Collapse in={showFilters}>
        {TAG_CATEGORY_ORDER.map((category) => {
          const categoryTags = sentenceTags[category].filter((tag) =>
            availableTags.has(tag)
          );
          if (categoryTags.length === 0) return null;
          return (
            <CategorySection key={category}>
              <CategoryLabel>{TAG_CATEGORY_NAMES[category]}</CategoryLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {categoryTags.map((tag) => (
                  <TagChip
                    key={tag}
                    label={tag}
                    $selected={selectedTags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </CategorySection>
          );
        })}
      </Collapse>

      <Card>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <LevelChip
              $level={currentSentence.level}
              label={currentSentence.level}
              size="small"
            />
            <Typography variant="caption" color="text.secondary">
              {currentIndex + 1} / {filteredSentences.length}
            </Typography>
          </Box>

          <SentenceText>
            {direction === 'en-to-pl'
              ? currentSentence.english
              : renderPolishWithTranslation(currentSentence)}
          </SentenceText>

          {showAnswer && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              {currentSentence.tags.map((tag) => (
                <TagChip key={tag} label={tag} size="small" />
              ))}
            </Box>
          )}

          {showAnswer && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                backgroundColor: 'action.hover',
              }}
            >
              {direction === 'en-to-pl' ? (
                <Box sx={{ fontWeight: 500 }}>
                  {renderPolishWithTranslation(currentSentence)}
                </Box>
              ) : (
                <Typography variant="body1" fontWeight={500}>
                  {currentSentence.english}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {!showAnswer ? (
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleRevealAnswer}
          >
            Reveal Answer
          </Button>
        ) : (
          <NextButton
            fullWidth
            size="large"
            variant="contained"
            onClick={goNext}
          >
            Next →
          </NextButton>
        )}
      </Card>

      <NavigationBox>
        <IconButton onClick={goPrev} size="large">
          <KeyboardArrowLeft />
        </IconButton>
        <IconButton onClick={goNext} size="large">
          <KeyboardArrowRight />
        </IconButton>
      </NavigationBox>
    </Container>
  );
}
