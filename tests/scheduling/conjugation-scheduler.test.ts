import { beforeEach, describe, expect, test } from 'vitest';
import {
  getAnswerDisplay,
  getAspectLabel,
  getDefaultFilters,
  getDrillableFormsForVerb,
  getQuestionDisplay,
  getTenseLabel,
  getVerbClassLabel,
  matchesFilters,
} from '../../src/lib/conjugationUtils';
import type {
  ConjugationFilters,
  ConjugationForm,
  ConjugationReviewDataStore,
  DrillableForm,
  Verb,
} from '../../src/types/conjugation';
import { freezeTime, graduated, learning, TODAY } from './fixtures';
import { stub } from '../helpers/stub';
import {
  getExtraNewCards,
  getPracticeAheadCards,
  getSessionCards,
} from '../../src/lib/reviewSession/scheduler';
import { conjugationDeck } from '../../src/lib/reviewSession/reviewDecks';

beforeEach(() => freezeTime());

const form = (pl: string, en: string[], plAlternatives?: string[]): ConjugationForm => ({
  pl,
  en,
  ...(plAlternatives ? { plAlternatives } : {}),
});

/** Partial conjugation tables: missing keys are forms the verb does not have. */
const verb = (id: string, overrides: Partial<Verb> = {}): Verb =>
  stub<Verb>({
    id,
    infinitive: id,
    aspect: 'Imperfective',
    verbClass: '-ić',
    conjugations: {
      present: stub<NonNullable<Verb['conjugations']['present']>>({
        '1sg': form('robię', ['I do', 'I make']),
        '3sg': form('robi', ['does', 'makes']),
        '3pl': form('robią', ['they do']),
      }),
      past: stub<NonNullable<Verb['conjugations']['past']>>({
        '1sg_f': form('robiłam', ['I did']),
        '3sg_m': form('robił', ['he did']),
        '3pl_m': form('robili', ['they did']),
      }),
      imperative: stub<NonNullable<Verb['conjugations']['imperative']>>({
        '2sg': form('rób', ['do!']),
      }),
    },
    ...overrides,
  });

const store = (overrides: Partial<ConjugationReviewDataStore> = {}) =>
  stub<ConjugationReviewDataStore>({
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: TODAY,
    ...overrides,
  });

const filters = (overrides: Partial<ConjugationFilters> = {}): ConjugationFilters => ({
  ...getDefaultFilters(),
  ...overrides,
});

const keys = (cards: { form: DrillableForm }[]) => cards.map(({ form }) => form.fullFormKey);

describe('drillable forms', () => {
  test('lists every form a verb has, tense by tense, keyed by verb, tense and person', () => {
    const forms = getDrillableFormsForVerb(verb('robic'));

    expect(forms.map((f) => f.fullFormKey)).toEqual([
      'robic:present:1sg',
      'robic:present:3sg',
      'robic:present:3pl',
      'robic:past:1sg_f',
      'robic:past:3sg_m',
      'robic:past:3pl_m',
      'robic:imperative:2sg',
    ]);
    expect(new Set(forms.map((f) => f.fullFormKey)).size).toBe(forms.length);
  });

  test('reads person, number and gender from each form key', () => {
    const byKey = Object.fromEntries(
      getDrillableFormsForVerb(verb('robic')).map((f) => [f.fullFormKey, f])
    );

    expect(byKey['robic:present:1sg']).toMatchObject({
      person: '1st',
      number: 'Singular',
      gender: undefined,
    });
    expect(byKey['robic:past:1sg_f']).toMatchObject({
      person: '1st',
      number: 'Singular',
      gender: 'Feminine',
    });
    expect(byKey['robic:past:3pl_m']).toMatchObject({
      person: '3rd',
      number: 'Plural',
      gender: 'Masculine',
    });
  });

  test('a verb without conjugation tables has no forms to drill', () => {
    expect(getDrillableFormsForVerb(verb('defective', { conjugations: {} }))).toEqual([]);
  });

  test('the same person in two tenses gives two separately scheduled forms', () => {
    const futureVerb = verb('zrobic', {
      conjugations: {
        present: stub<NonNullable<Verb['conjugations']['present']>>({
          '1sg': form('robię', ['I do']),
        }),
        future: stub<NonNullable<Verb['conjugations']['future']>>({
          '1sg': form('zrobię', ['I will do']),
        }),
      },
    });
    expect(getDrillableFormsForVerb(futureVerb).map((f) => f.fullFormKey)).toEqual([
      'zrobic:present:1sg',
      'zrobic:future:1sg',
    ]);
  });
});

describe('filters', () => {
  const forms = getDrillableFormsForVerb(verb('robic'));
  const matching = (f: Partial<ConjugationFilters>) =>
    forms.filter((form) => matchesFilters(form, filters(f))).map((form) => form.fullFormKey);

  test('no filters match every form', () => {
    expect(matching({})).toHaveLength(forms.length);
  });

  test('tense, person and number each narrow the forms', () => {
    expect(matching({ tenses: ['imperative'] })).toEqual(['robic:imperative:2sg']);
    expect(matching({ persons: ['3rd'] })).toEqual([
      'robic:present:3sg',
      'robic:present:3pl',
      'robic:past:3sg_m',
      'robic:past:3pl_m',
    ]);
    expect(matching({ number: 'Plural' })).toEqual(['robic:present:3pl', 'robic:past:3pl_m']);
    expect(matching({ tenses: ['past'], persons: ['3rd'], number: 'Singular' })).toEqual([
      'robic:past:3sg_m',
    ]);
  });

  test('aspect and verb class filter on the verb', () => {
    expect(matching({ aspects: ['Perfective'] })).toEqual([]);
    expect(matching({ aspects: ['Imperfective'] })).toHaveLength(forms.length);
    expect(matching({ verbClasses: ['-ać', 'Irregular'] })).toEqual([]);
  });

  test('a gender filter leaves out forms that have no gender', () => {
    expect(matching({ genders: ['Feminine'] })).toEqual(['robic:past:1sg_f']);
    expect(matching({ genders: ['Masculine', 'Feminine'] })).toEqual([
      'robic:past:1sg_f',
      'robic:past:3sg_m',
      'robic:past:3pl_m',
    ]);
  });
});

describe('session', () => {
  test('new forms follow the deck order, verb by verb and tense by tense', () => {
    const session = getSessionCards(
      conjugationDeck,
      [verb('a'), verb('b')].flatMap(getDrillableFormsForVerb),
      store(),
      { newCardsPerDay: 4 },
      filters({ tenses: ['present'] })
    );
    expect(keys(session.newCards)).toEqual([
      'a:present:1sg',
      'a:present:3sg',
      'a:present:3pl',
      'b:present:1sg',
    ]);
  });

  test('filters narrow the new forms but never hide a due review', () => {
    const due = { formKey: 'a:past:3sg_m', fsrsCard: graduated(-1) };
    const session = getSessionCards(
      conjugationDeck,
      [verb('a')].flatMap(getDrillableFormsForVerb),
      store({ cards: { [due.formKey]: due } }),
      { newCardsPerDay: 10 },
      filters({ tenses: ['imperative'] })
    );

    expect(keys(session.newCards)).toEqual(['a:imperative:2sg']);
    expect(keys(session.reviewCards)).toEqual(['a:past:3sg_m']);
  });

  test('forms introduced today under another filter still use up the daily allowance', () => {
    // Two present forms were introduced, then the learner switched to drilling the past.
    const introduced = ['a:present:1sg', 'a:present:3sg'];
    const session = getSessionCards(
      conjugationDeck,
      [verb('a')].flatMap(getDrillableFormsForVerb),
      store({ newCardsToday: introduced, reviewedToday: introduced }),
      { newCardsPerDay: 3 },
      filters({ tenses: ['past'] })
    );

    expect(keys(session.newCards)).toEqual(['a:past:1sg_f']);
  });

  test('each direction counts new forms against its own allowance', () => {
    const verbs = [verb('a')];
    const introduced = ['a:present:1sg', 'a:present:3sg'];
    const plToEn = store({ newCardsToday: introduced, reviewedToday: introduced });
    const enToPl = store();
    const settings = { 'pl-to-en': { newCardsPerDay: 2 }, 'en-to-pl': { newCardsPerDay: 3 } };

    const recognition = getSessionCards(
      conjugationDeck,
      verbs.flatMap(getDrillableFormsForVerb),
      plToEn,
      settings['pl-to-en'],
      getDefaultFilters()
    );
    const production = getSessionCards(
      conjugationDeck,
      verbs.flatMap(getDrillableFormsForVerb),
      enToPl,
      settings['en-to-pl'],
      getDefaultFilters()
    );

    expect(recognition.newCards).toEqual([]);
    expect(keys(production.newCards)).toEqual(['a:present:1sg', 'a:present:3sg', 'a:present:3pl']);
  });
});

describe('extra cards', () => {
  test('review early and extra new forms only offer forms matching the filters', () => {
    const forms = {
      'a:present:1sg': { formKey: 'a:present:1sg', fsrsCard: graduated(3) },
      'a:past:1sg_f': { formKey: 'a:past:1sg_f', fsrsCard: graduated(1) },
      'a:present:3sg': { formKey: 'a:present:3sg', fsrsCard: learning(10) },
    };
    const drillable = getDrillableFormsForVerb(verb('a'));
    const reviewStore = store({ cards: forms, newCardsToday: ['a:present:3pl'] });
    const presentOnly = filters({ tenses: ['present'] });
    const ahead = getPracticeAheadCards(conjugationDeck, drillable, reviewStore, 10, presentOnly);

    expect(keys(ahead)).toEqual(['a:present:1sg']);
    expect(ahead.every((c) => !c.isNew)).toBe(true);
    // 1sg and 3sg are studied and 3pl was already introduced today.
    expect(getExtraNewCards(conjugationDeck, drillable, reviewStore, 10, presentOnly)).toEqual([]);
  });

  test('extra new forms are marked new so they count toward today', () => {
    const cards = getExtraNewCards(
      conjugationDeck,
      getDrillableFormsForVerb(verb('a')),
      store(),
      2,
      getDefaultFilters()
    );
    expect(keys(cards)).toEqual(['a:present:1sg', 'a:present:3sg']);
    expect(cards.every((c) => c.isNew)).toBe(true);
  });
});

describe('question and answer in both directions', () => {
  const forms = Object.fromEntries(
    getDrillableFormsForVerb(verb('robic')).map((f) => [f.fullFormKey, f])
  );

  test('production asks in English and expects the Polish form', () => {
    expect(getQuestionDisplay(forms['robic:present:1sg'], 'en-to-pl')).toBe('I do / I make');
    expect(getAnswerDisplay(forms['robic:present:1sg'], 'en-to-pl')).toEqual({
      primary: 'robię',
      alternatives: undefined,
    });
  });

  test('recognition asks in Polish and expects the English meaning', () => {
    expect(getQuestionDisplay(forms['robic:past:1sg_f'], 'pl-to-en')).toBe('robiłam');
    expect(getAnswerDisplay(forms['robic:past:1sg_f'], 'pl-to-en')).toEqual({
      primary: 'I did',
    });
  });

  test('a genderless third person singular is shown as he/she/it in English', () => {
    const thirdSingular = forms['robic:present:3sg'];
    expect(getQuestionDisplay(thirdSingular, 'en-to-pl')).toBe('he/she/it does / makes');
    expect(getAnswerDisplay(thirdSingular, 'pl-to-en')).toEqual({
      primary: 'he/she/it does / makes',
    });
    // A gendered past form already says who: no prefix.
    expect(getQuestionDisplay(forms['robic:past:3sg_m'], 'en-to-pl')).toBe('he did');
  });

  test('Polish alternatives sharing a first word are shown compactly', () => {
    const withAlternatives = (pl: string, plAlternatives: string[]) =>
      stub<DrillableForm>({
        ...forms['robic:present:1sg'],
        form: form(pl, ['I will do'], plAlternatives),
      });

    expect(getQuestionDisplay(withAlternatives('będę robić', ['będę robił']), 'pl-to-en')).toBe(
      'będę robić / robił'
    );
    expect(getQuestionDisplay(withAlternatives('boję', ['boję się']), 'pl-to-en')).toBe(
      'boję / boję + się'
    );
    expect(getQuestionDisplay(withAlternatives('idę', ['pójdę']), 'pl-to-en')).toBe('idę / pójdę');
    expect(getAnswerDisplay(withAlternatives('będę robić', ['będę robił']), 'en-to-pl')).toEqual({
      primary: 'będę robić',
      alternatives: ['będę robił'],
    });
  });
});

test('labels name every tense, aspect and verb class, passing unknown ones through', () => {
  expect(getTenseLabel('conditional')).toContain('Conditional');
  expect(getTenseLabel('past')).toContain('Past');
  expect(getAspectLabel('Perfective')).toContain('Perfective');
  expect(getAspectLabel('Something else')).toBe('Something else');
  expect(getVerbClassLabel('Irregular')).toContain('Irregular');
  expect(getVerbClassLabel('-ować')).toBe('-ować');
});
