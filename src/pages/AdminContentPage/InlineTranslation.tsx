import { Typography } from '@mui/material';

export function InlineTranslation({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <Typography variant="body2" fontWeight={500} noWrap>
      {primary}
      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
        — {secondary}
      </Typography>
    </Typography>
  );
}
