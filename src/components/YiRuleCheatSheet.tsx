import { Box, Typography, Tooltip } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

interface Example {
  singular: string;
  plural: string;
}

const CONSONANT_EXAMPLES: Record<string, Example[]> = {
  k: [
    { singular: 'ręka', plural: 'ręki' },
    { singular: 'książka', plural: 'książki' },
    { singular: 'matka', plural: 'matki' },
  ],
  g: [
    { singular: 'noga', plural: 'nogi' },
    { singular: 'droga', plural: 'drogi' },
    { singular: 'flaga', plural: 'flagi' },
  ],
  ć: [
    { singular: 'kość', plural: 'kości' },
    { singular: 'gość', plural: 'gości' },
    { singular: 'liść', plural: 'liści' },
  ],
  dź: [{ singular: 'gwóźdź', plural: 'gwoździ' }],
  ś: [
    { singular: 'część', plural: 'części' },
    { singular: 'miłość', plural: 'miłości' },
    { singular: 'radość', plural: 'radości' },
  ],
  ź: [],
  ń: [
    { singular: 'koń', plural: 'koni' },
    { singular: 'dłoń', plural: 'dłoni' },
    { singular: 'broń', plural: 'broni' },
  ],
  l: [
    { singular: 'sól', plural: 'soli' },
    { singular: 'fala', plural: 'fali' },
    { singular: 'szkoła', plural: 'szkoli' },
  ],
  j: [
    { singular: 'kolej', plural: 'kolei' },
    { singular: 'szyja', plural: 'szyi' },
    { singular: 'nadzieja', plural: 'nadziei' },
  ],
  ść: [
    { singular: 'młodość', plural: 'młodości' },
    { singular: 'starość', plural: 'starości' },
    { singular: 'słabość', plural: 'słabości' },
  ],
  źdź: [{ singular: 'gwóźdź', plural: 'gwoździ' }],
  śl: [
    { singular: 'myśl', plural: 'myśli' },
    { singular: 'motyl', plural: 'motyli' },
  ],
  śń: [
    { singular: 'wiśń', plural: 'wiśni' },
    { singular: 'pieśń', plural: 'pieśni' },
    { singular: 'baśń', plural: 'baśni' },
  ],
  źń: [
    { singular: 'przyjaźń', plural: 'przyjaźni' },
    { singular: 'łaźń', plural: 'łaźni' },
    { singular: 'woźń', plural: 'woźni' },
  ],
};

interface Tier {
  emoji: string;
  label: string;
  description: string;
  consonants: string[];
}

const TIERS: Tier[] = [
  {
    emoji: '🥇',
    label: 'Tier 1',
    description: 'Study hard — ~90% of cases',
    consonants: ['k', 'g', 'l', 'ń', 'ść', 'ś', 'j'],
  },
  {
    emoji: '🥈',
    label: 'Tier 2',
    description: 'Know them, less frequent',
    consonants: ['ć', 'śń', 'źń'],
  },
  {
    emoji: '🥉',
    label: 'Tier 3',
    description: 'Low-yield, recognize only',
    consonants: ['dź', 'źdź'],
  },
  {
    emoji: '💤',
    label: 'Tier 4',
    description: 'Rare, skip these',
    consonants: ['ź', 'śl'],
  },
];

const Container = styled(Box)({
  maxWidth: 360,
  margin: '0 auto',
});

const RuleCard = styled(Box)<{ $variant: 'i' | 'y' }>(({ theme, $variant }) => ({
  background: theme.palette.yiRule[$variant].gradient,
  borderRadius: 16,
  padding: '20px 24px',
  marginBottom: 16,
  boxShadow: `0 4px 20px ${alpha(theme.palette.yiRule[$variant].main, 0.3)}`,
}));

const RuleHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 16,
});

const EndingBadge = styled(Typography)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.common.white, 0.2),
  color: theme.palette.common.white,
  fontWeight: 700,
  fontSize: '1.5rem',
  fontFamily: '"JetBrains Mono", monospace',
  padding: '4px 16px',
  borderRadius: 8,
}));

const RuleLabel = styled(Typography)(({ theme }) => ({
  color: alpha(theme.palette.common.white, 0.9),
  fontWeight: 500,
  fontSize: '0.95rem',
}));

const TierSection = styled(Box)({
  marginBottom: 14,
  '&:last-child': {
    marginBottom: 0,
  },
});

const TierHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
});

const TierEmoji = styled(Typography)({
  fontSize: '1rem',
});

const TierLabel = styled(Typography)(({ theme }) => ({
  color: alpha(theme.palette.common.white, 0.95),
  fontWeight: 600,
  fontSize: '0.8rem',
}));

const TierDescription = styled(Typography)(({ theme }) => ({
  color: alpha(theme.palette.common.white, 0.6),
  fontSize: '0.7rem',
  marginLeft: 4,
}));

const ConsonantGrid = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

const ConsonantChip = styled(Box)<{ $hasExamples: boolean; $tier: number }>(
  ({ theme, $hasExamples, $tier }) => ({
    backgroundColor:
      $tier === 1
        ? alpha(theme.palette.common.white, 0.25)
        : $tier === 2
          ? alpha(theme.palette.common.white, 0.18)
          : $tier === 3
            ? alpha(theme.palette.common.white, 0.12)
            : alpha(theme.palette.common.white, 0.08),
    color: $tier <= 2 ? theme.palette.common.white : alpha(theme.palette.common.white, 0.7),
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: $tier === 1 ? 600 : 500,
    fontSize: $tier === 1 ? '1.1rem' : '1rem',
    padding: $tier === 1 ? '8px 14px' : '6px 12px',
    borderRadius: 6,
    cursor: $hasExamples ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    ...($hasExamples && {
      '&:hover': {
        backgroundColor: alpha(theme.palette.common.white, 0.35),
        transform: 'scale(1.05)',
      },
    }),
  })
);

const OtherwiseText = styled(Typography)(({ theme }) => ({
  color: alpha(theme.palette.common.white, 0.85),
  fontStyle: 'italic',
  fontSize: '0.9rem',
}));

const TooltipContent = styled(Box)({
  padding: 4,
});

const TooltipTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: '0.9rem',
  marginBottom: 8,
  fontFamily: '"JetBrains Mono", monospace',
});

const ExampleTable = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px 16px',
});

const ExampleHeader = styled(Typography)({
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  opacity: 0.7,
  fontWeight: 600,
});

const ExampleWord = styled(Typography)({
  fontSize: '0.85rem',
});

const NoExamplesText = styled(Typography)({
  fontSize: '0.8rem',
  fontStyle: 'italic',
  opacity: 0.8,
});

function ConsonantWithTooltip({ consonant, tier }: { consonant: string; tier: number }) {
  const examples = CONSONANT_EXAMPLES[consonant] || [];
  const hasExamples = examples.length > 0;

  const tooltipContent = hasExamples ? (
    <TooltipContent>
      <TooltipTitle>{consonant} → -i</TooltipTitle>
      <ExampleTable>
        <ExampleHeader>Singular</ExampleHeader>
        <ExampleHeader>Plural</ExampleHeader>
        {examples.map((ex) => (
          <>
            <ExampleWord key={`${ex.singular}-s`}>{ex.singular}</ExampleWord>
            <ExampleWord key={`${ex.plural}-p`}>{ex.plural}</ExampleWord>
          </>
        ))}
      </ExampleTable>
    </TooltipContent>
  ) : (
    <TooltipContent>
      <TooltipTitle>{consonant} → -i</TooltipTitle>
      <NoExamplesText>No common modern nouns with clean -i plural</NoExamplesText>
    </TooltipContent>
  );

  return (
    <Tooltip
      title={tooltipContent}
      arrow
      enterTouchDelay={0}
      leaveTouchDelay={3000}
      slotProps={{
        tooltip: {
          sx: (theme) => ({
            bgcolor: alpha(theme.palette.tooltip.main, 0.95),
            backdropFilter: 'blur(8px)',
            borderRadius: 2,
            boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.3)}`,
            p: 1.5,
          }),
        },
        arrow: {
          sx: (theme) => ({
            color: alpha(theme.palette.tooltip.main, 0.95),
          }),
        },
      }}
    >
      <ConsonantChip $hasExamples={hasExamples} $tier={tier}>
        {consonant}
      </ConsonantChip>
    </Tooltip>
  );
}

export function YiRuleCheatSheet() {
  return (
    <Container>
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          fontWeight: 500,
          color: 'text.primary',
          textAlign: 'center',
        }}
      >
        The -y / -i Ending Rule
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        When a declension ending is -y/i, choose based on the stem's final consonant. Tap a letter
        for examples.
      </Typography>

      <RuleCard $variant="i">
        <RuleHeader>
          <EndingBadge>-i</EndingBadge>
          <RuleLabel>Use when stem ends with:</RuleLabel>
        </RuleHeader>
        {TIERS.map((tier, tierIndex) => (
          <TierSection key={tier.label}>
            <TierHeader>
              <TierEmoji>{tier.emoji}</TierEmoji>
              <TierLabel>{tier.label}</TierLabel>
              <TierDescription>— {tier.description}</TierDescription>
            </TierHeader>
            <ConsonantGrid>
              {tier.consonants.map((consonant) => (
                <ConsonantWithTooltip key={consonant} consonant={consonant} tier={tierIndex + 1} />
              ))}
            </ConsonantGrid>
          </TierSection>
        ))}
      </RuleCard>

      <RuleCard $variant="y">
        <RuleHeader>
          <EndingBadge>-y</EndingBadge>
          <RuleLabel>Use in all other cases</RuleLabel>
        </RuleHeader>
        <OtherwiseText>When the stem ends with any consonant not listed above</OtherwiseText>
      </RuleCard>
    </Container>
  );
}
