import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { CEFRLevel } from '../types/sentences';

const functions = getFunctions(app);

export interface GeneratedSentence {
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
}

export interface GenerateSentencesRequest {
  level: CEFRLevel;
  tags: string[];
  count: number;
  guidance?: string;
}

export interface GenerateSentencesResponse {
  sentences: GeneratedSentence[];
}

const generateSentencesFn = httpsCallable<
  GenerateSentencesRequest,
  GenerateSentencesResponse
>(functions, 'generateSentences');

export async function generateSentences(
  params: GenerateSentencesRequest
): Promise<GenerateSentencesResponse> {
  const result = await generateSentencesFn(params);
  return result.data;
}

export interface CurriculumSuggestion {
  tag: string;
  category: 'topics' | 'grammar' | 'style';
  priority: 'high' | 'medium' | 'low';
  explanation: string;
  exampleConcepts: string[];
  relevantLevels: CEFRLevel[];
}

export interface CurriculumDiscoveryRequest {
  mode: 'grammar' | 'topics' | 'polish-specific' | 'freeform';
  level?: CEFRLevel;
  freeformQuestion?: string;
  existingTags: {
    topics: string[];
    grammar: string[];
    style: string[];
  };
}

export interface CurriculumDiscoveryResponse {
  suggestions: CurriculumSuggestion[];
}

const discoverCurriculumFn = httpsCallable<
  CurriculumDiscoveryRequest,
  CurriculumDiscoveryResponse
>(functions, 'discoverCurriculum');

export async function discoverCurriculum(
  params: CurriculumDiscoveryRequest
): Promise<CurriculumDiscoveryResponse> {
  const result = await discoverCurriculumFn(params);
  return result.data;
}

