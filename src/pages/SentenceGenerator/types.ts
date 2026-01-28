import type { CEFRLevel, Sentence, TagCategory } from '../../types/sentences';
import type { SentenceTagsData } from '../../lib/storage/sentenceTags';

export type SnackbarSeverity = 'success' | 'error' | 'info' | 'warning';

export interface BaseTabProps {
  sentences: Sentence[];
  setSentences: (sentences: Sentence[]) => void;
  sentenceTags: SentenceTagsData;
  showSnackbar: (message: string, severity: SnackbarSeverity) => void;
}

export interface GenerateTabProps extends BaseTabProps {
  addSentenceTag: (category: TagCategory, tag: string) => Promise<void>;
}

export type BrowseTabProps = BaseTabProps;

export interface CurriculumTabProps {
  sentenceTags: SentenceTagsData;
  addSentenceTag: (category: TagCategory, tag: string) => Promise<void>;
  showSnackbar: (message: string, severity: SnackbarSeverity) => void;
  onGenerateFromSuggestion: (level: CEFRLevel, tag: string) => void;
}

export type AddCustomTabProps = BaseTabProps;
