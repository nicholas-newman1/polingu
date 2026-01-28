import { Box, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

const CONSONANT_PAIRS: { hard: string; soft: string }[] = [
  { hard: 'm', soft: 'mi' },
  { hard: 'b', soft: 'bi' },
  { hard: 'p', soft: 'pi' },
  { hard: 'w', soft: 'wi' },
  { hard: 'f', soft: 'fi' },
  { hard: 'n', soft: 'ń/ni' },
  { hard: 'd', soft: 'dź/dzi' },
  { hard: 't', soft: 'ć/ci' },
  { hard: 'z', soft: 'ź/zi' },
  { hard: 's', soft: 'ś/si' },
  { hard: 'ł', soft: 'l' },
  { hard: 'r', soft: 'rz' },
  { hard: 'g/gi', soft: 'dz' },
  { hard: 'k/ki', soft: 'c' },
  { hard: 'h/hi', soft: 'ż' },
  { hard: 'ch/chi', soft: 'sz' },
  { hard: '', soft: 'dż' },
  { hard: '', soft: 'cz' },
  { hard: '', soft: 'j' },
];

const TableContainer = styled(Box)(({ theme }) => ({
  background: theme.palette.consonants.gradient,
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: `0 4px 20px ${alpha(theme.palette.consonants.main, 0.3)}`,
  maxWidth: 320,
  margin: '0 auto',
}));

const TableHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(180deg, ${theme.palette.consonants.dark} 0%, ${alpha(theme.palette.consonants.dark, 0.85)} 100%)`,
  padding: theme.spacing(1.5, 2),
  display: 'flex',
}));

const HeaderCell = styled(Typography)(({ theme }) => ({
  flex: 1,
  color: theme.palette.common.white,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textAlign: 'center',
  fontSize: '0.9rem',
}));

const TableBody = styled(Box)({});

const TableRow = styled(Box)<{ $isLast?: boolean }>(({ theme, $isLast }) => ({
  display: 'flex',
  borderBottom: $isLast ? 'none' : `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
}));

const Cell = styled(Box)<{ $isEmpty?: boolean }>(({ theme, $isEmpty }) => ({
  flex: 1,
  padding: '12px 16px',
  textAlign: 'center',
  backgroundColor: $isEmpty ? alpha(theme.palette.common.black, 0.1) : 'transparent',
}));

const ConsonantText = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  fontWeight: 500,
  fontSize: '1.1rem',
  fontFamily: '"JetBrains Mono", monospace',
}));

export function ConsonantsCheatSheet() {
  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          fontWeight: 500,
          color: 'text.primary',
          textAlign: 'center',
        }}
      >
        Hard and Soft Consonants
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 3, textAlign: 'center', maxWidth: 400, mx: 'auto' }}
      >
        Hard consonants soften before certain endings. This table shows corresponding hard/soft
        pairs.
      </Typography>
      <TableContainer>
        <TableHeader>
          <HeaderCell>Hard</HeaderCell>
          <HeaderCell>Soft</HeaderCell>
        </TableHeader>
        <TableBody>
          {CONSONANT_PAIRS.map((pair, index) => (
            <TableRow key={index} $isLast={index === CONSONANT_PAIRS.length - 1}>
              <Cell $isEmpty={!pair.hard}>
                <ConsonantText>{pair.hard || '—'}</ConsonantText>
              </Cell>
              <Cell>
                <ConsonantText>{pair.soft}</ConsonantText>
              </Cell>
            </TableRow>
          ))}
        </TableBody>
      </TableContainer>
    </Box>
  );
}
