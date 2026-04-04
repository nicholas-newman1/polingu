export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
}

export interface AudioItem {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  duration: number;
  fileSize: number;
  storagePath: string;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  transcript: TranscriptSegment[];
  createdAt: number;
}

export interface SystemAudioItem {
  id: string;
  title: string;
  text: string;
  storagePath: string;
  duration: number;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  transcript: TranscriptSegment[];
  createdAt: number;
}

export interface AudioUploadProgress {
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadPercent?: number;
  error?: string;
  audioId?: string;
}

export interface AudioQueue {
  currentTrackId: string | null;
  userQueue: string[];
  autoQueue: string[];
  history: string[];
  savedTime: number;
  updatedAt: number;
}
