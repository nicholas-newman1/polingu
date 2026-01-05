import { Box, Card, Typography, styled } from '@mui/material';

const CardWrapper = styled(Box)({
  width: '100%',
  maxWidth: 420,
  margin: '0 auto',
});

const CardGlow = styled(Box)({
  position: 'absolute',
  inset: -12,
  borderRadius: 16,
  filter: 'blur(24px)',
  opacity: 0.2,
});

const PrimaryCardGlow = styled(CardGlow)({
  background: 'linear-gradient(135deg, #c23a22, #c9a227, #c23a22)',
});

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(3),
  backgroundColor: 'rgba(255,255,255,0.95)',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
}));

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <CardWrapper className="animate-fade-up">
      <Box sx={{ position: 'relative' }}>
        <PrimaryCardGlow />
        <StyledCard sx={{ p: { xs: 4, sm: 5 }, textAlign: 'center' }}>
          <Typography variant="h6" color="text.disabled">
            {message}
          </Typography>
        </StyledCard>
      </Box>
    </CardWrapper>
  );
}
