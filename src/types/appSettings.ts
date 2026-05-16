export type TranscriptFontSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  autoPlayAudio: boolean;
  hidePolishText: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoPlayAudio: true,
  hidePolishText: false,
};
