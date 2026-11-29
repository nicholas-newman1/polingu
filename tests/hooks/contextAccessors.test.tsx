import type { Context, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { AuthContext, useAuthContext } from '../../src/contexts/AuthContext';
import { SnackbarContext, useSnackbar } from '../../src/contexts/SnackbarContext';
import { CheatSheetContext, useCheatSheetContext } from '../../src/contexts/CheatSheetContext';
import { ColorModeContext, useColorMode } from '../../src/contexts/ColorModeContext';
import { TranslationContext, useTranslationContext } from '../../src/contexts/TranslationContext';
import { AddSentenceContext, useAddSentence } from '../../src/contexts/AddSentenceContext';
import {
  AddToVocabularyContext,
  useAddToVocabulary,
} from '../../src/contexts/AddToVocabularyContext';
import {
  TranslatableTextActionsContext,
  TranslatableTextUIContext,
  useTranslatableTextActions,
  useTranslatableTextUI,
} from '../../src/contexts/TranslatableTextContext';

// The add-sentence and add-word modals import modules that connect to Firebase Functions
// as soon as they load (translation, audio generation). Nothing here calls a function.
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

beforeEach(() => {
  // React reports the error thrown by a hook used outside its provider; keep the log quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** A hook that reads one context, and that context. */
function accessor<T>(name: string, useHook: () => T, context: Context<T | null>) {
  return {
    name,
    renderOutside: () => renderHook(useHook),
    /** Renders inside the context with a marker value, and returns what the hook gave back. */
    readInside: () => {
      const value = { provided: name } as unknown as NonNullable<T>;
      const wrapper = ({ children }: { children: ReactNode }) => (
        <context.Provider value={value}>{children}</context.Provider>
      );
      return { value, returned: renderHook(useHook, { wrapper }).result.current };
    },
  };
}

const required = [
  {
    ...accessor('useAuthContext', useAuthContext, AuthContext),
    error: 'useAuthContext must be used within an AuthProvider',
  },
  {
    ...accessor('useSnackbar', useSnackbar, SnackbarContext),
    error: 'useSnackbar must be used within a SnackbarProvider',
  },
  {
    ...accessor('useCheatSheetContext', useCheatSheetContext, CheatSheetContext),
    error: 'useCheatSheetContext must be used within a CheatSheetProvider',
  },
  {
    ...accessor('useColorMode', useColorMode, ColorModeContext),
    error: 'useColorMode must be used within ColorModeProvider',
  },
  {
    ...accessor('useTranslationContext', useTranslationContext, TranslationContext),
    error: 'useTranslationContext must be used within a TranslationProvider',
  },
  {
    ...accessor(
      'useTranslatableTextActions',
      useTranslatableTextActions,
      TranslatableTextActionsContext
    ),
    error: 'useTranslatableTextActions must be used within a TranslatableTextProvider',
  },
  {
    ...accessor('useTranslatableTextUI', useTranslatableTextUI, TranslatableTextUIContext),
    error: 'useTranslatableTextUI must be used within a TranslatableTextProvider',
  },
];

// Components using these also render outside the providers (e.g. text in a modal), and
// hide the related feature when the hook returns null.
const optional = [
  accessor('useAddSentence', useAddSentence, AddSentenceContext),
  accessor('useAddToVocabulary', useAddToVocabulary, AddToVocabularyContext),
];

describe('context accessor hooks', () => {
  test.each(required)(
    '$name throws a clear error outside its provider',
    ({ renderOutside, error }) => {
      expect(renderOutside).toThrow(error);
    }
  );

  test.each([...required, ...optional])("$name returns its provider's value", ({ readInside }) => {
    const { value, returned } = readInside();
    expect(returned).toBe(value);
  });

  test.each(optional)('$name returns null outside its provider', ({ renderOutside }) => {
    expect(renderOutside().result.current).toBeNull();
  });
});
