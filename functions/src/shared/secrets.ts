import { defineSecret } from 'firebase-functions/params';

export const deeplApiKey = defineSecret('DEEPL_API_KEY');
export const openaiApiKey = defineSecret('OPENAI_API_KEY');
