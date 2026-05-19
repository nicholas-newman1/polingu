import { useState } from 'react';
import {
  Box,
  ButtonBase,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '../../lib/styled';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AbcIcon from '@mui/icons-material/Abc';
import TranslateIcon from '@mui/icons-material/Translate';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { useCheatSheetContext } from '../../hooks/useCheatSheetContext';
import { alpha } from '../../lib/theme';
import { DRAWER_WIDTH } from '../Layout';

export const BOTTOM_MENU_BAR_HEIGHT = 77;

const MenuBarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar + 2,
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(3),
  padding: `0 ${theme.spacing(1.5)}`,
  paddingTop: theme.spacing(0.5),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up('md')]: { left: DRAWER_WIDTH },
}));

const MenuButton = styled(ButtonBase)<{ $disabled?: boolean }>(({ theme, $disabled }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1),
  color: $disabled ? theme.palette.text.disabled : theme.palette.text.secondary,
  cursor: $disabled ? 'default' : 'pointer',
  '&:hover': $disabled
    ? {}
    : {
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.action.hover,
      },
}));

const IconWrapper = styled(Box)<{ $isActive?: boolean; $disabled?: boolean }>(
  ({ theme, $isActive, $disabled }) => ({
    backgroundColor: $isActive
      ? alpha(theme.palette.primary.main, 0.12)
      : theme.palette.action.hover,
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

const CHEAT_SHEETS = [
  { key: 'declension', label: 'Declensions', icon: MenuBookIcon },
  { key: 'consonants', label: 'Consonants', icon: AbcIcon },
  { key: 'yi-rule', label: '-y/-i Rule', icon: SpellcheckIcon },
  { key: 'conjugation', label: 'Conjugations', icon: AutoStoriesIcon },
] as const;

interface BottomMenuBarProps {
  showTranslator?: boolean;
}

export function BottomMenuBar({ showTranslator = true }: BottomMenuBarProps) {
  const { openTranslator, showTranslator: isTranslatorOpen } = useTranslationContext();
  const { openSheet, activeSheet } = useCheatSheetContext();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const isCheatSheetOpen = CHEAT_SHEETS.some((sheet) => sheet.key === activeSheet);
  const menuOpen = Boolean(menuAnchor);

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleSelectSheet = (sheetKey: (typeof CHEAT_SHEETS)[number]['key']) => {
    openSheet(sheetKey);
    handleCloseMenu();
  };

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

  const versionLabel = __BUILD_VERSION__ === 'dev' ? 'dev' : `v${__BUILD_VERSION__}`;
  const commitLabel = __COMMIT_SHA__ === 'local' ? '' : __COMMIT_SHA__.slice(0, 7);

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
        onClick={handleOpenMenu}
        aria-label="Open cheat sheets"
        aria-controls={menuOpen ? 'cheat-sheets-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
      >
        <IconWrapper $isActive={isCheatSheetOpen || menuOpen}>
          <LibraryBooksIcon fontSize="small" />
        </IconWrapper>
        <Label>Cheat Sheets</Label>
      </MenuButton>

      <Tooltip title={commitLabel ? `Commit: ${commitLabel}` : ''} arrow>
        <Typography
          sx={{
            position: 'absolute',
            bottom: 4,
            right: 8,
            fontSize: '0.55rem',
            color: 'text.disabled',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {versionLabel}
        </Typography>
      </Tooltip>

      <Menu
        id="cheat-sheets-menu"
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              mb: 1,
              minWidth: 180,
            },
          },
        }}
      >
        {CHEAT_SHEETS.map(({ key, label, icon: Icon }) => (
          <MenuItem key={key} onClick={() => handleSelectSheet(key)} selected={activeSheet === key}>
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </MenuBarContainer>
  );
}
