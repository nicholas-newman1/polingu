import { Box, Card, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../../../lib/styled';

const UploadCard = styled(Card)(({ theme }) => ({
  border: `2px dashed ${theme.palette.divider}`,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

const UploadContent = styled(Box)(({ theme }) => ({
  height: 180,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  [theme.breakpoints.up('sm')]: {
    height: 220,
  },
}));

interface AddBookCardProps {
  onClick: () => void;
}

export function AddBookCard({ onClick }: AddBookCardProps) {
  return (
    <UploadCard onClick={onClick}>
      <UploadContent>
        <AddIcon sx={{ fontSize: 40 }} />
        <Typography variant="body2">Add Book</Typography>
        <Typography variant="caption" color="text.disabled">
          PDF or paste text
        </Typography>
      </UploadContent>
    </UploadCard>
  );
}
