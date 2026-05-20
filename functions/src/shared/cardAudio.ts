import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { AudioType, synthesizeAndUploadAudio } from './audioTypes.js';

export type CardAudioStatus = 'generating' | 'ready' | 'error';

export interface CustomCardItem {
  id: string;
  audioUrl?: string;
  polish?: string;
  back?: string;
  [key: string]: unknown;
}

interface PerCardTriggerConfig {
  audioType: AudioType;
  getText: (item: CustomCardItem) => string;
}

export const PER_CARD_CONFIGS: Record<
  'customSentences' | 'customVocabulary' | 'customDeclension',
  PerCardTriggerConfig
> = {
  customSentences: { audioType: 'custom-sentence', getText: (i) => i.polish ?? '' },
  customVocabulary: { audioType: 'custom-vocabulary', getText: (i) => i.polish ?? '' },
  customDeclension: { audioType: 'custom-declension', getText: (i) => i.back ?? '' },
};

export async function handlePerCardWrite(
  collectionName: keyof typeof PER_CARD_CONFIGS,
  userId: string,
  cardId: string,
  before: CustomCardItem | undefined,
  after: CustomCardItem | undefined,
  afterRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  if (!after) return;

  const { getAuth } = await import('firebase-admin/auth');
  let isAdmin = false;
  try {
    const user = await getAuth().getUser(userId);
    isAdmin = !!user.customClaims?.admin;
  } catch (error) {
    console.warn(
      `onCustomCardWrite: Auth check failed for ${collectionName}/${cardId} (user ${userId}):`,
      error
    );
    return;
  }
  if (!isAdmin) return;

  const config = PER_CARD_CONFIGS[collectionName];
  const beforeText = before ? config.getText(before).trim() : '';
  const afterText = config.getText(after).trim();
  if (!afterText) return;

  const isCreate = !before;
  if (isCreate && after.audioUrl) return;
  if (!isCreate && beforeText === afterText) return;

  try {
    const audioUrl = await synthesizeAndUploadAudio(
      afterText,
      config.audioType,
      cardId,
      undefined,
      userId
    );
    if (!audioUrl) return;

    await afterRef.update({ audioUrl });
    console.log(`Generated audio for ${collectionName}/${cardId} (user ${userId})`);
  } catch (error) {
    console.error(
      `Failed to generate audio for ${collectionName}/${cardId} (user ${userId}):`,
      error
    );
  }
}

interface SystemCardAudioConfig {
  audioType: AudioType;
  getText: (data: FirebaseFirestore.DocumentData) => string;
}

export const SYSTEM_CARD_AUDIO_CONFIGS = {
  vocabulary: {
    audioType: 'vocabulary',
    getText: (d) => ((d.polish as string) ?? '').trim(),
  },
  sentences: {
    audioType: 'sentence',
    getText: (d) => ((d.polish as string) ?? '').trim(),
  },
  declensionCards: {
    audioType: 'declension',
    getText: (d) => ((d.back as string) ?? '').trim(),
  },
} satisfies Record<string, SystemCardAudioConfig>;

export type SystemCardCollection = keyof typeof SYSTEM_CARD_AUDIO_CONFIGS;

export async function handleSystemCardAudioWrite(
  collectionName: SystemCardCollection,
  docId: string,
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData | undefined
): Promise<void> {
  if (!after) return;

  const config = SYSTEM_CARD_AUDIO_CONFIGS[collectionName];
  const afterText = config.getText(after);
  if (!afterText) return;

  const isCreate = !before;
  const beforeText = before ? config.getText(before) : '';

  if (isCreate && (after.audioUrl as string | undefined)) return;
  if (!isCreate && beforeText === afterText) return;

  const docRef = db.collection(collectionName).doc(docId);

  try {
    await docRef.update({
      audioStatus: 'generating' satisfies CardAudioStatus,
      audioError: FieldValue.delete(),
    });
  } catch (error) {
    console.error(`Failed to mark ${collectionName}/${docId} generating:`, error);
  }

  try {
    const audioUrl = await synthesizeAndUploadAudio(afterText, config.audioType, docId);
    if (!audioUrl) throw new Error('TTS returned no audio content.');

    await docRef.update({
      audioUrl,
      audioStatus: 'ready' satisfies CardAudioStatus,
      audioError: FieldValue.delete(),
    });
    console.log(`Generated audio for ${collectionName}/${docId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audio generation failed';
    console.error(`Failed to generate audio for ${collectionName}/${docId}:`, error);
    try {
      await docRef.update({
        audioStatus: 'error' satisfies CardAudioStatus,
        audioError: message,
      });
    } catch (updateErr) {
      console.error(`Failed to record audio error for ${collectionName}/${docId}:`, updateErr);
    }
  }
}
