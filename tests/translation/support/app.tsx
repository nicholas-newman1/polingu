/**
 * Renders translation UI inside the app's theme and the contexts it reads, and
 * drives it the way a learner does: taps, mouse drags, and touch long-presses.
 *
 * The add-to-vocabulary and add-sentence contexts are replaced by recorders: the
 * tests check what the translation UI hands them, not the modals they open.
 */
import type { ReactElement, ReactNode } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import type { User } from 'firebase/auth';
import { createAppTheme } from '../../../src/lib/theme';
import { AuthContext } from '../../../src/contexts/AuthContext';
import { AddToVocabularyContext } from '../../../src/contexts/AddToVocabularyContext';
import { AddSentenceContext } from '../../../src/contexts/AddSentenceContext';
import { withSnackbar } from '../../hooks/support/providers';

interface AppOptions {
  isAdmin?: boolean;
  /** Whether the add-to-vocabulary feature is available (it is inside the app layout). */
  vocabulary?: boolean;
  /** Whether the add-sentence feature is available (it is inside the app layout). */
  sentences?: boolean;
}

const theme = createAppTheme('light');

export function renderInApp(
  ui: ReactElement,
  { isAdmin = false, vocabulary = true, sentences = true }: AppOptions = {}
) {
  const { wrapper: Snackbar, showSnackbar } = withSnackbar();
  const openAddToVocabulary = vi.fn<(polish: string, english: string) => void>();
  const openAddSentence = vi.fn<(values?: { polish?: string; english?: string }) => void>();
  const vocabularyValue = vocabulary ? { openAddToVocabulary } : null;
  const sentenceValue = sentences ? { openAddSentence } : null;
  const user = { uid: 'learner', email: 'learner@example.com' } as User;

  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider theme={theme}>
        <AuthContext.Provider
          value={{
            user,
            loading: false,
            isAdmin,
            signInWithGoogle: async () => {},
            signOut: async () => {},
          }}
        >
          <Snackbar>
            <AddToVocabularyContext.Provider value={vocabularyValue}>
              <AddSentenceContext.Provider value={sentenceValue}>
                {children}
              </AddSentenceContext.Provider>
            </AddToVocabularyContext.Provider>
          </Snackbar>
        </AuthContext.Provider>
      </ThemeProvider>
    );
  }

  const view = render(ui, { wrapper: Providers });
  return { ...view, showSnackbar, openAddToVocabulary, openAddSentence };
}

/** Lets pending promises (fake server answers) settle and React commit the result. */
export const settle = () => act(async () => {});

/**
 * Waits one real macrotask. Tooltips start listening for outside presses on the
 * next tick, so the tap that opened them does not close them again.
 */
export const nextTick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** Runs timers that are due within `ms` (fake timers must be on). */
export const elapse = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

/** A mouse tap on a word: press, release, click. */
export function tap(el: Element) {
  fireEvent.mouseDown(el, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.mouseUp(el, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.click(el, { button: 0, clientX: 5, clientY: 5 });
}

/** A press anywhere outside the tooltips and words (they close on mousedown/touchstart). */
export function pressOutside() {
  fireEvent.mouseDown(document.body);
}

/**
 * Presses the mouse on `from`, moves far enough to start a selection, sweeps over
 * `through` (in order), and releases on the last word swept.
 */
export function mouseDrag(from: Element, ...through: Element[]) {
  fireEvent.mouseDown(from, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 20, clientY: 0 });
  for (const el of through) fireEvent.mouseEnter(el);
  fireEvent.mouseUp(through.at(-1) ?? from);
}

interface Point {
  clientX: number;
  clientY: number;
}

/** Dispatches a touch event with the given touch points (jsdom has no Touch constructor). */
export function touch(target: EventTarget, type: string, points: Point[]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: points });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/**
 * Makes document.elementFromPoint (missing in jsdom) report `el` under the finger.
 * Returns a cleanup function.
 */
export function fingerOver(el: () => Element | null) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => el(),
  });
  return () => {
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  };
}

/** Installs navigator.clipboard (missing in jsdom). Returns the writeText mock and a cleanup. */
export function stubClipboard(writeText = vi.fn<(text: string) => Promise<void>>(async () => {})) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return {
    writeText,
    restore: () => {
      delete (navigator as { clipboard?: unknown }).clipboard;
    },
  };
}
