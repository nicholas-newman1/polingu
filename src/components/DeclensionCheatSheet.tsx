import { useState } from 'react';
import { Box, Typography, Tooltip, Popover, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '../lib/styled';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { DeclensionTable, DeclensionEnding } from '../data/declensionPatterns';
import { alpha } from '../lib/theme';

const TableContainer = styled(Box)<{
  $gender: 'masculine' | 'feminine' | 'neuter';
}>(({ theme, $gender }) => ({
  background: theme.palette.gender[$gender].gradient,
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: `0 4px 20px ${alpha(theme.palette.gender[$gender].main, 0.3)}`,
}));

const TableHeader = styled(Box)<{
  $gender: 'masculine' | 'feminine' | 'neuter';
}>(({ theme, $gender }) => ({
  background: `linear-gradient(180deg, ${theme.palette.gender[$gender].dark} 0%, ${alpha(theme.palette.gender[$gender].dark, 0.85)} 100%)`,
  padding: theme.spacing(1.5, 2),
  textAlign: 'center',
}));

const TableTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
}));

const TableBody = styled(Box)({});

const TableRow = styled(Box)<{ $isLast?: boolean }>(({ theme, $isLast }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: $isLast ? 'none' : `2px dashed ${alpha(theme.palette.common.white, 0.25)}`,
  minHeight: 48,
}));

const CaseName = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  fontWeight: 400,
  width: 95,
  flexShrink: 0,
  fontSize: '0.85rem',
}));

const EndingsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  flexWrap: 'wrap',
});

const EndingWrapper = styled(Box)<{ $clickable?: boolean }>(({ $clickable }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: '4px 8px',
  cursor: $clickable ? 'pointer' : 'default',
  '&:hover .ending-text': $clickable
    ? {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
      }
    : {},
}));

const EndingInner = styled(Box)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
});

const EndingText = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  fontWeight: 600,
  fontSize: '1rem',
  fontFamily: '"JetBrains Mono", monospace',
}));

const FootnoteBadge = styled(Box)<{ $clickable?: boolean }>(({ theme, $clickable }) => ({
  position: 'absolute',
  top: -2,
  right: -14,
  width: 16,
  height: 16,
  borderRadius: '50%',
  backgroundColor: alpha(theme.palette.common.white, 0.25),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.common.white,
  cursor: $clickable ? 'pointer' : 'default',
  '& svg': {
    fontSize: 12,
  },
}));

const OrDivider = styled(Typography)(({ theme }) => ({
  color: alpha(theme.palette.common.white, 0.7),
  fontSize: '0.85rem',
  fontStyle: 'italic',
  flexShrink: 0,
}));

const TooltipContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  maxWidth: 280,
}));

interface EndingItemProps {
  ending: DeclensionEnding;
  isMobile: boolean;
  tableFootnotes: Record<number, string>;
  gender: 'masculine' | 'feminine' | 'neuter';
}

function EndingItem({ ending, isMobile, tableFootnotes, gender }: EndingItemProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (ending.footnotes?.length && isMobile) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const hasFootnotes = ending.footnotes && ending.footnotes.length > 0;
  const footnoteTexts = hasFootnotes
    ? ending.footnotes!.map((id) => tableFootnotes[id]).filter(Boolean)
    : [];

  const theme = useTheme();
  const tooltipBgColor = alpha(theme.palette.gender[gender].main, 0.95);

  const content = (
    <EndingWrapper onClick={handleClick} $clickable={hasFootnotes}>
      <EndingInner>
        <EndingText className="ending-text">{ending.text}</EndingText>
        {hasFootnotes && (
          <FootnoteBadge $clickable={isMobile}>
            <InfoOutlinedIcon />
          </FootnoteBadge>
        )}
      </EndingInner>
    </EndingWrapper>
  );

  if (!hasFootnotes) {
    return content;
  }

  if (isMobile) {
    return (
      <>
        {content}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              },
            },
          }}
        >
          <TooltipContent>
            {footnoteTexts.map((text, idx) => (
              <Typography
                key={idx}
                variant="body2"
                sx={{ mb: idx < footnoteTexts.length - 1 ? 1 : 0 }}
              >
                {text}
              </Typography>
            ))}
          </TooltipContent>
        </Popover>
      </>
    );
  }

  return (
    <Tooltip
      title={
        <Box>
          {footnoteTexts.map((text, idx) => (
            <Typography
              key={idx}
              variant="body2"
              sx={{ mb: idx < footnoteTexts.length - 1 ? 1 : 0 }}
            >
              {text}
            </Typography>
          ))}
        </Box>
      }
      arrow
      placement="top"
      slotProps={{
        tooltip: {
          sx: {
            backgroundColor: tooltipBgColor,
            color: theme.palette.common.white,
            fontSize: '0.85rem',
            padding: '8px 12px',
            maxWidth: 280,
            borderRadius: 2,
          },
        },
        arrow: {
          sx: {
            color: tooltipBgColor,
          },
        },
      }}
    >
      {content}
    </Tooltip>
  );
}

interface CheatSheetTableProps {
  table: DeclensionTable;
}

export function DeclensionCheatSheetTable({ table }: CheatSheetTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <TableContainer $gender={table.gender}>
      <TableHeader $gender={table.gender}>
        <TableTitle variant="h6">{table.title}</TableTitle>
      </TableHeader>
      <TableBody>
        {table.rows.map((row, rowIndex) => (
          <TableRow key={row.case} $isLast={rowIndex === table.rows.length - 1}>
            <CaseName>{row.case}</CaseName>
            <EndingsContainer>
              {row.endings.flatMap((ending, endingIndex) => {
                const items = [];
                if (endingIndex > 0) {
                  items.push(<OrDivider key={`or-${endingIndex}`}>or</OrDivider>);
                }
                items.push(
                  <EndingItem
                    key={endingIndex}
                    ending={ending}
                    isMobile={isMobile}
                    tableFootnotes={table.footnotes}
                    gender={table.gender}
                  />
                );
                return items;
              })}
            </EndingsContainer>
          </TableRow>
        ))}
      </TableBody>
    </TableContainer>
  );
}

interface DeclensionCheatSheetProps {
  tables: DeclensionTable[];
}

export function DeclensionCheatSheet({ tables }: DeclensionCheatSheetProps) {
  const singularTables = tables.filter((t) => t.number === 'singular');
  const pluralTables = tables.filter((t) => t.number === 'plural');

  return (
    <Box>
      {singularTables.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            sx={{
              mb: 2,
              fontWeight: 500,
              color: 'text.primary',
              textAlign: 'center',
            }}
          >
            Singular
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {singularTables.map((table) => (
              <DeclensionCheatSheetTable key={`${table.gender}-${table.number}`} table={table} />
            ))}
          </Box>
        </Box>
      )}

      {pluralTables.length > 0 && (
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
            Plural
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {pluralTables.map((table) => (
              <DeclensionCheatSheetTable key={`${table.gender}-${table.number}`} table={table} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
