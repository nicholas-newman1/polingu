import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  callables,
  renderApp,
  renderInShell,
  setupUiTests,
  waitForReviewData,
  ADMIN,
  LEARNER,
} from './support/app';
import { seedCustom, word } from './support/data';
import { choose, findDialog, press, rowWith, settle, type } from './support/ui';
import { AddVocabularyModal } from '../../../src/components/AddVocabularyModal';
import { SuggestVocabularyExamplesModal } from '../../../src/components/SuggestVocabularyExamplesModal';
import type { VocabularyWord } from '../../../src/types/vocabulary';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

const EXAMPLES = [
  { polish: 'Kot śpi.', english: 'The cat sleeps.' },
  { polish: 'Mam kota.', english: 'I have a cat.', meaning: 'pet' },
  { polish: 'Kot je.', english: 'The cat eats.' },
  { polish: 'Kot pije.', english: 'The cat drinks.' },
];

function exampleService(examples = EXAMPLES) {
  callables.set('generateExample', () => ({ examples }));
}

describe('AI examples in the Add Word dialog (admins)', () => {
  async function openAsAdmin() {
    const onSave = vi.fn();
    renderInShell(<AddVocabularyModal open onSave={onSave} onClose={vi.fn()} />, {
      account: ADMIN,
    });
    const dialog = await findDialog('Add New Word');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'kot');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'cat');
    fireEvent.click(within(dialog).getByRole('button', { name: 'More details (optional)' }));
    return { dialog, onSave };
  }

  test('generated examples can be picked and are saved with the word', async () => {
    exampleService(EXAMPLES.slice(0, 3));
    const { dialog, onSave } = await openAsAdmin();
    await choose('Part of Speech (optional)', 'Noun', dialog);
    type(within(dialog).getByRole('textbox', { name: 'Context (optional)' }), ' at the vet ');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Generate with AI' }));

    expect(await within(dialog).findByText('Kot śpi.')).toBeInTheDocument();
    expect(within(dialog).getByText('(pet)')).toBeInTheDocument();
    expect(callables.callsTo('generateExample')).toEqual([
      { polish: 'kot', english: 'cat', partOfSpeech: 'noun', context: 'at the vet' },
    ]);
    const accept = within(dialog).getByRole('button', { name: 'Accept Selected (3)' });
    fireEvent.click(within(dialog).getByText('Kot je.'));
    expect(accept).toHaveTextContent('Accept Selected (2)');
    fireEvent.click(accept);

    expect(within(dialog).getByText('Example 1')).toBeInTheDocument();
    expect(within(dialog).getByText('Example 2')).toBeInTheDocument();
    expect(within(dialog).queryByText('Example 3')).toBeNull();
    expect(within(dialog).getByRole('textbox', { name: 'Context (optional)' })).toHaveValue('');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].examples).toEqual([
      expect.objectContaining({ polish: 'Kot śpi.', english: 'The cat sleeps.' }),
      expect.objectContaining({ polish: 'Mam kota.', english: 'I have a cat.' }),
    ]);
  });

  test('nothing is generated until both Polish and English are filled in', async () => {
    exampleService();
    renderInShell(<AddVocabularyModal open onSave={vi.fn()} onClose={vi.fn()} />, {
      account: ADMIN,
    });
    const dialog = await findDialog('Add New Word');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'kot');
    fireEvent.click(within(dialog).getByRole('button', { name: 'More details (optional)' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Generate with AI' }));
    await settle();
    expect(callables.callsTo('generateExample')).toEqual([]);
  });

  test('a failed generation says so; regenerating and discarding work on the results', async () => {
    callables.set('generateExample', () => {
      throw new Error('overloaded');
    });
    const { dialog } = await openAsAdmin();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Generate with AI' }));
    expect(
      await within(dialog).findByText('Failed to generate. Please try again.')
    ).toBeInTheDocument();

    exampleService([EXAMPLES[0]]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate with AI' }));
    expect(await within(dialog).findByText('Kot śpi.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Failed to generate. Please try again.')).toBeNull();

    exampleService([EXAMPLES[2]]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate' }));
    expect(await within(dialog).findByText('Kot je.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Kot śpi.')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(within(dialog).queryByText('Kot je.')).toBeNull();
    expect(within(dialog).queryByText('Example 1')).toBeNull();
  });

  test('learners do not get the AI generator', async () => {
    renderInShell(<AddVocabularyModal open onSave={vi.fn()} onClose={vi.fn()} />);
    const dialog = await findDialog('Add New Word');
    fireEvent.click(within(dialog).getByRole('button', { name: 'More details (optional)' }));
    await settle();
    expect(within(dialog).queryByRole('button', { name: 'Generate with AI' })).toBeNull();
  });
});

describe('Suggest Example Sentences dialog', () => {
  const KOT = {
    id: 7,
    polish: 'kot',
    english: 'cat',
    partOfSpeech: 'noun',
    gender: 'masculine',
  } as VocabularyWord;

  function renderSuggest() {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderInShell(
      <SuggestVocabularyExamplesModal open word={KOT} onSave={onSave} onClose={onClose} />
    );
    return { onSave, onClose };
  }

  test('suggests up to three examples for the word straight away', async () => {
    exampleService();
    renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    expect(within(dialog).getByText('kot')).toBeInTheDocument();
    expect(await within(dialog).findByText('Kot śpi.')).toBeInTheDocument();
    expect(within(dialog).getByText('Kot je.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Kot pije.')).toBeNull();
    expect(callables.callsTo('generateExample')).toEqual([
      { polish: 'kot', english: 'cat', partOfSpeech: 'noun', gender: 'masculine' },
    ]);
  });

  test('accepted suggestions can be edited and are saved trimmed', async () => {
    exampleService();
    const { onSave, onClose } = renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    await within(dialog).findByText('Kot śpi.');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    fireEvent.click(within(dialog).getByText('Mam kota.'));
    fireEvent.click(within(dialog).getByText('Kot je.'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept Selected (1)' }));

    expect(within(dialog).getByText('Accepted (1)')).toBeInTheDocument();
    const english = within(dialog).getByDisplayValue('The cat sleeps.');
    type(english, '  The cat is sleeping.  ');
    fireEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      { id: expect.any(String), polish: 'Kot śpi.', english: 'The cat is sleeping.' },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  test('a failed request can be tried again', async () => {
    callables.set('generateExample', () => {
      throw new Error('overloaded');
    });
    renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    expect(
      await within(dialog).findByText('Failed to generate suggestions. Please try again.')
    ).toBeInTheDocument();

    exampleService();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByText('Kot śpi.')).toBeInTheDocument();
  });

  test('an example added by hand gets its English filled in from the Polish', async () => {
    exampleService([]);
    callables.set<{ text: string; targetLang: string }>('translate', ({ text }) => ({
      translatedText: text === 'Kot miauczy.' ? 'The cat meows.' : '?',
      charsUsedToday: 10,
      resetTime: '',
    }));
    const { onSave } = renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    expect(await within(dialog).findByText('No suggestions to show.')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add manually' }));
    const [polish, english] = within(dialog).getAllByRole('textbox');
    type(polish, 'Kot miauczy.');
    await waitFor(() => expect(english).toHaveValue('The cat meows.'));
    expect(callables.callsTo('translate')).toEqual([{ text: 'Kot miauczy.', targetLang: 'EN' }]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { id: expect.any(String), polish: 'Kot miauczy.', english: 'The cat meows.' },
      ])
    );
  });

  test('English typed by hand is not replaced by a late translation', async () => {
    exampleService([]);
    callables.set('translate', () => ({
      translatedText: 'machine',
      charsUsedToday: 1,
      resetTime: '',
    }));
    renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    await within(dialog).findByText('No suggestions to show.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add manually' }));
    const [polish, english] = within(dialog).getAllByRole('textbox');
    type(polish, 'Kot miauczy.');
    type(english, 'my own');
    await settle(700);
    expect(english).toHaveValue('my own');
    expect(callables.callsTo('translate')).toEqual([]);
  });

  test('English typed by hand is kept when the Polish is edited again', async () => {
    exampleService([EXAMPLES[0]]);
    callables.set('translate', () => ({
      translatedText: 'machine',
      charsUsedToday: 1,
      resetTime: '',
    }));
    const { onSave } = renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    await within(dialog).findByText('Kot śpi.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept Selected (1)' }));

    const english = within(dialog).getByDisplayValue('The cat sleeps.');
    type(english, 'The cat is asleep.');
    type(within(dialog).getByDisplayValue('Kot śpi.'), 'Kot śpi smacznie.');
    await settle(700);
    expect(english).toHaveValue('The cat is asleep.');
    expect(callables.callsTo('translate')).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { id: expect.any(String), polish: 'Kot śpi smacznie.', english: 'The cat is asleep.' },
      ])
    );
  });

  test('a removed example is not saved, and Skip closes without saving', async () => {
    exampleService([EXAMPLES[0]]);
    const { onSave, onClose } = renderSuggest();
    const dialog = await findDialog('Suggest Example Sentences');
    await within(dialog).findByText('Kot śpi.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept Selected (1)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'remove example' }));
    expect(within(dialog).queryByText(/Accepted/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('Audio tools on My Vocabulary (admins)', () => {
  test('generating a word’s audio from the table makes it playable', async () => {
    callables.set('generateAudioPreview', () => ({ audioBase64: 'AAAA' }));
    callables.set('saveAudio', () => ({ audioUrl: 'https://audio.test/kot.mp3' }));
    seedCustom(ADMIN.uid, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    renderApp('/my-vocabulary', { account: ADMIN });
    await screen.findByText('kot');
    await waitForReviewData();
    const row = rowWith('kot');
    expect(within(row).queryByTestId('VolumeUpIcon')).toBeNull();

    fireEvent.click(within(row).getByTestId('GraphicEqIcon').closest('button')!);
    const play = (await within(rowWith('kot')).findByTestId('VolumeUpIcon')).closest('button')!;
    expect(callables.callsTo('saveAudio')).toEqual([
      { audioBase64: 'AAAA', type: 'custom-vocabulary', id: 'w1' },
    ]);

    fireEvent.click(play);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(await within(rowWith('kot')).findByTestId('StopIcon')).toBeInTheDocument();
  });

  test('the Edit Word dialog offers admins the word’s audio', async () => {
    seedCustom(ADMIN.uid, 'customVocabulary', [
      word('w1', 'kot', 'cat', { audioUrl: 'https://audio.test/kot.mp3' }),
    ]);
    renderApp('/my-vocabulary', { account: ADMIN });
    await screen.findByText('kot');
    fireEvent.click(within(rowWith('kot')).getByRole('button', { name: 'edit word' }));
    const dialog = await findDialog('Edit Word');
    expect(within(dialog).getByText('Word Audio')).toBeInTheDocument();
    expect(within(dialog).getByText('Current audio')).toBeInTheDocument();
    expect(within(dialog).getByText('Text: "kot"')).toBeInTheDocument();
  });

  test('learners editing a word see no audio tools', async () => {
    seedCustom(LEARNER.uid, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    renderApp('/my-vocabulary');
    await screen.findByText('kot');
    fireEvent.click(within(rowWith('kot')).getByRole('button', { name: 'edit word' }));
    const dialog = await findDialog('Edit Word');
    expect(within(dialog).queryByText('Word Audio')).toBeNull();
  });
});
