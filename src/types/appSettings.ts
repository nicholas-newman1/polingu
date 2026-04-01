export type TranscriptFontSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  autoPlayAudio: boolean;
  transcriptFontSize: TranscriptFontSize;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoPlayAudio: true,
  transcriptFontSize: 'large',
};
