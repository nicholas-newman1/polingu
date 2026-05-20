import { protos } from '@google-cloud/text-to-speech';

export const AUDIO_BUCKET = 'polingu-audio';
export const DEFAULT_BUCKET = 'polish-declension.firebasestorage.app';

export const AUDIO_CONFIG: protos.google.cloud.texttospeech.v1.IAudioConfig = {
  audioEncoding: 'MP3',
};

export const TTS_VOICE = {
  languageCode: 'pl-PL',
  name: 'pl-PL-Wavenet-B',
};

export const TTS_BYTE_LIMIT = 3500;
