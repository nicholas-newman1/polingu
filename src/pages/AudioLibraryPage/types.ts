import type { AudioItem, SystemAudioItem } from '../../types/audio';

export type MergedItem =
  | (AudioItem & { source: 'user' })
  | (SystemAudioItem & { source: 'system' });

export function tagUserItems(items: AudioItem[]): MergedItem[] {
  return items.map((i) => ({ ...i, source: 'user' as const }));
}

export function tagSystemItems(items: SystemAudioItem[]): MergedItem[] {
  return items.map((i) => ({ ...i, source: 'system' as const }));
}
