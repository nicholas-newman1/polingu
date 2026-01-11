import { Box, ButtonBase, Typography, styled } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import TranslateIcon from '@mui/icons-material/Translate';

const MenuBarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(3),
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(8px)',
  borderTop: '1px solid rgba(0, 0, 0, 0.08)',
}));

const MenuButton = styled(ButtonBase)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1),
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.text.primary,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const Label = styled(Typography)({
  fontSize: '0.65rem',
  fontWeight: 500,
});

interface BottomMenuBarProps {
  onOpenCheatSheet: () => void;
  onOpenTranslator: () => void;
  showTranslator?: boolean;
}

export function BottomMenuBar({
  onOpenCheatSheet,
  onOpenTranslator,
  showTranslator = true,
}: BottomMenuBarProps) {
  return (
    <MenuBarContainer>
      {showTranslator && (
        <MenuButton onClick={onOpenTranslator} aria-label="Open translator">
          <IconWrapper>
            <TranslateIcon fontSize="small" />
          </IconWrapper>
          <Label>Translate</Label>
        </MenuButton>
      )}
      <MenuButton onClick={onOpenCheatSheet} aria-label="Open noun cheat sheet">
        <IconWrapper>
          <MenuBookIcon fontSize="small" />
        </IconWrapper>
        <Label>Noun Rules</Label>
      </MenuButton>
    </MenuBarContainer>
  );
}
