import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Divider,
  Typography,
  Avatar,
  styled,
} from '@mui/material';
import { useAuthContext } from '../hooks/useAuthContext';
import { alpha } from '../lib/theme';

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
}));

const ContentWrapper = styled(Box)({
  width: '100%',
  maxWidth: 420,
});

const CardGlow = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: -12,
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
  borderRadius: 16,
  filter: 'blur(24px)',
  opacity: 0.2,
}));

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(4),
  textAlign: 'center',
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(6),
  },
}));

const LogoAvatar = styled(Avatar)(({ theme }) => ({
  width: 64,
  height: 64,
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  background: 'transparent',
  fontSize: '2rem',
  [theme.breakpoints.up('sm')]: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing(3),
    fontSize: '2.5rem',
  },
}));

const Title = styled(Typography)({
  fontWeight: 300,
  letterSpacing: '-0.02em',
});

const GoogleButton = styled(Button)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderColor: theme.palette.divider,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    backgroundColor: theme.palette.background.default,
    borderColor: theme.palette.text.disabled,
  },
  [theme.breakpoints.up('sm')]: {
    marginBottom: theme.spacing(3),
  },
}));

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function SignIn() {
  const { signInWithGoogle, user } = useAuthContext();
  const navigate = useNavigate();

  const handleSignIn = async () => {
    await signInWithGoogle();
    navigate('/dashboard');
  };

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  return (
    <PageContainer>
      <ContentWrapper className="animate-fade-up">
        <Box sx={{ position: 'relative' }}>
          <CardGlow className="card-glow" />
          <StyledCard>
            <LogoAvatar>🇵🇱</LogoAvatar>

            <Title variant="h4" color="text.primary" sx={{ mb: 1 }}>
              Polish Declension
            </Title>

            <Typography
              variant="body1"
              color="text.disabled"
              sx={{ mb: { xs: 4, sm: 5 } }}
            >
              Master noun & pronoun endings
              <br />
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                with spaced repetition
              </Typography>
            </Typography>

            <GoogleButton
              fullWidth
              size="large"
              variant="outlined"
              onClick={handleSignIn}
              startIcon={<GoogleIcon />}
            >
              Sign in with Google
            </GoogleButton>

            <Divider sx={{ my: { xs: 2, sm: 3 } }}>
              <Typography variant="body2" color="text.disabled">
                or
              </Typography>
            </Divider>

            <Button
              component={Link}
              to="/dashboard"
              fullWidth
              size="large"
              variant="contained"
              sx={{
                bgcolor: 'text.primary',
                '&:hover': { bgcolor: 'text.secondary' },
              }}
            >
              Continue as guest
            </Button>

            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ mt: { xs: 3, sm: 4 } }}
            >
              Guest progress is stored locally
              <br />
              and won't sync across devices
            </Typography>
          </StyledCard>
        </Box>
      </ContentWrapper>
    </PageContainer>
  );
}
