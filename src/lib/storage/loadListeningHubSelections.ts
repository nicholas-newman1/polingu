import type { ListeningHubSelections, ListeningFeature } from '../../types/listening';
import { DEFAULT_LISTENING_HUB_SELECTIONS } from '../../types/listening';
import type { TranslationDirection } from '../../types/common';
import type { CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { loadUserData } from '../offlineDb/userDataWrapper';

const DOC_PATH = 'listeningHubSelections';

const VALID_FEATURES: ListeningFeature[] = ['sentences', 'vocabulary', 'declension'];
const VALID_DIRECTIONS: TranslationDirection[] = ['en-to-pl', 'pl-to-en'];

function normalize(raw: unknown): ListeningHubSelections {
  const obj = (raw ?? {}) as Partial<ListeningHubSelections>;
  const feature =
    typeof obj.feature === 'string' && VALID_FEATURES.includes(obj.feature as ListeningFeature)
      ? (obj.feature as ListeningFeature)
      : DEFAULT_LISTENING_HUB_SELECTIONS.feature;
  const direction =
    typeof obj.direction === 'string' &&
    VALID_DIRECTIONS.includes(obj.direction as TranslationDirection)
      ? (obj.direction as TranslationDirection)
      : DEFAULT_LISTENING_HUB_SELECTIONS.direction;
  const selectedLevels = Array.isArray(obj.selectedLevels)
    ? (obj.selectedLevels.filter((l): l is CEFRLevel =>
        (ALL_LEVELS as readonly string[]).includes(l as string)
      ) as CEFRLevel[])
    : [...DEFAULT_LISTENING_HUB_SELECTIONS.selectedLevels];
  return {
    feature,
    direction,
    selectedLevels:
      selectedLevels.length > 0
        ? selectedLevels
        : [...DEFAULT_LISTENING_HUB_SELECTIONS.selectedLevels],
  };
}

export async function loadListeningHubSelections(): Promise<ListeningHubSelections> {
  return loadUserData(DOC_PATH, DEFAULT_LISTENING_HUB_SELECTIONS, normalize);
}

export { DOC_PATH as LISTENING_HUB_SELECTIONS_DOC_PATH };
