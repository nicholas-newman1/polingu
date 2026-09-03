import { randomUUID } from 'crypto';
import { AUDIO_BUCKET, AUDIO_CONFIG, DEFAULT_BUCKET, TTS_VOICE } from './config.js';
import { db, storage } from './firebase.js';
import { getTtsClient } from './tts.js';

export type AudioType =
  | 'sentence'
  | 'declension'
  | 'vocabulary'
  | 'conjugation'
  | 'verb-infinitive'
  | 'custom-sentence'
  | 'custom-vocabulary'
  | 'custom-declension';

export function isCustomAudioType(type: AudioType): boolean {
  return type === 'custom-sentence' || type === 'custom-vocabulary' || type === 'custom-declension';
}

export function bucketForAudioType(type: AudioType): string {
  return isCustomAudioType(type) ? DEFAULT_BUCKET : AUDIO_BUCKET;
}

export function buildFirebaseDownloadUrl(bucket: string, filePath: string, token: string): string {
  const encoded = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media&token=${token}`;
}

export function getAudioPath(
  type: AudioType,
  id: string,
  subPath?: string,
  userId?: string
): string {
  switch (type) {
    case 'sentence':
      return `sentences/${id}.mp3`;
    case 'declension':
      return `declension/${id}.mp3`;
    case 'vocabulary':
      return `vocabulary/${id}.mp3`;
    case 'conjugation':
      return `conjugation/${subPath || id}.mp3`;
    case 'verb-infinitive':
      return `verb-infinitives/${id}.mp3`;
    case 'custom-sentence':
      return `audio/users/${userId}/cards/sentences/${id}.mp3`;
    case 'custom-vocabulary':
      return `audio/users/${userId}/cards/vocabulary/${id}.mp3`;
    case 'custom-declension':
      return `audio/users/${userId}/cards/declension/${id}.mp3`;
    default:
      throw new Error(`Unknown audio type: ${type}`);
  }
}

export async function updateFirestoreAudioUrl(
  type: AudioType,
  id: string,
  audioUrl: string,
  subPath?: string,
  userId?: string
): Promise<void> {
  switch (type) {
    case 'sentence':
      await db.collection('sentences').doc(id).update({ audioUrl });
      break;
    case 'declension':
      await db.collection('declensionCards').doc(id).update({ audioUrl });
      break;
    case 'vocabulary':
      await db.collection('vocabulary').doc(id).update({ audioUrl });
      break;
    case 'conjugation':
      if (subPath) {
        const parts = subPath.split('_');
        const verbId = parts[0];
        const tense = parts[1];
        const formKey = parts.slice(2).join('_');
        await db
          .collection('verbs')
          .doc(verbId)
          .update({ [`conjugations.${tense}.${formKey}.audioUrl`]: audioUrl });
      }
      break;
    case 'verb-infinitive':
      await db.collection('verbs').doc(id).update({ infinitiveAudioUrl: audioUrl });
      break;
    case 'custom-sentence':
      if (userId) {
        await db
          .collection('users')
          .doc(userId)
          .collection('customSentences')
          .doc(id)
          .update({ audioUrl });
      }
      break;
    case 'custom-vocabulary':
      if (userId) {
        await db
          .collection('users')
          .doc(userId)
          .collection('customVocabulary')
          .doc(id)
          .update({ audioUrl });
      }
      break;
    case 'custom-declension':
      if (userId) {
        await db
          .collection('users')
          .doc(userId)
          .collection('customDeclension')
          .doc(id)
          .update({ audioUrl });
      }
      break;
  }
}

export async function uploadAudioBuffer(
  audioBuffer: Buffer,
  audioType: AudioType,
  id: string,
  subPath?: string,
  userId?: string
): Promise<string> {
  const filePath = getAudioPath(audioType, id, subPath, userId);
  const bucketName = bucketForAudioType(audioType);
  const bucket = storage.bucket(bucketName);

  if (isCustomAudioType(audioType)) {
    const token = randomUUID();
    await bucket.file(filePath).save(audioBuffer, {
      contentType: 'audio/mpeg',
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    return buildFirebaseDownloadUrl(bucketName, filePath, token);
  }

  await bucket.file(filePath).save(audioBuffer, {
    contentType: 'audio/mpeg',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return `https://storage.googleapis.com/${bucketName}/${filePath}?v=${Date.now()}`;
}

export async function synthesizeAndUploadAudio(
  text: string,
  audioType: AudioType,
  id: string,
  subPath?: string,
  userId?: string
): Promise<string | null> {
  const [response] = await getTtsClient().synthesizeSpeech({
    input: { text },
    voice: TTS_VOICE,
    audioConfig: AUDIO_CONFIG,
  });

  if (!response.audioContent) return null;

  const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
  return uploadAudioBuffer(audioBuffer, audioType, id, subPath, userId);
}
