import { Box, Typography } from '@mui/material';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

const BlockBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  border: `1px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.05),
  color: theme.palette.text.secondary,
}));

export function HiddenPolishPlaceholder() {
  return (
    <BlockBox>
      <HeadphonesIcon fontSize="small" />
      <Typography variant="body2" fontStyle="italic">
        Listen to the audio
      </Typography>
    </BlockBox>
  );
}
