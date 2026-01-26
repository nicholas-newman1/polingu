import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { CEFRLevel } from '../types/sentences';

const functions = getFunctions(app);

export interface ProcessSentenceRequest {
  text: string;
  sourceLang: 'EN' | 'PL';
}

export interface ProcessSentenceResponse {
  polish: string;
  english: string;
  level: CEFRLevel;
}

const processSentenceFn = httpsCallable<ProcessSentenceRequest, ProcessSentenceResponse>(
  functions,
  'processSentence'
);

export async function processSentence(
  params: ProcessSentenceRequest
): Promise<ProcessSentenceResponse> {
  const result = await processSentenceFn(params);
  return result.data;
}

