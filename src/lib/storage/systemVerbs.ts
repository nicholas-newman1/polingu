import type { Verb } from '../../types/conjugation';
import { systemContent } from './systemContent';

const verbs = systemContent<Verb, string>('verbs');

export const updateVerb = verbs.update;
export const deleteVerb = verbs.delete;
