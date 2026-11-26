import { useCallback, useRef, useState } from 'react';
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

/**
 * AI example generation with loading/error state; results land in a selectable list.
 * Only the latest request counts: starting a new one or calling reset() discards the
 * result, error and progress of any request still in flight.
 */
export function useGeneratedExamples({ errorMessage, limit }: UseGeneratedExamplesOptions) {
  const list = useSelectableList<GeneratedExample>();
  const { show, clear } = list;
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const generate = useCallback(
    async (request: GenerateExampleRequest) => {
      const requestId = ++latestRequestRef.current;
      const isLatest = () => requestId === latestRequestRef.current;
      setIsGenerating(true);
      setError(null);
      clear();
      try {
        const { examples } = await generateExample(request);
        if (isLatest()) show(examples.slice(0, limit));
      } catch (err) {
        console.error('Failed to generate examples:', err);
        if (isLatest()) setError(errorMessage);
      } finally {
        if (isLatest()) setIsGenerating(false);
      }
    },
    [clear, show, errorMessage, limit]
  );

  const reset = useCallback(() => {
    latestRequestRef.current++;
    clear();
    setError(null);
    setIsGenerating(false);
  }, [clear]);

  return { ...list, isGenerating, error, generate, reset };
}
