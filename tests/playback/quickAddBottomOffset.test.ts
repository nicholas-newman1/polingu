import { describe, expect, test } from 'vitest';
import { getQuickAddBottomOffset } from '../../src/lib/quickAddBottomOffset';
import { AUDIO_PLAYER_CONTROLS_HEIGHT, BOTTOM_MENU_BAR_HEIGHT } from '../../src/constants/layout';
import { MINI_BAR_HEIGHT } from '../../src/components/audioStyles';

const offset = (
  pathname: string,
  { listening = false, audio = false }: { listening?: boolean; audio?: boolean } = {}
) =>
  getQuickAddBottomOffset({ pathname, listeningBarShown: listening, audioMiniPlayerShown: audio });

describe('Quick add button position', () => {
  test('sits just above the bottom menu when nothing else is docked', () => {
    expect(offset('/dashboard')).toBe(BOTTOM_MENU_BAR_HEIGHT);
  });

  test('clears the audio player controls on the player page', () => {
    expect(offset('/audio/player')).toBe(BOTTOM_MENU_BAR_HEIGHT + AUDIO_PLAYER_CONTROLS_HEIGHT);
    expect(offset('/audio/player', { listening: true })).toBe(
      BOTTOM_MENU_BAR_HEIGHT + AUDIO_PLAYER_CONTROLS_HEIGHT
    );
  });

  test('clears the audio mini player only on the audio library', () => {
    expect(offset('/audio', { audio: true })).toBe(BOTTOM_MENU_BAR_HEIGHT + MINI_BAR_HEIGHT);
    expect(offset('/dashboard', { audio: true })).toBe(BOTTOM_MENU_BAR_HEIGHT);
  });

  test('clears the listening mini bar, except on the listening player itself', () => {
    expect(offset('/dashboard', { listening: true })).toBe(
      BOTTOM_MENU_BAR_HEIGHT + MINI_BAR_HEIGHT
    );
    expect(offset('/listen/play', { listening: true })).toBe(BOTTOM_MENU_BAR_HEIGHT);
  });
});
