import { getCurrentUserId } from '../cachedAuth';
import { uploadPendingAndAwait } from '../media/storageFiles';
import type { UploadProgress } from '../media/storageFiles';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const PROCESSING_TIMEOUT = 5 * 60 * 1000;

async function uploadFileToPending(
  file: File,
  onProgress: (progress: UploadProgress) => void,
  customMetadata: Record<string, string>
): Promise<string> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 50MB.');
  }

  return uploadPendingAndAwait({
    file,
    pendingFolder: `books/users/${userId}/pending`,
    itemCollection: ['users', userId, 'books'],
    customMetadata,
    timeoutMs: PROCESSING_TIMEOUT,
    onProgress,
  });
}

export interface UploadBookParams {
  title?: string;
  author?: string;
}

export async function uploadBook(
  file: File,
  onProgress: (progress: UploadProgress) => void,
  params?: UploadBookParams
): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Only PDF files are supported.');
  }

  const title = params?.title?.trim();
  const author = params?.author?.trim();

  return uploadFileToPending(file, onProgress, {
    ...(title && { booktitle: title }),
    ...(author && { bookauthor: author }),
  });
}

export interface UploadTextParams {
  content: string;
  title?: string;
  author?: string;
}

export async function uploadText(
  params: UploadTextParams,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  const trimmed = params.content.trim();
  if (!trimmed) {
    throw new Error('Text cannot be empty.');
  }

  const title = params.title?.trim();
  const author = params.author?.trim();

  const blob = new Blob([trimmed], { type: 'text/plain;charset=utf-8' });
  const file = new File([blob], 'book.txt', { type: 'text/plain' });

  return uploadFileToPending(file, onProgress, {
    ...(title && { booktitle: title }),
    ...(author && { bookauthor: author }),
  });
}
