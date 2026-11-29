import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { callables, renderApp, renderInShell, setupUiTests, ADMIN } from './support/app';
import { remote } from './support/firestore';
import { choose, findDialog, findSnackbar, press, settle, type } from './support/ui';
import { screenSize, visualViewport } from './support/browser';
import { EditConjugationModal } from '../../../src/components/EditConjugationModal';
import { EditAspectPairsModal } from '../../../src/components/EditAspectPairsModal';
import { EditVerbModal } from '../../../src/components/EditVerbModal';
import { EditDeclensionModal } from '../../../src/components/EditDeclensionModal';
import { AddVocabularyModal } from '../../../src/components/AddVocabularyModal';
import type { DrillableForm, Verb } from '../../../src/types/conjugation';
import { stub } from '../../helpers/stub';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

function verb(id: string, infinitive: string, extra: Partial<Verb> = {}): Verb {
  return {
    id,
    infinitive,
    infinitiveEn: 'to do',
    aspect: 'Imperfective',
    verbClass: '-ić',
    isIrregular: false,
    isReflexive: false,
    conjugations: {
      present: stub<NonNullable<Verb['conjugations']['present']>>({
        '1sg': {
          pl: 'robię',
          en: ['I do', 'I am doing'],
          audioUrl: 'https://audio.test/robie.mp3',
        },
        '2sg': { pl: 'robisz', en: ['you do'] },
      }),
    },
    ...extra,
  };
}

const ROBIC = verb('robic', 'robić');

const FIRST_PERSON: DrillableForm = {
  verb: ROBIC,
  tense: 'present',
  formKey: '1sg',
  form: ROBIC.conjugations.present!['1sg'],
  person: '1st',
  number: 'Singular',
  fullFormKey: 'robic_present_1sg',
};

/** Answers the confirmation titled `title`, after checking its message. */
async function answerConfirmation(title: string, message: string | RegExp, answer: string) {
  const confirmation = await findDialog(title);
  expect(confirmation).toHaveTextContent(message);
  fireEvent.click(within(confirmation).getByRole('button', { name: answer }));
}

/** Waits until only the dialog titled `title` is left open. */
async function waitForDialogsToCloseExcept(title: string) {
  await waitFor(() => expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1));
  expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
}

function audioService(audioUrl = 'https://audio.test/new.mp3') {
  callables.set('generateAudioPreview', () => ({ audioBase64: 'AAAA' }));
  callables.set('saveAudio', () => ({ audioUrl }));
}

describe('Edit Conjugation dialog', () => {
  function renderModal(props: Partial<Parameters<typeof EditConjugationModal>[0]> = {}) {
    const handlers = {
      onSave: vi.fn(),
      onClose: vi.fn(),
      onDelete: vi.fn(),
      onAudioUpdated: vi.fn(),
    };
    renderInShell(<EditConjugationModal open form={FIRST_PERSON} {...handlers} {...props} />);
    return handlers;
  }

  test('names the form being edited and starts from its saved values', async () => {
    renderModal();
    const dialog = await findDialog('Edit Conjugation');
    expect(within(dialog).getByText('Present · 1st person singular')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Polish Infinitive' })).toHaveValue('robić');
    expect(within(dialog).getByRole('textbox', { name: 'Polish Form' })).toHaveValue('robię');
    expect(within(dialog).getByRole('textbox', { name: 'English Translations' })).toHaveValue(
      'I do, I am doing'
    );
  });

  test('saving trims the fields, splits the translations at commas and keeps alternatives', async () => {
    const { onSave, onClose } = renderModal();
    const dialog = await findDialog('Edit Conjugation');
    type(within(dialog).getByRole('textbox', { name: 'Polish Form' }), ' robię ');
    type(within(dialog).getByRole('textbox', { name: 'English Translations' }), 'I do,  I make , ');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alternative' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alternative' }));
    const alternatives = within(dialog).getAllByPlaceholderText('Alternative form');
    type(alternatives[0], ' robie ');
    await choose('Reflexive', 'Yes (się)', dialog);
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      {
        infinitive: 'robić',
        infinitiveEn: 'to do',
        aspect: 'Imperfective',
        verbClass: '-ić',
        isReflexive: true,
      },
      { pl: 'robię', en: ['I do', 'I make'], plAlternatives: ['robie'] }
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('cannot be saved while a required field is blank', async () => {
    renderModal();
    const dialog = await findDialog('Edit Conjugation');
    type(within(dialog).getByRole('textbox', { name: 'Polish Form' }), '   ');
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    );
  });

  test('"Delete Verb" deletes only after confirmation', async () => {
    const { onDelete, onClose } = renderModal();
    const dialog = await findDialog('Edit Conjugation');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Verb' }));
    await answerConfirmation(
      'Delete Verb',
      'Are you sure you want to delete this verb? This will remove all conjugation forms for this verb and affect all users.',
      'Cancel'
    );
    await waitForDialogsToCloseExcept('Edit Conjugation');
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Verb' }));
    await answerConfirmation('Delete Verb', /delete this verb/, 'Delete');
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  test('admins can regenerate the form’s audio, which saves it and closes the dialog', async () => {
    audioService('https://audio.test/robie-2.mp3');
    const handlers = { onSave: vi.fn(), onClose: vi.fn(), onAudioUpdated: vi.fn() };
    renderInShell(<EditConjugationModal open form={FIRST_PERSON} {...handlers} />, {
      account: ADMIN,
    });
    const dialog = await findDialog('Edit Conjugation');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Regenerate Audio' }));

    await waitFor(() =>
      expect(handlers.onAudioUpdated).toHaveBeenCalledWith('https://audio.test/robie-2.mp3')
    );
    expect(handlers.onClose).toHaveBeenCalled();
    expect(callables.callsTo('generateAudioPreview')).toEqual([
      { text: 'robię', type: 'conjugation' },
    ]);
    expect(callables.callsTo('saveAudio')).toEqual([
      { audioBase64: 'AAAA', type: 'conjugation', id: 'robic', subPath: 'robic_present_1sg' },
    ]);
  });

  test('a failed audio generation is reported in the dialog', async () => {
    callables.set('generateAudioPreview', () => {
      throw new Error('quota');
    });
    const handlers = { onSave: vi.fn(), onClose: vi.fn(), onAudioUpdated: vi.fn() };
    renderInShell(<EditConjugationModal open form={FIRST_PERSON} {...handlers} />, {
      account: ADMIN,
    });
    const dialog = await findDialog('Edit Conjugation');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Regenerate Audio' }));

    expect(
      await within(dialog).findByText('Failed to generate audio. Please try again.')
    ).toBeInTheDocument();
    expect(handlers.onAudioUpdated).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Regenerate Audio' })).toBeEnabled();
  });

  test('learners do not get the audio tools', async () => {
    renderModal();
    const dialog = await findDialog('Edit Conjugation');
    expect(within(dialog).queryByText('Form Audio')).toBeNull();
  });
});

describe('Editing a form from the conjugation drill (admins)', () => {
  function seedRobic() {
    remote.seed('verbs/robic', {
      id: 'robic',
      infinitive: 'robić',
      infinitiveEn: 'to do',
      aspect: 'Imperfective',
      verbClass: '-ić',
      isIrregular: false,
      isReflexive: false,
      conjugations: {
        present: { '1sg': { pl: 'robię', en: ['I do'], plAlternatives: ['robie'] } },
      },
    });
  }

  async function editCurrentForm() {
    seedRobic();
    renderApp('/conjugation/recognition', { account: ADMIN });
    fireEvent.click(await screen.findByRole('button', { name: 'edit' }));
    return findDialog('Edit Conjugation');
  }

  const savedForm = () =>
    (remote.get('verbs/robic') as { conjugations: { present: Record<string, object> } })
      .conjugations.present['1sg'];

  test('an edited form is saved for everyone', async () => {
    const dialog = await editCurrentForm();
    type(within(dialog).getByRole('textbox', { name: 'English Translations' }), 'I do, I make');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(savedForm()).toEqual({
        pl: 'robię',
        en: ['I do', 'I make'],
        plAlternatives: ['robie'],
      })
    );
  });

  test('removing a form’s last alternative spelling saves the form without it', async () => {
    const dialog = await editCurrentForm();
    const alternative = within(dialog).getByPlaceholderText('Alternative form');
    const row = alternative.closest('.MuiTextField-root')!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button'));
    expect(within(dialog).queryByPlaceholderText('Alternative form')).toBeNull();
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(remote.callsTo('updateDoc')).toContain('updateDoc verbs/robic'));
    expect(savedForm()).not.toHaveProperty('plAlternatives');
  });
});

describe('Edit Aspect Pair dialog', () => {
  const ZROBIC = verb('zrobic', 'zrobić', { aspect: 'Perfective', aspectPair: 'robic' });

  test('edits both verbs of the pair', async () => {
    const onSave = vi.fn();
    renderInShell(
      <EditAspectPairsModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        card={{ verb: ROBIC, pairVerb: ZROBIC }}
      />
    );
    const dialog = await findDialog('Edit Aspect Pair');
    expect(within(dialog).getByText('Imperfective Verb (robić)')).toBeInTheDocument();
    expect(within(dialog).getByText('Perfective Verb (zrobić)')).toBeInTheDocument();
    const english = within(dialog).getAllByRole('textbox', { name: 'English Infinitive' });
    type(english[1], ' to get done ');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      { infinitive: 'robić', infinitiveEn: 'to do', aspect: 'Imperfective', verbClass: '-ić' },
      { infinitive: 'zrobić', infinitiveEn: 'to get done', aspect: 'Perfective', verbClass: '-ić' }
    );
  });

  test('a biaspectual verb is edited once and cannot be unlinked', async () => {
    renderInShell(
      <EditAspectPairsModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        onUnlink={vi.fn()}
        card={{ verb: ROBIC, pairVerb: ROBIC }}
      />
    );
    const dialog = await findDialog('Edit Aspect Pair');
    expect(within(dialog).getByText(/This is a biaspectual verb/)).toBeInTheDocument();
    expect(within(dialog).getAllByRole('textbox', { name: 'Polish Infinitive' })).toHaveLength(1);
    expect(within(dialog).queryByRole('button', { name: 'Unlink Pair' })).toBeNull();
  });

  test('"Unlink Pair" unlinks after confirmation and closes', async () => {
    const onUnlink = vi.fn();
    const onClose = vi.fn();
    renderInShell(
      <EditAspectPairsModal
        open
        onClose={onClose}
        onSave={vi.fn()}
        onUnlink={onUnlink}
        card={{ verb: ROBIC, pairVerb: ZROBIC }}
      />
    );
    const dialog = await findDialog('Edit Aspect Pair');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink Pair' }));
    await answerConfirmation('Unlink Pair', /unlink this aspect pair/, 'Cancel');
    await waitForDialogsToCloseExcept('Edit Aspect Pair');
    expect(onUnlink).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink Pair' }));
    await answerConfirmation('Unlink Pair', /unlink this aspect pair/, 'Unlink');
    await waitFor(() => expect(onUnlink).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  test('admins can regenerate each infinitive’s audio', async () => {
    audioService('https://audio.test/zrobic.mp3');
    const onVerb2AudioUpdated = vi.fn();
    renderInShell(
      <EditAspectPairsModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        onVerb2AudioUpdated={onVerb2AudioUpdated}
        card={{ verb: ROBIC, pairVerb: ZROBIC }}
      />,
      { account: ADMIN }
    );
    const dialog = await findDialog('Edit Aspect Pair');
    const buttons = await within(dialog).findAllByRole('button', { name: 'Generate Audio' });
    fireEvent.click(buttons[1]);
    await waitFor(() =>
      expect(onVerb2AudioUpdated).toHaveBeenCalledWith('https://audio.test/zrobic.mp3')
    );
    expect(callables.callsTo('generateAudioPreview')).toEqual([
      { text: 'zrobić', type: 'verb-infinitive' },
    ]);
  });
});

describe('Edit Verb dialog (admin)', () => {
  function renderVerb(v: Verb = verb('robic', 'robić', { aspectPair: 'zrobic' })) {
    const handlers = { onSave: vi.fn(), onClose: vi.fn(), onDelete: vi.fn() };
    renderInShell(<EditVerbModal open verb={v} {...handlers} />, { account: ADMIN });
    return handlers;
  }

  test('saves the verb details together with edited conjugation forms', async () => {
    const { onSave } = renderVerb();
    const dialog = await findDialog('Edit Verb');
    type(within(dialog).getByRole('textbox', { name: 'Aspect Pair (optional)' }), '  ');
    await choose('Irregular', 'Yes', dialog);
    fireEvent.click(within(dialog).getByText('Present'));
    const robisz = within(dialog).getByDisplayValue('robisz');
    type(robisz, 'robisz!');
    type(within(dialog).getByDisplayValue('you do'), 'you make');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ infinitive: 'robić', isIrregular: true, aspectPair: undefined });
    expect(saved.conjugations.present['2sg']).toEqual({ pl: 'robisz!', en: ['you make'] });
    expect(saved.conjugations.present['1sg'].audioUrl).toBe('https://audio.test/robie.mp3');
  });

  test('a conjugated form’s audio is regenerated for that form', async () => {
    audioService('https://audio.test/robisz.mp3');
    renderVerb();
    const dialog = await findDialog('Edit Verb');
    fireEvent.click(within(dialog).getByText('Present'));
    const row = within(dialog).getByDisplayValue('robisz').closest('.MuiTextField-root')!
      .parentElement as HTMLElement;
    expect(within(row).queryByTestId('VolumeUpIcon')).toBeNull();
    fireEvent.click(within(row).getByTestId('GraphicEqIcon').closest('button')!);

    expect(await within(row).findByTestId('VolumeUpIcon')).toBeInTheDocument();
    expect(callables.callsTo('saveAudio')).toEqual([
      { audioBase64: 'AAAA', type: 'conjugation', id: 'robic', subPath: 'robic_present_2sg' },
    ]);
  });

  test('a second English translation can be typed after a comma', async () => {
    renderVerb();
    const dialog = await findDialog('Edit Verb');
    fireEvent.click(within(dialog).getByText('Present'));
    const english = within(dialog).getByDisplayValue('you do') as HTMLInputElement;
    for (const char of ', you make') {
      fireEvent.change(english, { target: { value: english.value + char } });
    }
    expect(english).toHaveValue('you do, you make');
  });

  test('"Delete Verb" deletes after confirmation', async () => {
    const { onDelete, onClose } = renderVerb();
    const dialog = await findDialog('Edit Verb');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Verb' }));
    await answerConfirmation(
      'Delete Verb',
      'Delete this verb and all its conjugation forms? This affects all users.',
      'Delete'
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  test('Cancel closes the dialog without saving', async () => {
    const { onSave, onClose } = renderVerb();
    const dialog = await findDialog('Edit Verb');
    type(within(dialog).getByRole('textbox', { name: 'Polish Infinitive' }), 'zrobić');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('Create Custom Card dialog', () => {
  test('a translation still waiting when the dialog is cancelled is dropped', async () => {
    callables.set('translate', () => ({
      translatedText: 'This is a cat.',
      charsUsedToday: 1,
      resetTime: '',
    }));
    const onClose = vi.fn();
    renderInShell(<EditDeclensionModal open card={null} onSave={vi.fn()} onClose={onClose} />);
    const dialog = await findDialog('Create Custom Card');
    type(within(dialog).getByRole('textbox', { name: 'Back (Answer)' }), 'To jest kot.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();

    await settle(700);
    expect(callables.callsTo('translate')).toEqual([]);
    expect(
      within(dialog).getByRole('textbox', { name: 'English Translation (optional)' })
    ).toHaveValue('');
  });
});

describe('Saving', () => {
  test('a save error after the dialog closed is reported in a snackbar', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('offline');
    });
    renderInShell(
      <EditConjugationModal open form={FIRST_PERSON} onSave={onSave} onClose={vi.fn()} />
    );
    const dialog = await findDialog('Edit Conjugation');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));
    expect(await findSnackbar('Failed to save. Please try again.')).toBeInTheDocument();
  });
});

describe('Dialog layout on phones', () => {
  test('a dialog moves above the on-screen keyboard and back when the keyboard closes', async () => {
    screenSize.coarsePointer = true;
    renderInShell(<AddVocabularyModal open onSave={vi.fn()} onClose={vi.fn()} />);
    await findDialog('Add New Word');
    const root = document.querySelector('.MuiDialog-root') as HTMLElement;
    expect(getComputedStyle(root).height).not.toBe('420px');

    // The keyboard takes up most of an 800px-tall screen.
    visualViewport.height = 420;
    visualViewport.offsetTop = 30;
    visualViewport.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(getComputedStyle(root).height).toBe('420px'));
    expect(getComputedStyle(root).top).toBe('30px');

    visualViewport.height = 800;
    visualViewport.offsetTop = 0;
    visualViewport.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(getComputedStyle(root).height).not.toBe('420px'));
  });

  test('pinch-zooming is not mistaken for the keyboard', async () => {
    screenSize.coarsePointer = true;
    renderInShell(<AddVocabularyModal open onSave={vi.fn()} onClose={vi.fn()} />);
    await findDialog('Add New Word');
    const root = document.querySelector('.MuiDialog-root') as HTMLElement;
    visualViewport.scale = 2;
    visualViewport.height = 400;
    visualViewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(getComputedStyle(root).height).not.toBe('400px');
  });
});
