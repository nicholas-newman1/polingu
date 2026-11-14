import { useState } from 'react';
import { Fab, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Add, Abc, TextSnippet } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useAddSentence } from '../hooks/useAddSentence';
import { useListening } from '../contexts/ListeningContext';
import { useAudioPlayerContext } from '../contexts/AudioPlayerContext';
import { BOTTOM_MENU_BAR_HEIGHT } from '../constants/layout';
import { LISTENING_MINI_BAR_HEIGHT } from './ListeningMiniBar';
import { MINI_PLAYER_HEIGHT } from './MiniPlayerBar';

export function QuickAddFab() {
  const addToVocabulary = useAddToVocabulary();
  const addSentence = useAddSentence();
  const { pathname } = useLocation();
  const { isActive, currentItem } = useListening();
  const { activeAudioId, audioItem } = useAudioPlayerContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const listeningBarHeight =
    isActive && currentItem && pathname !== '/listen/play' ? LISTENING_MINI_BAR_HEIGHT : 0;
  const audioBarHeight =
    pathname === '/audio' && activeAudioId && audioItem ? MINI_PLAYER_HEIGHT : 0;
  const bottomOffset = BOTTOM_MENU_BAR_HEIGHT + Math.max(listeningBarHeight, audioBarHeight);

  const handleClose = () => setAnchorEl(null);

  const handleAddVocabulary = () => {
    handleClose();
    addToVocabulary?.openAddToVocabulary('', '');
  };

  const handleAddSentence = () => {
    handleClose();
    addSentence?.openAddSentence();
  };

  return (
    <>
      <Fab
        id="quick-add-button"
        color="primary"
        aria-label="Quick add"
        aria-controls={open ? 'quick-add-menu' : undefined}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={(theme) => ({
          position: 'fixed',
          right: { xs: `max(${theme.spacing(2)}, env(safe-area-inset-right))`, sm: 24 },
          bottom: `calc(${bottomOffset}px + ${theme.spacing(2)} + env(safe-area-inset-bottom))`,
          zIndex: theme.zIndex.appBar + 3,
        })}
      >
        <Add />
      </Fab>
      <Menu
        id="quick-add-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { minWidth: 180, mt: -1 } },
          list: { 'aria-labelledby': 'quick-add-button' },
        }}
      >
        <MenuItem onClick={handleAddVocabulary}>
          <ListItemIcon>
            <Abc fontSize="small" />
          </ListItemIcon>
          <ListItemText>Vocabulary</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddSentence}>
          <ListItemIcon>
            <TextSnippet fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sentence</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
