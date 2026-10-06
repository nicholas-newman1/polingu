import type {
  Verb,
  Tense,
  Person,
  GrammaticalNumber,
  ConjugationGender,
  ConjugationForm,
  DrillableForm,
  ConjugationFilters,
  ConditionalFormKey,
} from '../types/conjugation';
import type { TranslationDirection } from '../types/common';
import {
  PRESENT_FORM_KEYS,
  PAST_FORM_KEYS,
  FUTURE_FORM_KEYS,
  IMPERATIVE_FORM_KEYS,
  CONDITIONAL_FORM_KEYS,
} from '../types/conjugation';

function parseFormKey(formKey: string): {
  person: Person;
  number: GrammaticalNumber;
  gender?: ConjugationGender;
} {
  const personMap: Record<string, Person> = {
    '1': '1st',
    '2': '2nd',
    '3': '3rd',
  };

  const match = formKey.match(/^(\d)(sg|pl)(?:_([mfn]))?$/);
  if (!match) {
    throw new Error(`Invalid form key: ${formKey}`);
  }

  const [, personNum, numStr, genderChar] = match;
  const person = personMap[personNum];
  const number: GrammaticalNumber = numStr === 'sg' ? 'Singular' : 'Plural';

  let gender: ConjugationGender | undefined;
  if (genderChar === 'm') gender = 'Masculine';
  else if (genderChar === 'f') gender = 'Feminine';
  else if (genderChar === 'n') gender = 'Neuter';

  return { person, number, gender };
}

function getFullFormKey(verbId: string, tense: Tense, formKey: string): string {
  return `${verbId}:${tense}:${formKey}`;
}

export function getDrillableFormsForVerb(verb: Verb): DrillableForm[] {
  const forms: DrillableForm[] = [];

  const addForms = <T extends string>(
    tense: Tense,
    formKeys: T[],
    conjugations: Record<T, ConjugationForm>
  ) => {
    for (const formKey of formKeys) {
      const form = conjugations[formKey];
      if (!form) continue;

      const { person, number, gender } = parseFormKey(formKey);
      forms.push({
        verb,
        tense,
        formKey,
        form,
        person,
        number,
        gender,
        fullFormKey: getFullFormKey(verb.id, tense, formKey),
      });
    }
  };

  if (verb.conjugations.present) {
    addForms('present', PRESENT_FORM_KEYS, verb.conjugations.present);
  }
  if (verb.conjugations.past) {
    addForms('past', PAST_FORM_KEYS, verb.conjugations.past);
  }
  if (verb.conjugations.future) {
    addForms('future', FUTURE_FORM_KEYS, verb.conjugations.future);
  }
  if (verb.conjugations.imperative) {
    addForms('imperative', IMPERATIVE_FORM_KEYS, verb.conjugations.imperative);
  }
  if (verb.conjugations.conditional) {
    addForms(
      'conditional',
      CONDITIONAL_FORM_KEYS as ConditionalFormKey[],
      verb.conjugations.conditional
    );
  }

  return forms;
}

export function matchesFilters(form: DrillableForm, filters: ConjugationFilters): boolean {
  if (filters.tenses.length > 0 && !filters.tenses.includes(form.tense)) {
    return false;
  }

  if (filters.persons.length > 0 && !filters.persons.includes(form.person)) {
    return false;
  }

  if (filters.number !== 'All' && form.number !== filters.number) {
    return false;
  }

  if (filters.aspects.length > 0 && !filters.aspects.includes(form.verb.aspect)) {
    return false;
  }

  if (filters.verbClasses.length > 0 && !filters.verbClasses.includes(form.verb.verbClass)) {
    return false;
  }

  if (filters.genders.length > 0) {
    if (!form.gender || !filters.genders.includes(form.gender)) {
      return false;
    }
  }

  return true;
}

export function getDefaultFilters(): ConjugationFilters {
  return {
    tenses: [],
    persons: [],
    number: 'All',
    aspects: [],
    verbClasses: [],
    genders: [],
  };
}

function format3sgDisplay(translations: string[]): string {
  return 'he/she/it ' + translations.join(' / ');
}

function formatCompoundAlternatives(primary: string, alternatives: string[]): string {
  const allForms = [primary, ...alternatives];
  const firstWords = allForms.map((f) => f.split(' ')[0]);
  const allSamePrefix = firstWords.every((w) => w === firstWords[0]);

  if (allSamePrefix) {
    const prefix = firstWords[0];
    const suffixes = allForms.map((f) => f.slice(prefix.length).trim());
    const primarySuffix = suffixes[0];

    if (primarySuffix) {
      return `${prefix} ${suffixes.join(' / ')}`;
    } else {
      const altSuffixes = suffixes.slice(1);
      return `${prefix} / ${prefix} + ${altSuffixes.join('/')}`;
    }
  }

  return allForms.join(' / ');
}

export function getQuestionDisplay(form: DrillableForm, direction: TranslationDirection): string {
  if (direction === 'en-to-pl') {
    const is3sgNonGendered =
      form.person === '3rd' &&
      form.number === 'Singular' &&
      !form.gender &&
      (form.tense === 'present' || form.tense === 'future');

    if (is3sgNonGendered) {
      return format3sgDisplay(form.form.en);
    }
    return form.form.en.join(' / ');
  } else {
    if (form.form.plAlternatives && form.form.plAlternatives.length > 0) {
      return formatCompoundAlternatives(form.form.pl, form.form.plAlternatives);
    }
    return form.form.pl;
  }
}

export function getAnswerDisplay(
  form: DrillableForm,
  direction: TranslationDirection
): { primary: string; alternatives?: string[] } {
  if (direction === 'en-to-pl') {
    return {
      primary: form.form.pl,
      alternatives: form.form.plAlternatives,
    };
  } else {
    const is3sgNonGendered =
      form.person === '3rd' &&
      form.number === 'Singular' &&
      !form.gender &&
      (form.tense === 'present' || form.tense === 'future');

    if (is3sgNonGendered) {
      return { primary: format3sgDisplay(form.form.en) };
    }
    return { primary: form.form.en.join(' / ') };
  }
}

export function getTenseLabel(tense: Tense): string {
  const labels: Record<Tense, string> = {
    present: '● Present',
    past: '◀ Past',
    future: '▶ Future',
    imperative: '☞ Imperative',
    conditional: '◇ Conditional',
  };
  return labels[tense];
}

export function getAspectLabel(aspect: string): string {
  const labels: Record<string, string> = {
    Perfective: '✓ Perfective',
    Imperfective: '↻ Imperfective',
  };
  return labels[aspect] ?? aspect;
}

export function getVerbClassLabel(verbClass: string): string {
  if (verbClass === 'Irregular') return '✱ Irregular';
  return verbClass;
}
