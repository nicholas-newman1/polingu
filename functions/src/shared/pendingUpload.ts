import type { StorageObjectData } from 'firebase-functions/storage';

interface PendingUpload {
  filePath: string;
  userId: string;
  itemId: string;
  fileName: string;
  contentType: string | undefined;
  fileSize: number;
}

/** Parses `{folder}/users/{userId}/pending/{itemId}/{fileName}`; null for any other path. */
export function parsePendingUpload(data: StorageObjectData, folder: string): PendingUpload | null {
  const match = data.name.match(new RegExp(`^${folder}/users/([^/]+)/pending/([^/]+)/(.+)$`));
  if (!match) return null;

  const [, userId, itemId, fileName] = match;
  const fileSize = typeof data.size === 'string' ? parseInt(data.size, 10) : data.size;
  return { filePath: data.name, userId, itemId, fileName, contentType: data.contentType, fileSize };
}
