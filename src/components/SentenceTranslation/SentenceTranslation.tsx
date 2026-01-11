import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  styled,
  IconButton,
  Collapse,
  CircularProgress,
} from '@mui/material';
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Shuffle,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AnnotatedWord } from './AnnotatedWord';
import type { Sentence, CEFRLevel, TagCategory } from '../../types/sentences';
import { TAG_CATEGORIES } from '../../types/sentences';

const LEVEL_COLORS: Record<CEFRLevel, string> = {
  A1: '#22c55e',
  A2: '#84cc16',
  B1: '#eab308',
  B2: '#f97316',
  C1: '#ef4444',
  C2: '#dc2626',
};

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
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
}));

const LevelChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'level' && prop !== 'active',
})<{ level: CEFRLevel; active?: boolean }>(({ level, active = true }) => ({
  backgroundColor: active ? LEVEL_COLORS[level] : '#6b7280',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.75rem',
  '&:hover': {
    backgroundColor: active ? LEVEL_COLORS[level] : '#4b5563',
  },
}));

const SentenceText = styled(Typography)(({ theme }) => ({
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

const TagChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  height: 24,
  fontSize: '0.7rem',
  backgroundColor: selected
    ? theme.palette.primary.main
    : theme.palette.action.hover,
  color: selected ? '#fff' : theme.palette.text.primary,
  '&:hover': {
    backgroundColor: selected
      ? theme.palette.primary.dark
      : theme.palette.action.selected,
  },
}));

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

const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TAG_CATEGORY_ORDER: TagCategory[] = ['topics', 'grammar', 'style'];

function getAvailableTags(sentences: Sentence[]): Set<string> {
  const tagSet = new Set<string>();
  sentences.forEach((s) => s.tags.forEach((t) => tagSet.add(t)));
  return tagSet;
}

export function SentenceTranslation() {
  const [selectedLevels, setSelectedLevels] = useState<CEFRLevel[]>([
    'A1',
    'A2',
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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
    setCurrentIndex((prev) => (prev + 1) % filteredSentences.length);
    setShowAnswer(false);
  }, [filteredSentences.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) =>
      prev === 0 ? filteredSentences.length - 1 : prev - 1
    );
    setShowAnswer(false);
  }, [filteredSentences.length]);

  const shuffleSentence = useCallback(() => {
    const newIndex = Math.floor(Math.random() * filteredSentences.length);
    setCurrentIndex(newIndex);
    setShowAnswer(false);
  }, [filteredSentences.length]);

  const handleRevealAnswer = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const renderSentenceWithTappableWords = (sentence: Sentence) => {
    const polishText = sentence.polish;
    const words = sentence.words;
    const result: React.ReactNode[] = [];

    let lastIndex = 0;
    words.forEach((wordAnnotation, idx) => {
      const wordIndex = polishText.indexOf(wordAnnotation.word, lastIndex);
      if (wordIndex > lastIndex) {
        result.push(polishText.slice(lastIndex, wordIndex));
      }
      result.push(<AnnotatedWord key={idx} annotation={wordAnnotation} />);
      lastIndex = wordIndex + wordAnnotation.word.length;
    });

    if (lastIndex < polishText.length) {
      result.push(polishText.slice(lastIndex));
    }

    return result;
  };

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
              level={level}
              label={level}
              active={selectedLevels.includes(level)}
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
              level={level}
              label={level}
              active={selectedLevels.includes(level)}
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
            const categoryTags = TAG_CATEGORIES[category].tags.filter((tag) =>
              availableTags.has(tag)
            );
            if (categoryTags.length === 0) return null;
            return (
              <CategorySection key={category}>
                <CategoryLabel>{TAG_CATEGORIES[category].name}</CategoryLabel>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {categoryTags.map((tag) => (
                    <TagChip
                      key={tag}
                      label={tag}
                      selected={selectedTags.includes(tag)}
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
        sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        {ALL_LEVELS.map((level) => (
          <LevelChip
            key={level}
            level={level}
            label={level}
            active={selectedLevels.includes(level)}
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
          const categoryTags = TAG_CATEGORIES[category].tags.filter((tag) =>
            availableTags.has(tag)
          );
          if (categoryTags.length === 0) return null;
          return (
            <CategorySection key={category}>
              <CategoryLabel>{TAG_CATEGORIES[category].name}</CategoryLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {categoryTags.map((tag) => (
                  <TagChip
                    key={tag}
                    label={tag}
                    selected={selectedTags.includes(tag)}
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <LevelChip
            level={currentSentence.level}
            label={currentSentence.level}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            {currentIndex + 1} / {filteredSentences.length}
          </Typography>
        </Box>

        <SentenceText>
          {renderSentenceWithTappableWords(currentSentence)}
        </SentenceText>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          {currentSentence.tags.map((tag) => (
            <TagChip key={tag} label={tag} size="small" />
          ))}
        </Box>

        {!showAnswer ? (
          <Button variant="contained" fullWidth onClick={handleRevealAnswer}>
            Reveal Answer
          </Button>
        ) : (
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              backgroundColor: 'action.hover',
            }}
          >
            <Typography variant="body1" fontWeight={500}>
              {currentSentence.english}
            </Typography>
          </Box>
        )}
      </Card>

      <NavigationBox>
        <IconButton onClick={goPrev} size="large">
          <KeyboardArrowLeft />
        </IconButton>
        <IconButton onClick={shuffleSentence}>
          <Shuffle />
        </IconButton>
        <IconButton onClick={goNext} size="large">
          <KeyboardArrowRight />
        </IconButton>
      </NavigationBox>
    </Container>
  );
}
