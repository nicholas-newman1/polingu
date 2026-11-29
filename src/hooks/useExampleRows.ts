import { useRef } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { usePolishEnglishAutoTranslate } from './usePolishEnglishAutoTranslate';
import type { ExampleSentence } from '../types/vocabulary';

export interface ExampleRowsFormValues {
  examples: ExampleSentence[];
}

/**
 * A form's `examples` array as editable rows, each auto-translating between its Polish
 * and English. Call `translation.cancelAll()` when the form is reset.
 */
export function useExampleRows<T extends ExampleRowsFormValues>(
  form: Pick<UseFormReturn<T>, 'control' | 'getValues' | 'setValue'>
) {
  // react-hook-form can't resolve literal paths against an unresolved generic form type.
  const { control, getValues, setValue } = form as unknown as Pick<
    UseFormReturn<ExampleRowsFormValues>,
    'control' | 'getValues' | 'setValue'
  >;
  const { fields, append, remove } = useFieldArray({ control, name: 'examples' });
  const translation = usePolishEnglishAutoTranslate<number>({
    getPolish: (index) => getValues(`examples.${index}.polish`),
    getEnglish: (index) => getValues(`examples.${index}.english`),
    onPolishTranslated: (index, polish) => setValue(`examples.${index}.polish`, polish),
    onEnglishTranslated: (index, english) => setValue(`examples.${index}.english`, english),
  });
  const newRowPolishRef = useRef<HTMLInputElement>(null);

  const addEmptyRow = () => {
    append({ id: crypto.randomUUID(), polish: '', english: '' });
    setTimeout(() => {
      newRowPolishRef.current?.focus();
    }, 0);
  };

  const removeRow = (index: number) => {
    // Rows are keyed by index, so removing one would shift pending translations onto other rows.
    translation.cancelAll();
    remove(index);
  };

  return { control, fields, append, addEmptyRow, removeRow, translation, newRowPolishRef };
}

export type ExampleRows = ReturnType<typeof useExampleRows>;
