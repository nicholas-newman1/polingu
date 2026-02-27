export type BookColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink';

export const BOOK_COLORS: Record<BookColor, { main: string; light: string }> = {
  red: { main: '#c23a22', light: '#d45a42' },
  orange: { main: '#ea580c', light: '#f97316' },
  amber: { main: '#ca8a04', light: '#eab308' },
  green: { main: '#2d6a4f', light: '#40916c' },
  teal: { main: '#0f766e', light: '#14b8a6' },
  blue: { main: '#2a6f97', light: '#468faf' },
  indigo: { main: '#4f46e5', light: '#6366f1' },
  purple: { main: '#6b4c9a', light: '#8b5cf6' },
  pink: { main: '#be185d', light: '#ec4899' },
};

export interface Book {
  id: string;
  userId: string;
  title: string;
  author?: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf';
  storagePath: string;
  uploadedAt: number;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  pageCount?: number;
  color?: BookColor;
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  scrollPercent: number;
  lastReadAt: number;
  bookmarks?: number[];
}

export interface UploadProgress {
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadPercent?: number;
  error?: string;
  bookId?: string;
}
