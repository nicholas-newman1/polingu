import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './support/AppTree';
import {
  accounts,
  captureUnhandledRejections,
  renderApp,
  setupUiTests,
  waitForReviewData,
  ADMIN,
  LEARNER,
} from './support/app';
import { seedCustom, word } from './support/data';
import { remote } from './support/firestore';
import { network } from '../../sync/support/harness';
import { findDialog, findSnackbar, querySnackbar, settle, waitForMenuToClose } from './support/ui';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

describe('Signing in', () => {
  test('a spinner is shown until Firebase reports who is signed in', async () => {
    accounts.pending = true;
    accounts.signIn(LEARNER);
    render(<App route="/dashboard" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).toBeNull();

    act(() => accounts.resolve());
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  test('a guest sees guest mode and a sign-in link, and no quick add button', async () => {
    renderApp('/dashboard', { account: null });
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quick add' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open translator' })).toBeDisabled();

    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  test('signing in with Google from the sign-in page opens the dashboard as that user', async () => {
    accounts.popupAccount = { uid: 'new-user', displayName: 'Zofia Nowak' };
    const app = renderApp('/login', { account: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('Zofia')).toBeInTheDocument();
    expect(screen.getByText('new-user@example.com')).toBeInTheDocument();
  });

  test('a Google sign-in that fails says so', async () => {
    const rejections = captureUnhandledRejections();
    accounts.popupError = new Error('Firebase: Error (auth/network-request-failed).');
    const app = renderApp('/login', { account: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    await waitFor(() => expect(accounts.popupCalls).toBe(1));
    await settle(50);

    expect(app.location()).toBe('/login');
    expect(
      screen.queryAllByRole('alert', { hidden: true }).length +
        screen.queryAllByText(/fail|could ?n[o'’]t|error|try again/i).length
    ).toBeGreaterThan(0);
    expect(rejections).toEqual([]);
  });

  test('closing the Google popup without signing in is not reported', async () => {
    const rejections = captureUnhandledRejections();
    accounts.popupError = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
      code: 'auth/popup-closed-by-user',
    });
    const app = renderApp('/login', { account: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    await waitFor(() => expect(accounts.popupCalls).toBe(1));
    await settle(50);

    expect(app.location()).toBe('/login');
    expect(screen.queryAllByRole('alert', { hidden: true })).toEqual([]);
    expect(rejections).toEqual([]);
  });

  test('"Continue as guest" goes to the dashboard without signing in', async () => {
    const app = renderApp('/login', { account: null });
    fireEvent.click(await screen.findByRole('link', { name: 'Continue as guest' }));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
    expect(screen.getByText('Guest mode')).toBeInTheDocument();
  });

  test('a signed-in user who opens the sign-in page is sent to the dashboard', async () => {
    const app = renderApp('/login');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
  });

  test('signing out from the account menu returns to the sign-in page as a guest', async () => {
    const app = renderApp('/my-vocabulary');
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(app.location()).toBe('/login');
    expect(accounts.current).toBeNull();
  });

  test('unknown addresses lead to the dashboard', async () => {
    const app = renderApp('/no-such-page');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
  });
});

describe('Navigation', () => {
  test('the account menu leads to the learner’s own content and settings', async () => {
    const app = renderApp('/dashboard');
    const go = async (item: string, path: string) => {
      fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: item }));
      await waitFor(() => expect(app.location()).toBe(path));
      await waitForMenuToClose();
    };
    await go('My Vocabulary', '/my-vocabulary');
    expect(await screen.findByRole('heading', { name: 'My Vocabulary', level: 5 })).toBeVisible();
    await go('My Declensions', '/my-declensions');
    await go('My Sentences', '/my-sentences');
    await go('Settings', '/settings');
    expect(await screen.findByRole('heading', { name: 'Settings', level: 5 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings', level: 6 })).toBeInTheDocument();
  });

  test('the account menu no longer offers a statistics page', async () => {
    renderApp('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await screen.findByRole('menuitem', { name: 'Settings' });
    expect(screen.queryByRole('menuitem', { name: 'Statistics' })).toBeNull();
  });

  test('a new page opens scrolled to the top', async () => {
    const app = renderApp('/my-vocabulary');
    await screen.findByRole('heading', { name: 'My Vocabulary', level: 5 });
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await waitFor(() => expect(app.location()).toBe('/dashboard'));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('the account menu greets the learner by first name', async () => {
    renderApp('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('learner-a@example.com')).toBeInTheDocument();
  });

  test('the dashboard opens each section, which shows its title in the header', async () => {
    const app = renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    fireEvent.click(screen.getByRole('button', { name: /^Library/ }));
    expect(await screen.findByText('My Library')).toBeInTheDocument();
    expect(app.location()).toBe('/library');
    expect(screen.getByRole('heading', { name: 'Library', level: 6 })).toBeInTheDocument();
  });

  test('the home button returns to the dashboard from any page, and is not shown there', async () => {
    const app = renderApp('/my-vocabulary');
    await screen.findByRole('heading', { name: 'My Vocabulary', level: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
  });

  test('top-level sections have no back arrow; nested pages go back to their parent', async () => {
    const app = renderApp('/library');
    await screen.findByText('My Library');
    const libraryHeader = screen.getByRole('heading', { name: 'Library', level: 6 }).parentElement!;
    expect(within(libraryHeader).queryByRole('button')).toBeNull();
    app.unmount();

    const drill = renderApp('/conjugation/recognition');
    const header = (await screen.findByRole('heading', { name: 'Recognition', level: 6 }))
      .parentElement!;
    fireEvent.click(within(header).getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Conjugation page')).toBeInTheDocument();
    expect(drill.location()).toBe('/conjugation');
  });
});

describe('Admin-only pages', () => {
  test('learners see no admin links and are sent to the dashboard if they open one', async () => {
    const app = renderApp('/admin/content/vocabulary');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
    expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Content/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Generator/ })).toBeNull();
  });

  test('learners opening the sentence generator are sent to the dashboard', async () => {
    const app = renderApp('/admin/generator');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(app.location()).toBe('/dashboard');
  });

  test('admins see an admin section on the dashboard that opens the admin pages', async () => {
    const app = renderApp('/dashboard', { account: ADMIN });
    await screen.findByText('Dashboard page');
    expect(await screen.findByRole('heading', { name: 'Admin' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Content/ }));
    await waitFor(() => expect(app.location()).toBe('/admin/content/vocabulary'));
    expect(await screen.findByRole('tab', { name: /Vocabulary \(\d+\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Generator/ }));
    expect(await screen.findByRole('tab', { name: 'Generate' })).toBeInTheDocument();
    expect(app.location()).toBe('/admin/generator');
  });

  test('admin rights are not granted while offline, when they cannot be checked', async () => {
    network.goOffline();
    renderApp('/dashboard', { account: ADMIN });
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    await settle();
    expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull();
  });
});

describe('Colour mode', () => {
  test('switching to dark mode is remembered the next time the app opens', async () => {
    const app = renderApp('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to dark mode' }));
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(document.documentElement.style.colorScheme).toBe('dark');
    app.unmount();

    renderApp('/dashboard');
    expect(await screen.findByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('Offline indicator', () => {
  test('appears when the connection drops and shows a sync while reconnecting', async () => {
    renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    await waitForReviewData();
    expect(screen.queryByText(/You're offline/)).toBeNull();

    act(() => {
      network.goOffline();
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByText("You're offline")).toBeInTheDocument();

    const contentFetch = remote.hold('getDocs');
    act(() => {
      network.goOnline();
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByText('Syncing...')).toBeInTheDocument();
    expect(screen.queryByText(/You're offline/)).toBeNull();

    contentFetch.release();
    await waitFor(() => expect(screen.queryByText('Syncing...')).toBeNull());
  });
});

describe('Snackbar', () => {
  test('a message can be dismissed with its close button', async () => {
    seedCustom(LEARNER.uid, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    renderApp('/my-vocabulary');
    await screen.findByText('kot');
    remote.fail({ op: 'deleteDoc' });
    const row = screen.getByText('kot').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'delete word' }));
    fireEvent.click(
      within(await findDialog('Delete Word')).getByRole('button', { name: 'Delete' })
    );

    const snackbar = await findSnackbar('Failed to save. Please try again.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(within(snackbar).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(querySnackbar('Failed to save. Please try again.')).toBeNull());
  });
});
