import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Fab, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Abc from '@mui/icons-material/Abc';
import TextSnippet from '@mui/icons-material/TextSnippet';
import { useLocation } from 'react-router-dom';
import { styled } from '../lib/styled';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useAddSentence } from '../hooks/useAddSentence';
import { useListening } from '../contexts/ListeningContext';
import { useAudioPlayerContext } from '../contexts/AudioPlayerContext';
import { getQuickAddBottomOffset } from '../lib/quickAddBottomOffset';

const SPRING_OUT = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const SPRING_SOFT = 'cubic-bezier(0.34, 1.4, 0.64, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

const SpeedDialBackdrop = styled(Box)<{ $open: boolean }>(({ theme, $open }) => ({
  position: 'fixed',
  inset: 0,
  zIndex: theme.zIndex.appBar + 3,
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(26, 22, 18, 0.18)',
  opacity: $open ? 1 : 0,
  pointerEvents: $open ? 'auto' : 'none',
  transition: 'opacity 200ms ease',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const SpeedDialRoot = styled(Box)<{ $bottomOffset: number }>(({ theme, $bottomOffset }) => ({
  position: 'fixed',
  right: `max(${theme.spacing(2)}, env(safe-area-inset-right))`,
  bottom: `calc(${$bottomOffset}px + ${theme.spacing(2)} + env(safe-area-inset-bottom))`,
  zIndex: theme.zIndex.appBar + 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  pointerEvents: 'none',
  transition: 'bottom 200ms ease',
  [theme.breakpoints.up('sm')]: {
    right: 24,
  },
}));

const ActionsStack = styled(Box)<{ $open: boolean }>(({ theme, $open }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1.5),
  pointerEvents: $open ? 'auto' : 'none',
}));

const ActionRow = styled(ButtonBase)<{ $open: boolean; $openDelay: number; $closeDelay: number }>(
  ({ theme, $open, $openDelay, $closeDelay }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    paddingRight: 6,
    borderRadius: 999,
    pointerEvents: $open ? 'auto' : 'none',
    opacity: $open ? 1 : 0,
    transform: $open ? 'translate3d(0, 0, 0) scale(1)' : 'translate3d(0, 18px, 0) scale(0.75)',
    transformOrigin: 'calc(100% - 28px) bottom',
    transition: $open
      ? `transform 240ms ${SPRING_SOFT} ${$openDelay}ms, opacity 180ms ease-out ${$openDelay}ms`
      : `transform 160ms ${EASE_IN} ${$closeDelay}ms, opacity 140ms ease-in ${$closeDelay}ms`,
    '&:hover .quick-add-action-circle': {
      transform: 'scale(1.06)',
    },
    '&:active .quick-add-action-circle': {
      transform: 'scale(0.95)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  })
);

const ActionLabel = styled(Typography)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[3],
  borderRadius: 10,
  padding: theme.spacing(0.75, 1.5),
  fontSize: '0.9rem',
  fontWeight: 500,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
}));

const ActionCircle = styled(Box)(({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.primary.main,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[4],
  transition: 'transform 160ms ease',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const RotatingAddIcon = styled(Add)<{ $open: boolean }>(({ $open }) => ({
  transform: $open ? 'rotate(45deg)' : 'rotate(0deg)',
  transition: `transform 260ms ${SPRING_OUT}`,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

export function QuickAddFab() {
  const addToVocabulary = useAddToVocabulary();
  const addSentence = useAddSentence();
  const { pathname } = useLocation();
  const { isActive, currentItem } = useListening();
  const { activeAudioId, audioItem } = useAudioPlayerContext();
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement | null>(null);

  const bottomOffset = getQuickAddBottomOffset({
    pathname,
    listeningBarShown: Boolean(isActive && currentItem),
    audioMiniPlayerShown: Boolean(activeAudioId && audioItem),
  });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleClose = () => setOpen(false);

  const handleAddVocabulary = () => {
    handleClose();
    addToVocabulary?.openAddToVocabulary('', '');
  };

  const handleAddSentence = () => {
    handleClose();
    addSentence?.openAddSentence();
  };

  const actions = [
    {
      label: 'Vocabulary',
      icon: <Abc fontSize="small" />,
      onClick: handleAddVocabulary,
    },
    {
      label: 'Sentence',
      icon: <TextSnippet fontSize="small" />,
      onClick: handleAddSentence,
    },
  ];

  return (
    <>
      <SpeedDialBackdrop $open={open} onClick={handleClose} aria-hidden="true" />
      <SpeedDialRoot $bottomOffset={bottomOffset}>
        <ActionsStack
          id="quick-add-menu"
          role="menu"
          aria-labelledby="quick-add-button"
          aria-hidden={!open}
          $open={open}
        >
          {actions.map((action, index) => {
            const reverseIndex = actions.length - 1 - index;
            return (
              <ActionRow
                key={action.label}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                onClick={action.onClick}
                $open={open}
                $openDelay={reverseIndex * 45}
                $closeDelay={index * 35}
              >
                <ActionLabel>{action.label}</ActionLabel>
                <ActionCircle className="quick-add-action-circle">{action.icon}</ActionCircle>
              </ActionRow>
            );
          })}
        </ActionsStack>

        <Fab
          ref={fabRef}
          id="quick-add-button"
          color="primary"
          aria-label={open ? 'Close quick add' : 'Quick add'}
          aria-controls="quick-add-menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          sx={{
            pointerEvents: 'auto',
            transition: 'transform 160ms ease, background-color 200ms ease, box-shadow 200ms ease',
            '&:active': {
              transform: 'scale(0.94)',
            },
          }}
        >
          <RotatingAddIcon $open={open} />
        </Fab>
      </SpeedDialRoot>
    </>
  );
}
