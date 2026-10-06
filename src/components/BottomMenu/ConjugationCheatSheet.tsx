import { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '../../lib/styled';
import { alpha } from '../../lib/theme';
import {
  CONJUGATION_PATTERNS,
  TENSE_INFO,
  ASPECT_INFO,
  PERSON_ENDINGS,
} from '../../data/conjugationPatterns';

const PatternCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: alpha(theme.palette.warning.main, 0.05),
  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
}));

const VerbClassChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.warning.main,
  color: theme.palette.common.white,
  fontWeight: 600,
  fontFamily: '"JetBrains Mono", monospace',
}));

const EndingCell = styled(TableCell)(({ theme }) => ({
  fontFamily: '"JetBrains Mono", monospace',
  fontWeight: 500,
  color: theme.palette.warning.dark,
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.background.paper, 0.7),
  '&:before': {
    display: 'none',
  },
  '&.Mui-expanded': {
    margin: 0,
  },
  marginBottom: theme.spacing(1),
}));

const ExampleBox = styled(Box)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.info.main, 0.08),
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1),
  borderLeft: `3px solid ${theme.palette.info.main}`,
  marginTop: theme.spacing(1),
}));

const AspectCard = styled(Paper)<{ $aspect: 'imperfective' | 'perfective' }>(
  ({ theme, $aspect }) => ({
    padding: theme.spacing(2),
    backgroundColor:
      $aspect === 'imperfective'
        ? alpha(theme.palette.info.main, 0.08)
        : alpha(theme.palette.success.main, 0.08),
    border: `1px solid ${
      $aspect === 'imperfective'
        ? alpha(theme.palette.info.main, 0.3)
        : alpha(theme.palette.success.main, 0.3)
    }`,
  })
);

const TwoColumnGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(2),
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
}));

const PERSONS = ['1st', '2nd', '3rd'];

interface NumberEndings {
  singular: string[];
  plural: string[];
}

function PersonEndingsTable({ endings, align }: { endings: NumberEndings; align?: 'center' }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell></TableCell>
          <TableCell align={align}>Singular</TableCell>
          <TableCell align={align}>Plural</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {PERSONS.map((person, idx) => (
          <TableRow key={person}>
            <TableCell>{person}</TableCell>
            <EndingCell align={align}>{endings.singular[idx]}</EndingCell>
            <EndingCell align={align}>{endings.plural[idx]}</EndingCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function GenderedEndings({
  endings,
}: {
  endings: { masculine: NumberEndings; feminine: NumberEndings };
}) {
  const columns = [
    { label: 'Masculine', color: 'primary.main', endings: endings.masculine },
    { label: 'Feminine', color: 'secondary.main', endings: endings.feminine },
  ];
  return (
    <TwoColumnGrid>
      {columns.map((column) => (
        <Box key={column.label}>
          <Typography variant="subtitle2" fontWeight={600} color={column.color} sx={{ mb: 1 }}>
            {column.label}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <PersonEndingsTable endings={column.endings} />
          </TableContainer>
        </Box>
      ))}
    </TwoColumnGrid>
  );
}

interface CheatSheetSectionProps {
  id: string;
  title: string;
  expanded: string | false;
  onExpandedChange: (panel: string | false) => void;
  children: React.ReactNode;
}

function CheatSheetSection({
  id,
  title,
  expanded,
  onExpandedChange,
  children,
}: CheatSheetSectionProps) {
  return (
    <StyledAccordion
      expanded={expanded === id}
      onChange={(_event, isExpanded) => onExpandedChange(isExpanded ? id : false)}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6" fontWeight={500}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </StyledAccordion>
  );
}

export function ConjugationCheatSheet() {
  const [expanded, setExpanded] = useState<string | false>('patterns');
  const sectionProps = { expanded, onExpandedChange: setExpanded };

  return (
    <Box>
      <CheatSheetSection
        id="patterns"
        title="Verb Classes & Present Tense Endings"
        {...sectionProps}
      >
        <TwoColumnGrid>
          {CONJUGATION_PATTERNS.map((pattern) => (
            <PatternCard key={pattern.verbClass} elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <VerbClassChip label={pattern.verbClass} size="small" />
                <Typography variant="body2" color="text.secondary">
                  {pattern.exampleVerb} — {pattern.exampleMeaning}
                </Typography>
              </Box>

              <TableContainer>
                <PersonEndingsTable endings={pattern.presentEndings} align="center" />
              </TableContainer>

              {pattern.notes && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  💡 {pattern.notes}
                </Typography>
              )}
            </PatternCard>
          ))}
        </TwoColumnGrid>
      </CheatSheetSection>

      <CheatSheetSection id="tenses" title="Tenses Overview" {...sectionProps}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TENSE_INFO.map((tense) => (
            <Box key={tense.tense}>
              <Typography variant="subtitle1" fontWeight={600} color="warning.main">
                {tense.tense}{' '}
                <Typography component="span" variant="body2" color="text.secondary">
                  ({tense.polishName})
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                <strong>Formation:</strong> {tense.formation}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Usage:</strong> {tense.usage}
              </Typography>
              <ExampleBox>
                {tense.examples.map((ex, idx) => (
                  <Typography
                    key={idx}
                    variant="body2"
                    sx={{ mb: idx < tense.examples.length - 1 ? 0.5 : 0 }}
                  >
                    <strong>{ex.polish}</strong> — {ex.english}
                  </Typography>
                ))}
              </ExampleBox>
            </Box>
          ))}
        </Box>
      </CheatSheetSection>

      <CheatSheetSection id="aspects" title="Aspect (Imperfective vs Perfective)" {...sectionProps}>
        <TwoColumnGrid>
          {ASPECT_INFO.map((aspect) => (
            <AspectCard
              key={aspect.aspect}
              $aspect={aspect.aspect.toLowerCase() as 'imperfective' | 'perfective'}
              elevation={0}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                color={aspect.aspect === 'Imperfective' ? 'info.main' : 'success.main'}
                sx={{ mb: 1 }}
              >
                {aspect.aspect}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {aspect.description}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {aspect.characteristics.map((char, idx) => (
                  <Typography key={idx} component="li" variant="body2" color="text.secondary">
                    {char}
                  </Typography>
                ))}
              </Box>
            </AspectCard>
          ))}
        </TwoColumnGrid>

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Common Aspect Pairs
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Imperfective</TableCell>
                  <TableCell>Perfective</TableCell>
                  <TableCell>Meaning</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ASPECT_INFO[0].examples.map((ex, idx) => (
                  <TableRow key={idx}>
                    <EndingCell>{ex.imperfective}</EndingCell>
                    <EndingCell>{ex.perfective}</EndingCell>
                    <TableCell>{ex.meaning}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </CheatSheetSection>

      <CheatSheetSection id="past" title="Past Tense Endings" {...sectionProps}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Past tense agrees with the <strong>gender</strong> of the subject. Remove the infinitive
          ending, add the past stem, then the personal ending.
        </Typography>

        <GenderedEndings endings={PERSON_ENDINGS.past} />

        <ExampleBox sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>pisać</strong> (to write) → pisa- →
          </Typography>
          <Typography variant="body2">
            pisał<strong>em</strong> (I wrote, masc.) | pisał
            <strong>am</strong> (I wrote, fem.)
          </Typography>
          <Typography variant="body2">
            pisał<strong>eś</strong> (you wrote, masc.) | pisał
            <strong>aś</strong> (you wrote, fem.)
          </Typography>
        </ExampleBox>
      </CheatSheetSection>

      <CheatSheetSection id="conditional" title="Conditional Mood Endings" {...sectionProps}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Conditional = past form + <strong>by</strong> + personal endings. Used for hypothetical
          situations and polite requests.
        </Typography>

        <GenderedEndings endings={PERSON_ENDINGS.conditional} />

        <ExampleBox sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>pisałbym</strong> — I would write (masc.)
          </Typography>
          <Typography variant="body2">
            <strong>pisałabym</strong> — I would write (fem.)
          </Typography>
          <Typography variant="body2">
            <strong>Chciałbym kawę</strong> — I would like coffee (polite)
          </Typography>
        </ExampleBox>
      </CheatSheetSection>
    </Box>
  );
}
