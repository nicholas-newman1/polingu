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
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  scrollPercent: number;
  lastReadAt: number;
}

export interface UploadProgress {
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadPercent?: number;
  error?: string;
  bookId?: string;
}
