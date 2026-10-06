import { useCallback, useState } from 'react';
import {
  generateExample,
  type GeneratedExample,
  type GenerateExampleRequest,
} from '../lib/generateExample';
import { useSelectableList } from './useSelectableList';

interface UseGeneratedExamplesOptions {
  errorMessage: string;
  limit?: number;
}

/** AI example generation with loading/error state; results land in a selectable list. */
export function useGeneratedExamples({ errorMessage, limit }: UseGeneratedExamplesOptions) {
  const list = useSelectableList<GeneratedExample>();
  const { show, clear } = list;
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (request: GenerateExampleRequest) => {
      setIsGenerating(true);
      setError(null);
      clear();
      try {
        const { examples } = await generateExample(request);
        show(examples.slice(0, limit));
      } catch (err) {
        console.error('Failed to generate examples:', err);
        setError(errorMessage);
      } finally {
        setIsGenerating(false);
      }
    },
    [clear, show, errorMessage, limit]
  );

  const reset = useCallback(() => {
    clear();
    setError(null);
    setIsGenerating(false);
  }, [clear]);

  return { ...list, isGenerating, error, generate, reset };
}
