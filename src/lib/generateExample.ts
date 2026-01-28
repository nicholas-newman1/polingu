import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export interface GenerateExampleRequest {
  polish: string;
  english: string;
  partOfSpeech?: string;
  gender?: string;
  context?: string;
}

export interface GeneratedExample {
  polish: string;
  english: string;
  meaning?: string;
}

export interface GenerateExampleResponse {
  examples: GeneratedExample[];
}

const generateExampleFn = httpsCallable<GenerateExampleRequest, GenerateExampleResponse>(
  functions,
  'generateExample'
);

export async function generateExample(
  params: GenerateExampleRequest
): Promise<GenerateExampleResponse> {
  const result = await generateExampleFn(params);
  return result.data;
}
