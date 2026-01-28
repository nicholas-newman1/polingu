import { Box, Typography, Chip, Button, TextField, FormControl, Paper } from '@mui/material';
import { styled } from '../../lib/styled';
import { alpha } from '../../lib/theme';

export const PageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
});

export const HeaderSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(3),
  flexWrap: 'wrap',
  gap: theme.spacing(2),
}));

export const TitleGroup = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const LoadingContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 200,
});

export const EmptyContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: theme.spacing(6),
  minHeight: 300,
}));

export const FiltersRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  flexWrap: 'wrap',
}));

export const SearchField = styled(TextField)(({ theme }) => ({
  minWidth: 240,
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.paper,
  },
}));

export const FilterSelect = styled(FormControl)(({ theme }) => ({
  minWidth: 140,
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.paper,
  },
}));

export const StyledTableContainer = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'auto',
  '& .MuiTableCell-head': {
    backgroundColor: alpha(theme.palette.text.primary, 0.02),
    fontWeight: 600,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  '& .MuiTableCell-body': {
    fontSize: '0.95rem',
  },
  '& .MuiTableRow-root:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.02),
  },
}));

export const PrimaryCell = styled(Typography)({
  fontWeight: 600,
});

export const TruncatedCell = styled(Typography)({
  fontWeight: 600,
  maxWidth: 300,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const SecondaryCell = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.85rem',
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

export const ActionCell = styled(Box)({
  display: 'flex',
  gap: 4,
});

export const MetaChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.text.primary, 0.06),
  color: theme.palette.text.secondary,
}));

export const AddButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
}));

export const CountBadge = styled(Typography)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  borderRadius: 20,
  padding: theme.spacing(0.5, 1.5),
  fontSize: '0.85rem',
  fontWeight: 600,
  minWidth: 32,
}));
