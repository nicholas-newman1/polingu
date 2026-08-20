import { db } from './firebase.js';

export const MAX_FILE_SIZE_BOOKS = 50 * 1024 * 1024;
export const MAX_USER_STORAGE = 1024 * 1024 * 1024;

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

export const BOOK_COLORS: BookColor[] = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
];

export interface BookMetadata {
  id: string;
  userId: string;
  title: string;
  author?: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'text';
  storagePath: string;
  uploadedAt: number;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  pageCount?: number;
  wordCount?: number;
  color?: BookColor;
}

export async function getUnusedColor(userId: string): Promise<BookColor> {
  const booksSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('books')
    .where('status', '==', 'ready')
    .get();

  const colorCounts = new Map<BookColor, number>();
  BOOK_COLORS.forEach((c) => colorCounts.set(c, 0));

  booksSnapshot.forEach((doc) => {
    const book = doc.data() as BookMetadata;
    if (book.color && colorCounts.has(book.color)) {
      colorCounts.set(book.color, (colorCounts.get(book.color) || 0) + 1);
    }
  });

  const minCount = Math.min(...colorCounts.values());
  const leastUsed = BOOK_COLORS.filter((c) => colorCounts.get(c) === minCount);
  return leastUsed[Math.floor(Math.random() * leastUsed.length)];
}

export async function getUserStorageUsage(userId: string): Promise<number> {
  const booksSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('books')
    .where('status', '==', 'ready')
    .get();

  let totalSize = 0;
  booksSnapshot.forEach((doc) => {
    const book = doc.data() as BookMetadata;
    totalSize += book.fileSize || 0;
  });

  return totalSize;
}

export interface ExtractedPdfMetadata {
  title: string;
  author?: string;
  pageCount: number;
}

export async function extractPdfMetadata(buffer: Buffer): Promise<ExtractedPdfMetadata> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let title = 'Untitled';
  let author: string | undefined;

  try {
    const metadata = await pdf.getMetadata();
    if (metadata?.info) {
      const info = metadata.info as Record<string, unknown>;
      if (typeof info.Title === 'string' && info.Title.trim()) {
        title = info.Title.trim();
      }
      if (typeof info.Author === 'string' && info.Author.trim()) {
        author = info.Author.trim();
      }
    }
  } catch {
    // Metadata extraction failed, use defaults
  }

  return {
    title,
    author,
    pageCount: pdf.numPages,
  };
}

export interface ExtractedTextMetadata {
  title: string;
  wordCount: number;
}

export function extractTextMetadata(buffer: Buffer): ExtractedTextMetadata {
  const text = buffer.toString('utf-8');
  if (text.includes('\uFFFD')) {
    throw new Error('Invalid text encoding. Please use UTF-8.');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Text file is empty.');
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  const title = firstLine.length > 0 && firstLine.length <= 100 ? firstLine : 'Untitled';

  return { title, wordCount };
}
