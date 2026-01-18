import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AbcIcon from '@mui/icons-material/Abc';
import TranslateIcon from '@mui/icons-material/Translate';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import { useTranslationContext } from '../hooks/useTranslationContext';
import { useCheatSheetContext } from '../hooks/useCheatSheetContext';
import { alpha } from '../lib/theme';
import { DRAWER_WIDTH } from './Layout';

const MenuBarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(3),
  padding: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  // zIndex: theme.zIndex.drawer + 1,
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

const MenuButton = styled(ButtonBase)<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    borderRadius: theme.spacing(1),
    color: $disabled
      ? theme.palette.text.disabled
      : theme.palette.text.secondary,
    cursor: $disabled ? 'default' : 'pointer',
    '&:hover': $disabled
      ? {}
      : {
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.action.hover,
        },
  })
);

const IconWrapper = styled(Box)<{ $isActive?: boolean; $disabled?: boolean }>(
  ({ theme, $isActive, $disabled }) => ({
    backgroundColor: $isActive
      ? alpha(theme.palette.primary.main, 0.12)
      : theme.palette.grey[100],
    borderRadius: theme.spacing(1),
    padding: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: $disabled
      ? theme.palette.text.disabled
      : $isActive
      ? theme.palette.primary.main
      : 'inherit',
    opacity: $disabled ? 0.6 : 1,
  })
);

const Label = styled(Typography)({
  fontSize: '0.65rem',
  fontWeight: 500,
});

interface BottomMenuBarProps {
  showTranslator?: boolean;
}

export function BottomMenuBar({ showTranslator = true }: BottomMenuBarProps) {
  const { openTranslator, showTranslator: isTranslatorOpen } =
    useTranslationContext();
  const { openSheet, activeSheet } = useCheatSheetContext();

  const translatorButton = (
    <MenuButton
      onClick={showTranslator ? openTranslator : undefined}
      aria-label="Open translator"
      $disabled={!showTranslator}
      disabled={!showTranslator}
    >
      <IconWrapper $isActive={isTranslatorOpen} $disabled={!showTranslator}>
        <TranslateIcon fontSize="small" />
      </IconWrapper>
      <Label>Translate</Label>
    </MenuButton>
  );

  return (
    <MenuBarContainer>
      {showTranslator ? (
        translatorButton
      ) : (
        <Tooltip title="Sign in to use the translator" arrow>
          <span>{translatorButton}</span>
        </Tooltip>
      )}
      <MenuButton
        onClick={() => openSheet('declension')}
        aria-label="Open declension cheat sheet"
      >
        <IconWrapper $isActive={activeSheet === 'declension'}>
          <MenuBookIcon fontSize="small" />
        </IconWrapper>
        <Label>Declensions</Label>
      </MenuButton>
      <MenuButton
        onClick={() => openSheet('consonants')}
        aria-label="Open consonants cheat sheet"
      >
        <IconWrapper $isActive={activeSheet === 'consonants'}>
          <AbcIcon fontSize="small" />
        </IconWrapper>
        <Label>Consonants</Label>
      </MenuButton>
      <MenuButton
        onClick={() => openSheet('yi-rule')}
        aria-label="Open y/i rule cheat sheet"
      >
        <IconWrapper $isActive={activeSheet === 'yi-rule'}>
          <SpellcheckIcon fontSize="small" />
        </IconWrapper>
        <Label>-y/-i Rule</Label>
      </MenuButton>
    </MenuBarContainer>
  );
}
