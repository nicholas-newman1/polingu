import { useState } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  Popover,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type {
  DeclensionTable,
  DeclensionEnding,
} from '../data/declensionPatterns';

const TableContainer = styled(Box)<{
  $gender: 'masculine' | 'feminine' | 'neuter';
}>(({ $gender }) => {
  let background, boxShadow;
  if ($gender === 'feminine') {
    background = 'linear-gradient(180deg, #d45a42 0%, #c23a22 100%)';
    boxShadow = '0 4px 20px rgba(194, 58, 34, 0.3)';
  } else if ($gender === 'neuter') {
    background = 'linear-gradient(180deg, #52b883 0%, #40916c 100%)';
    boxShadow = '0 4px 20px rgba(64, 145, 108, 0.3)';
  } else {
    background = 'linear-gradient(180deg, #4a9ede 0%, #3b82c4 100%)';
    boxShadow = '0 4px 20px rgba(59, 130, 196, 0.3)';
  }
  return {
    background,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow,
  };
});

const TableHeader = styled(Box)<{
  $gender: 'masculine' | 'feminine' | 'neuter';
}>(({ $gender, theme }) => {
  let background;
  if ($gender === 'feminine') {
    background = 'linear-gradient(180deg, #a03018 0%, #8b2815 100%)';
  } else if ($gender === 'neuter') {
    background = 'linear-gradient(180deg, #40916c 0%, #2d6a4f 100%)';
  } else {
    background = 'linear-gradient(180deg, #2d6aa0 0%, #245a88 100%)';
  }
  return {
    background,
    padding: theme.spacing(1.5, 2),
    textAlign: 'center',
  };
});

const TableTitle = styled(Typography)({
  color: '#ffffff',
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
});

const TableBody = styled(Box)({});

const TableRow = styled(Box)<{ $isLast?: boolean }>(({ $isLast }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: $isLast ? 'none' : '2px dashed rgba(255, 255, 255, 0.25)',
  minHeight: 48,
}));

const CaseName = styled(Typography)({
  color: '#ffffff',
  fontWeight: 400,
  width: 95,
  flexShrink: 0,
  fontSize: '0.85rem',
});

const EndingsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  flexWrap: 'wrap',
});

const EndingWrapper = styled(Box)<{ $clickable?: boolean }>(
  ({ $clickable }) => ({
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
  })
);

const EndingInner = styled(Box)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
});

const EndingText = styled(Typography)({
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '1rem',
  fontFamily: '"JetBrains Mono", monospace',
});

const FootnoteBadge = styled(Box)<{ $clickable?: boolean }>(
  ({ $clickable }) => ({
    position: 'absolute',
    top: -2,
    right: -14,
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    cursor: $clickable ? 'pointer' : 'default',
    '& svg': {
      fontSize: 12,
    },
  })
);

const OrDivider = styled(Typography)({
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '0.85rem',
  fontStyle: 'italic',
  flexShrink: 0,
});

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

function EndingItem({
  ending,
  isMobile,
  tableFootnotes,
  gender,
}: EndingItemProps) {
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

  const tooltipBgColor =
    gender === 'feminine'
      ? 'rgba(194, 58, 34, 0.95)'
      : gender === 'neuter'
      ? 'rgba(64, 145, 108, 0.95)'
      : 'rgba(45, 106, 160, 0.95)';

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
            color: '#ffffff',
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

export function CheatSheetTable({ table }: CheatSheetTableProps) {
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
                  items.push(
                    <OrDivider key={`or-${endingIndex}`}>or</OrDivider>
                  );
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

interface CheatSheetProps {
  tables: DeclensionTable[];
}

export function CheatSheet({ tables }: CheatSheetProps) {
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
              <CheatSheetTable
                key={`${table.gender}-${table.number}`}
                table={table}
              />
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
              <CheatSheetTable
                key={`${table.gender}-${table.number}`}
                table={table}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
