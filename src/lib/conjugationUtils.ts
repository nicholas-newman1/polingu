import type {
  Verb,
  Tense,
  Person,
  GrammaticalNumber,
  ConjugationGender,
  ConjugationForm,
  DrillableForm,
  ConjugationFilters,
  ConjugationDirection,
  ConditionalFormKey,
} from '../types/conjugation';
import {
  PRESENT_FORM_KEYS,
  PAST_FORM_KEYS,
  FUTURE_FORM_KEYS,
  IMPERATIVE_FORM_KEYS,
  CONDITIONAL_FORM_KEYS,
} from '../types/conjugation';

const THIRD_PERSON_SUBJECTS = ['he', 'she', 'it', ''];

export function parseFormKey(formKey: string): {
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

export function getFullFormKey(verbId: string, tense: Tense, formKey: string): string {
  return `${verbId}:${tense}:${formKey}`;
}

export function parseFullFormKey(fullFormKey: string): {
  verbId: string;
  tense: Tense;
  formKey: string;
} {
  const [verbId, tense, formKey] = fullFormKey.split(':');
  return { verbId, tense: tense as Tense, formKey };
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

  if (verb.aspect === 'Imperfective') {
    addForms('present', PRESENT_FORM_KEYS, verb.conjugations.present);
  }
  addForms('past', PAST_FORM_KEYS, verb.conjugations.past);
  addForms('future', FUTURE_FORM_KEYS, verb.conjugations.future);
  addForms('imperative', IMPERATIVE_FORM_KEYS, verb.conjugations.imperative);
  addForms(
    'conditional',
    CONDITIONAL_FORM_KEYS as ConditionalFormKey[],
    verb.conjugations.conditional
  );

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

export function format3sgDisplay(translations: string[]): string {
  return 'he/she/it ' + translations.join(' / ');
}

export function formatCompoundAlternatives(primary: string, alternatives: string[]): string {
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

export function validate3sgAnswer(userAnswer: string, storedVerbs: string[]): boolean {
  const normalized = userAnswer
    .toLowerCase()
    .trim()
    .replace(/[.,!?]/g, '');

  for (const verb of storedVerbs) {
    const normalizedVerb = verb
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '');
    for (const subject of THIRD_PERSON_SUBJECTS) {
      const expected = subject ? `${subject} ${normalizedVerb}` : normalizedVerb;
      if (normalized === expected) return true;
    }
  }
  return false;
}

export function checkAnswer(
  userAnswer: string,
  form: ConjugationForm,
  direction: ConjugationDirection,
  is3sgNonGendered: boolean
): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '');

  if (direction === 'en-to-pl') {
    const normalizedAnswer = normalize(userAnswer);
    if (normalizedAnswer === normalize(form.pl)) return true;
    if (form.plAlternatives) {
      return form.plAlternatives.some((alt) => normalizedAnswer === normalize(alt));
    }
    return false;
  } else {
    if (is3sgNonGendered) {
      return validate3sgAnswer(userAnswer, form.en);
    }
    return form.en.some((valid) => normalize(userAnswer) === normalize(valid));
  }
}

export function getQuestionDisplay(form: DrillableForm, direction: ConjugationDirection): string {
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
  direction: ConjugationDirection
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

export function getPersonNumberLabel(person: Person, number: GrammaticalNumber): string {
  const personLabels: Record<Person, string> = {
    '1st': 'I / We',
    '2nd': 'You',
    '3rd': 'He/She/It / They',
  };

  const numberSuffix = number === 'Singular' ? '(sg)' : '(pl)';
  return `${personLabels[person]} ${numberSuffix}`;
}

export function getGenderLabel(gender: ConjugationGender): string {
  return gender;
}

export function getTenseLabel(tense: Tense): string {
  const labels: Record<Tense, string> = {
    present: 'Present',
    past: 'Past',
    future: 'Future',
    imperative: 'Imperative',
    conditional: 'Conditional',
  };
  return labels[tense];
}

export function getAspectLabel(aspect: string): string {
  return aspect;
}

export function getVerbClassLabel(verbClass: string): string {
  return verbClass;
}
