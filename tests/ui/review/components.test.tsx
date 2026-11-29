/**
 * Review components whose behaviour the page tests cannot reach: the translation
 * limit dialog (rendered by the app layout), the direction toggle, and the empty
 * deck card in dark mode.
 */
import { useState, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { click, elapse, setupReviewUi, until } from './support/app';
import { withAuth } from '../../hooks/support/providers';
import { createAppTheme } from '../../../src/lib/theme';
import {
  TranslationProvider,
  useTranslationContext,
} from '../../../src/contexts/TranslationContext';
import { LimitReachedDialog } from '../../../src/components/LimitReachedDialog';
import { DirectionToggle } from '../../../src/components/DirectionToggle';
import { EmptyState } from '../../../src/components/EmptyState';

import type { TranslationDirection } from '../../../src/types/common';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

const MINUTE = 60_000;
const theme = createAppTheme('light');

function TranslatorButtons() {
  const { openTranslator, handleDailyLimitReached, showTranslator } = useTranslationContext();
  // Resets in 2 hours 30 minutes (and a few seconds, so the minutes are stable).
  const reachLimit = () =>
    handleDailyLimitReached(new Date(Date.now() + 150 * MINUTE + 10_000).toISOString());
  return (
    <>
      <button onClick={reachLimit}>Translate a word</button>
      <button onClick={openTranslator}>Open translator</button>
      {showTranslator && <p>Translator open</p>}
    </>
  );
}

/** Lets the browser finish going back in history (the dialog pushes an entry while open). */
function backNavigation() {
  let done = false;
  window.addEventListener('popstate', () => (done = true), { once: true });
  return () => until(() => expect(done).toBe(true));
}

function renderWithTranslation(children: ReactNode) {
  const { wrapper: Auth } = withAuth('learner');
  return render(
    <ThemeProvider theme={theme}>
      <Auth>
        <TranslationProvider>
          {children}
          <LimitReachedDialog />
        </TranslationProvider>
      </Auth>
    </ThemeProvider>
  );
}

describe('translation limit dialog', () => {
  test('says when the daily limit resets, counts down, and closes with Got it', async () => {
    renderWithTranslation(<TranslatorButtons />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    click(screen.getByRole('button', { name: 'Translate a word' }));
    const dialog = screen.getByRole('dialog', {
      name: "You've hit your translation limit for the day",
    });
    expect(dialog).toHaveTextContent('Your limit will reset in 2 hours 30 minutes');

    await elapse(MINUTE);
    expect(dialog).toHaveTextContent('Your limit will reset in 2 hours 29 minutes');

    click(screen.getByRole('button', { name: 'Got it' }));
    await elapse();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('once the limit is reached, opening the translator shows the dialog instead', async () => {
    renderWithTranslation(<TranslatorButtons />);
    click(screen.getByRole('button', { name: 'Translate a word' }));
    // Closing takes the dialog's history entry back off, asynchronously.
    const wentBack = backNavigation();
    click(screen.getByRole('button', { name: 'Got it' }));
    await wentBack();
    await elapse();

    click(screen.getByRole('button', { name: 'Open translator' }));
    expect(screen.queryByText('Translator open')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('2 hours 30 minutes');
  });

  test('the browser back button closes it', async () => {
    renderWithTranslation(<TranslatorButtons />);
    click(screen.getByRole('button', { name: 'Translate a word' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const wentBack = backNavigation();
    window.history.back();
    await wentBack();
    await elapse();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('once the reset time passes, the open dialog says it will reset shortly', async () => {
    function AlmostReset() {
      const { handleDailyLimitReached } = useTranslationContext();
      const reachLimit = () => handleDailyLimitReached(new Date(Date.now() + 90_000).toISOString());
      return <button onClick={reachLimit}>Translate a word</button>;
    }
    renderWithTranslation(<AlmostReset />);
    click(screen.getByRole('button', { name: 'Translate a word' }));
    await elapse(2 * MINUTE);
    expect(screen.getByRole('dialog')).toHaveTextContent('Your limit will reset shortly');
  });
});

describe('direction toggle', () => {
  test('shows which language comes first, and flips when pressed', () => {
    function Toggle() {
      const [direction, setDirection] = useState<TranslationDirection>('en-to-pl');
      return (
        <DirectionToggle
          direction={direction}
          onToggle={() => setDirection((d) => (d === 'en-to-pl' ? 'pl-to-en' : 'en-to-pl'))}
        />
      );
    }
    render(
      <ThemeProvider theme={theme}>
        <Toggle />
      </ThemeProvider>
    );

    expect(screen.getByRole('button')).toHaveTextContent(/^EN\s*PL$/);
    click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent(/^PL\s*EN$/);
  });

  test('can be disabled', () => {
    const onToggle = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <DirectionToggle direction="pl-to-en" onToggle={onToggle} disabled />
      </ThemeProvider>
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent(/^PL\s*EN$/);
    click(screen.getByRole('button'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('empty deck card', () => {
  test('in dark mode it is a dark card, not a white one', () => {
    render(
      <ThemeProvider theme={createAppTheme('dark')}>
        <EmptyState message="No cards match your filters" />
      </ThemeProvider>
    );
    const card = screen.getByText('No cards match your filters').closest('.MuiCard-root')!;
    expect(getComputedStyle(card).backgroundColor).toBe('rgba(26, 22, 18, 0.95)');
  });
});
