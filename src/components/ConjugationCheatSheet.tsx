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
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import {
  CONJUGATION_PATTERNS,
  TENSE_INFO,
  ASPECT_INFO,
  PERSON_ENDINGS,
} from '../data/conjugationPatterns';

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

export function ConjugationCheatSheet() {
  const [expanded, setExpanded] = useState<string | false>('patterns');

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box>
      <StyledAccordion expanded={expanded === 'patterns'} onChange={handleChange('patterns')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" fontWeight={500}>
            Verb Classes & Present Tense Endings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {CONJUGATION_PATTERNS.map((pattern) => (
              <PatternCard key={pattern.verbClass} elevation={0}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <VerbClassChip label={pattern.verbClass} size="small" />
                  <Typography variant="body2" color="text.secondary">
                    {pattern.exampleVerb} — {pattern.exampleMeaning}
                  </Typography>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell align="center">Singular</TableCell>
                        <TableCell align="center">Plural</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>1st</TableCell>
                        <EndingCell align="center">{pattern.presentEndings.singular[0]}</EndingCell>
                        <EndingCell align="center">{pattern.presentEndings.plural[0]}</EndingCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>2nd</TableCell>
                        <EndingCell align="center">{pattern.presentEndings.singular[1]}</EndingCell>
                        <EndingCell align="center">{pattern.presentEndings.plural[1]}</EndingCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>3rd</TableCell>
                        <EndingCell align="center">{pattern.presentEndings.singular[2]}</EndingCell>
                        <EndingCell align="center">{pattern.presentEndings.plural[2]}</EndingCell>
                      </TableRow>
                    </TableBody>
                  </Table>
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
          </Box>
        </AccordionDetails>
      </StyledAccordion>

      <StyledAccordion expanded={expanded === 'tenses'} onChange={handleChange('tenses')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" fontWeight={500}>
            Tenses Overview
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
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
        </AccordionDetails>
      </StyledAccordion>

      <StyledAccordion expanded={expanded === 'aspects'} onChange={handleChange('aspects')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" fontWeight={500}>
            Aspect (Imperfective vs Perfective)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
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
          </Box>

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
        </AccordionDetails>
      </StyledAccordion>

      <StyledAccordion expanded={expanded === 'past'} onChange={handleChange('past')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" fontWeight={500}>
            Past Tense Endings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Past tense agrees with the <strong>gender</strong> of the subject. Remove the infinitive
            ending, add the past stem, then the personal ending.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="primary.main" sx={{ mb: 1 }}>
                Masculine
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell>Singular</TableCell>
                      <TableCell>Plural</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {['1st', '2nd', '3rd'].map((person, idx) => (
                      <TableRow key={person}>
                        <TableCell>{person}</TableCell>
                        <EndingCell>{PERSON_ENDINGS.past.masculine.singular[idx]}</EndingCell>
                        <EndingCell>{PERSON_ENDINGS.past.masculine.plural[idx]}</EndingCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                color="secondary.main"
                sx={{ mb: 1 }}
              >
                Feminine
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell>Singular</TableCell>
                      <TableCell>Plural</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {['1st', '2nd', '3rd'].map((person, idx) => (
                      <TableRow key={person}>
                        <TableCell>{person}</TableCell>
                        <EndingCell>{PERSON_ENDINGS.past.feminine.singular[idx]}</EndingCell>
                        <EndingCell>{PERSON_ENDINGS.past.feminine.plural[idx]}</EndingCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>

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
        </AccordionDetails>
      </StyledAccordion>

      <StyledAccordion expanded={expanded === 'conditional'} onChange={handleChange('conditional')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" fontWeight={500}>
            Conditional Mood Endings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Conditional = past form + <strong>by</strong> + personal endings. Used for hypothetical
            situations and polite requests.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="primary.main" sx={{ mb: 1 }}>
                Masculine
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell>Singular</TableCell>
                      <TableCell>Plural</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {['1st', '2nd', '3rd'].map((person, idx) => (
                      <TableRow key={person}>
                        <TableCell>{person}</TableCell>
                        <EndingCell>
                          {PERSON_ENDINGS.conditional.masculine.singular[idx]}
                        </EndingCell>
                        <EndingCell>{PERSON_ENDINGS.conditional.masculine.plural[idx]}</EndingCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                color="secondary.main"
                sx={{ mb: 1 }}
              >
                Feminine
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell>Singular</TableCell>
                      <TableCell>Plural</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {['1st', '2nd', '3rd'].map((person, idx) => (
                      <TableRow key={person}>
                        <TableCell>{person}</TableCell>
                        <EndingCell>{PERSON_ENDINGS.conditional.feminine.singular[idx]}</EndingCell>
                        <EndingCell>{PERSON_ENDINGS.conditional.feminine.plural[idx]}</EndingCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>

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
        </AccordionDetails>
      </StyledAccordion>
    </Box>
  );
}
