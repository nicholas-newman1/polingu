import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, setupUiTests } from './support/app';
import { waitForMenuToClose } from './support/ui';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

const SHEETS: Array<[menuItem: string, title: string, sample: string]> = [
  ['Noun Declensions', 'Noun Declension Cheat Sheet', 'Feminine'],
  ['Adjective Declensions', 'Adjective Declension Cheat Sheet', 'Feminine & Neuter'],
  ['Consonants', 'Consonants Cheat Sheet', 'Soft'],
  ['-y/-i Rule', '-y/-i Rule', 'Use in all other cases'],
  ['Conjugations', 'Conjugation Cheat Sheet', 'Verb Classes & Present Tense Endings'],
];

async function openSheet(menuItem: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Open cheat sheets' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: menuItem }));
  await waitForMenuToClose();
}

describe('Cheat sheets', () => {
  test.each(SHEETS)(
    '"%s" opens the %s and its close button shuts it',
    async (menuItem, title, sample) => {
      renderApp('/dashboard');
      await screen.findByText('Dashboard page');
      await openSheet(menuItem);

      const heading = await screen.findByRole('heading', { name: title });
      const sheet = heading.closest('.MuiDrawer-paper') as HTMLElement;
      expect(within(sheet).getAllByText(sample, { exact: false }).length).toBeGreaterThan(0);

      fireEvent.click(within(sheet).getByRole('button', { name: 'close' }));
      await waitFor(() => expect(screen.queryByRole('heading', { name: title })).toBeNull());
    }
  );

  test('the cheat sheets are available to guests too', async () => {
    renderApp('/dashboard', { account: null });
    await screen.findByText('Dashboard page');
    await openSheet('Noun Declensions');
    expect(
      await screen.findByRole('heading', { name: 'Noun Declension Cheat Sheet' })
    ).toBeInTheDocument();
  });

  test('the phone’s back gesture closes an open cheat sheet', async () => {
    renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    await openSheet('Consonants');
    await screen.findByRole('heading', { name: 'Consonants Cheat Sheet' });

    act(() => window.history.back());
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Consonants Cheat Sheet' })).toBeNull()
    );
  });

  test('the conjugation sheet shows one section at a time', async () => {
    renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    await openSheet('Conjugations');
    await screen.findByRole('heading', { name: 'Conjugation Cheat Sheet' });

    const patterns = screen.getByRole('button', { name: /Verb Classes & Present Tense Endings/ });
    const tenses = screen.getByRole('button', { name: /Tenses Overview/ });
    expect(patterns).toHaveAttribute('aria-expanded', 'true');
    expect(tenses).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(tenses);
    expect(tenses).toHaveAttribute('aria-expanded', 'true');
    expect(patterns).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(tenses);
    expect(tenses).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Bottom bar', () => {
  test('shows the build version', async () => {
    renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    expect(screen.getByText('vtest')).toBeInTheDocument();
  });

  test('the translator button is enabled for signed-in users', async () => {
    renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    expect(screen.getByRole('button', { name: 'Open translator' })).toBeEnabled();
  });
});
