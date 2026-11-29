import { AUDIO_PLAYER_CONTROLS_HEIGHT, BOTTOM_MENU_BAR_HEIGHT } from '../constants/layout';
import { MINI_BAR_HEIGHT } from '../components/audioStyles';

/** How far above the bottom of the screen the button sits, so it clears whatever bar is docked there. */
export function getQuickAddBottomOffset({
  pathname,
  listeningBarShown,
  audioMiniPlayerShown,
}: {
  pathname: string;
  listeningBarShown: boolean;
  audioMiniPlayerShown: boolean;
}): number {
  const listeningBarHeight = listeningBarShown && pathname !== '/listen/play' ? MINI_BAR_HEIGHT : 0;
  const audioBarHeight = pathname === '/audio' && audioMiniPlayerShown ? MINI_BAR_HEIGHT : 0;
  const playerControlsHeight = pathname === '/audio/player' ? AUDIO_PLAYER_CONTROLS_HEIGHT : 0;
  return (
    BOTTOM_MENU_BAR_HEIGHT + Math.max(listeningBarHeight, audioBarHeight, playerControlsHeight)
  );
}
