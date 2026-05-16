import { Box, Typography } from '@mui/material';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

type Variant = 'inline' | 'block';

interface HiddenPolishPlaceholderProps {
  variant?: Variant;
  label?: string;
}

const InlineBox = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.25, 1),
  borderRadius: theme.spacing(0.75),
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
  fontSize: '0.9em',
}));

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

export function HiddenPolishPlaceholder({
  variant = 'block',
  label = 'Listen to the audio',
}: HiddenPolishPlaceholderProps) {
  if (variant === 'inline') {
    return (
      <InlineBox>
        <HeadphonesIcon fontSize="inherit" />
        <span>{label}</span>
      </InlineBox>
    );
  }

  return (
    <BlockBox>
      <HeadphonesIcon fontSize="small" />
      <Typography variant="body2" fontStyle="italic">
        {label}
      </Typography>
    </BlockBox>
  );
}
