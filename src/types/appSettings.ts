export type TranscriptFontSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  autoPlayAudio: boolean;
  hidePolishText: boolean;
  dashboardOrder?: string[];
  suggestExamplesAfterAddingWord: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoPlayAudio: true,
  hidePolishText: false,
  suggestExamplesAfterAddingWord: true,
};
