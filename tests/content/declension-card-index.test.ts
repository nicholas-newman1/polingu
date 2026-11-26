import { describe, expect, test } from 'vitest';
import { CASES, GENDERS, NUMBERS } from '../../src/constants';
import type { Case, Gender, Number as GrammaticalNumber } from '../../src/types';
import { expectOnlyAllowlisted, readRepoJson, readRepoText, violationsOf } from './repo';

/**
 * declensionCardIndex.json is the local mirror of the built-in declension deck in Firestore.
 * `declension:import` reads it to reject duplicate ids and fronts, so a bad entry here lets a
 * duplicate card overwrite another one (and the review history keyed by its id).
 */
interface IndexedCard {
  id: number;
  front: string;
  case: Case;
  gender: Gender;
  number: GrammaticalNumber;
}

const cards = readRepoJson<IndexedCard[]>('declensionCardIndex.json');
const spec = readRepoText('DECLENSION.md');

/** `___ (base)`, optionally followed by the ` (pl)` marker (DECLENSION.md, "Front"). */
const PROMPT = /___ \(([^()]+)\)( \(pl\))?/;

interface Prompt {
  /** The word or phrase in parentheses after the blank. */
  base: string;
  plMarker: boolean;
  /** Lower-case words before the blank, punctuation removed. */
  before: string[];
  /** Everything after the base form (and marker). */
  after: string;
}

function parsePrompt(front: string): Prompt | undefined {
  const match = PROMPT.exec(front);
  if (!match) return undefined;
  return {
    base: match[1],
    plMarker: match[2] !== undefined,
    before: front
      .slice(0, match.index)
      .toLowerCase()
      .split(/[\s,.!?:;"„”]+/)
      .filter(Boolean),
    after: front.slice(match.index + match[0].length),
  };
}

const prompted = cards.flatMap((card) => {
  const prompt = parsePrompt(card.front);
  return prompt ? [{ card, prompt }] : [];
});
type Prompted = (typeof prompted)[number];
const cardId = ({ card }: Prompted) => card.id;

const endsWithWords = (words: string[], phrase: string) => {
  const tail = phrase.split(' ');
  return tail.every((word, i) => words[words.length - tail.length + i] === word);
};

describe('declension card index records', () => {
  test('every card has exactly the indexed fields, with values the app knows', () => {
    const fields = ['case', 'front', 'gender', 'id', 'number'];
    const problems = violationsOf(
      cards,
      (card) => card.id,
      (card) =>
        (Object.keys(card).sort().join() !== fields.join() && `fields ${Object.keys(card)}`) ||
        (typeof card.front !== 'string' && 'front is not a string') ||
        (!CASES.includes(card.case) && `case ${card.case}`) ||
        (!GENDERS.includes(card.gender) && `gender ${card.gender}`) ||
        (!NUMBERS.includes(card.number) && `number ${card.number}`)
    );
    expect([...problems]).toEqual([]);
  });

  test('ids are unique positive integers in ascending order', () => {
    const ids = cards.map((card) => card.id);
    expect(ids.filter((id) => !Number.isInteger(id) || id < 1)).toEqual([]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  test('ids of deleted cards are not reused', () => {
    // Review history is stored per card id, so a new card under an old id would inherit a
    // deleted card's schedule and never be introduced as new. These are the gaps in the id
    // sequence; add an id here when a built-in card is deleted.
    const RETIRED_IDS = [305, 311, 323, 326, 334, 336, 363, 368, 430, 441, 451, 522, 533, 541];
    const ids = new Set(cards.map((card) => card.id));
    expect(RETIRED_IDS.filter((id) => ids.has(id))).toEqual([]);
    const max = Math.max(...ids);
    const gaps = Array.from({ length: max }, (_, i) => i + 1).filter((id) => !ids.has(id));
    expect(gaps, 'a card was deleted: add its id to RETIRED_IDS').toEqual(RETIRED_IDS);
  });

  test('no two cards share a front prompt, ignoring case and spacing', () => {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    for (const { id, front } of cards) {
      const key = front.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) duplicates.push(`${seen.get(key)} and ${id}: ${front}`);
      seen.set(key, id);
    }
    expect(duplicates).toEqual([]);
  });

  test('every built-in case has cards in both numbers', () => {
    const missing = CASES.flatMap((grammaticalCase) =>
      NUMBERS.filter(
        (number) => !cards.some((card) => card.case === grammaticalCase && card.number === number)
      ).map((number) => `${grammaticalCase} ${number}`)
    );
    expect(missing).toEqual([]);
  });
});

describe('declension card front prompts', () => {
  test('have exactly one ___ blank, directly followed by the base form in parentheses', () => {
    const problems = violationsOf(
      cards,
      (card) => card.id,
      ({ front }) => {
        const blanks = front.match(/_+/g) ?? [];
        if (blanks.length !== 1 || blanks[0] !== '___') return `blanks ${blanks}: ${front}`;
        const prompt = parsePrompt(front);
        if (!prompt) return `no "(base form)" after the blank: ${front}`;
        if (prompt.base.trim() !== prompt.base || !prompt.base) return `base form: ${front}`;
        const parentheses = front.match(/\([^()]*\)/g) ?? [];
        if (parentheses.length !== (prompt.plMarker ? 2 : 1)) return `extra parentheses: ${front}`;
      }
    );
    expect([...problems]).toEqual([]);
  });

  test('are trimmed and single-spaced', () => {
    const problems = violationsOf(
      cards,
      (card) => card.id,
      ({ front }) =>
        (front !== front.trim() || / {2}/.test(front) || /\s[.!?,]/.test(front)) &&
        JSON.stringify(front)
    );
    expect([...problems]).toEqual([]);
  });

  test('are sentences that start with a capital or the blank and end with . ! or ?', () => {
    const problems = violationsOf(
      cards,
      (card) => card.id,
      ({ front }) => (!/^(___|\p{Lu})/u.test(front) || !/[.!?]$/.test(front)) && front
    );
    expect([...problems]).toEqual([]);
  });

  test('carry the (pl) marker only on Plural cards', () => {
    const problems = violationsOf(
      prompted,
      cardId,
      ({ card, prompt }) => prompt.plMarker && card.number !== 'Plural' && card.front
    );
    expect([...problems]).toEqual([]);
  });

  test('mark every Plural card with (pl), except plural pronouns', () => {
    // A learner sees only the front, so without the marker a plural card reads as singular.
    // Pronoun base forms (my, wy, oni) are plural in themselves and have no singular to mark.
    const problems = violationsOf(
      prompted,
      cardId,
      ({ card, prompt }) =>
        card.number === 'Plural' && !prompt.plMarker && card.gender !== 'Pronoun' && card.front
    );
    expectOnlyAllowlisted(problems, {
      // Pluralia tantum: drzwi has no singular to show, and is plural in itself.
      142: 'Mężczyzna uderza pięścią o ___ (drzwi).',
      166: 'Wyjdź za ___ (drzwi).',
    });
  });

  test('show a nominative singular base form whose ending fits the card gender', () => {
    // Applies where DECLENSION.md says the base is the nominative singular: Singular cards and
    // Plural cards with the (pl) marker. Checks the last word, so "mój przyjaciel" counts as
    // masculine. Masculine allows -a (kolega, kierowca) and adjective -y/-i (czerwony, polski);
    // feminine allows -a, -i (pani) and a consonant (noc); neuter needs -o, -e, -ę or -um.
    const fits: Record<Exclude<Gender, 'Pronoun'>, RegExp> = {
      Masculine: /([^aąeęioóuy]|[ayi])$/,
      Feminine: /([^aąeęioóuy]|[ai])$/,
      Neuter: /([oeę]|um)$/,
    };
    const problems = violationsOf(
      prompted,
      cardId,
      ({ card, prompt }) =>
        card.gender !== 'Pronoun' &&
        (card.number === 'Singular' || prompt.plMarker) &&
        !fits[card.gender].test(prompt.base.split(' ').at(-1)!.toLowerCase()) &&
        `${card.gender}: ${card.front}`
    );
    expectOnlyAllowlisted(problems, {
      // Genuine exception: książę (prince) is a masculine noun ending in -ę.
      380: 'Masculine: Kłaniam się ___ (książę).',
    });
  });

  test('use the Pronoun gender exactly when the base form is a personal pronoun, in its number', () => {
    // siebie has no nominative and no number of its own.
    const PRONOUN_NUMBER: Record<string, GrammaticalNumber | undefined> = {
      ja: 'Singular',
      ty: 'Singular',
      on: 'Singular',
      ona: 'Singular',
      ono: 'Singular',
      my: 'Plural',
      wy: 'Plural',
      oni: 'Plural',
      one: 'Plural',
      'oni / one': 'Plural',
      siebie: undefined,
    };
    const problems = violationsOf(prompted, cardId, ({ card, prompt }) => {
      const base = prompt.base.toLowerCase();
      const isPronoun = base in PRONOUN_NUMBER;
      if (isPronoun !== (card.gender === 'Pronoun')) return `${card.gender}: ${card.front}`;
      const number = PRONOUN_NUMBER[base];
      if (isPronoun && number && number !== card.number) return `${card.number}: ${card.front}`;
    });
    expect([...problems]).toEqual([]);
  });

  test('test the Vocative exactly when the blank is a direct address set off by punctuation', () => {
    const problems = violationsOf(prompted, cardId, ({ card, prompt }) => {
      const addressed =
        /^[!,?]/.test(prompt.after) && /^(|.*[,.!?])\s*$/.test(card.front.split('___')[0]);
      const onlyAnExclamation = /^___ \([^()]+\)( \(pl\))?!$/.test(card.front);
      if (card.case === 'Vocative' && !addressed) return `not an address: ${card.front}`;
      if (card.case !== 'Vocative' && onlyAnExclamation) return `${card.case}: ${card.front}`;
    });
    expect([...problems]).toEqual([]);
  });
});

/**
 * Prepositions and the cases they take. A superset of the table in DECLENSION.md (checked
 * below): it adds prepositions the deck uses that the table leaves out, and the accusative of
 * motion or purpose ("walczyć o", "wejść przed") that the table omits.
 */
const PREPOSITION_CASES: Record<string, Case[]> = {
  ...Object.fromEntries(
    [
      'do',
      'od',
      'bez',
      'dla',
      'obok',
      'podczas',
      'u',
      'koło',
      'wokół',
      'oprócz',
      'zamiast',
      'według',
      'pomimo',
      'mimo',
      'wśród',
      'pośród',
      'spośród',
      'spod',
      'sprzed',
      'znad',
      'zza',
      'spomiędzy',
      'naprzeciwko',
      'wskutek',
      'blisko',
    ].map((preposition) => [preposition, ['Genitive']])
  ),
  ...Object.fromEntries(
    ['dzięki', 'przeciw', 'przeciwko', 'ku'].map((preposition) => [preposition, ['Dative']])
  ),
  przez: ['Accusative'],
  przeze: ['Accusative'],
  z: ['Genitive', 'Instrumental'],
  ze: ['Genitive', 'Instrumental'],
  w: ['Accusative', 'Locative'],
  we: ['Accusative', 'Locative'],
  na: ['Accusative', 'Locative'],
  o: ['Accusative', 'Locative'],
  po: ['Accusative', 'Locative'],
  pod: ['Accusative', 'Instrumental'],
  nad: ['Accusative', 'Instrumental'],
  za: ['Accusative', 'Instrumental'],
  przed: ['Accusative', 'Instrumental'],
  między: ['Accusative', 'Instrumental'],
  przy: ['Locative'],
};

/** Verbs from DECLENSION.md's "Verbs with Non-Accusative Objects", with stems of their forms. */
const GOVERNING_VERBS: Record<string, { case: Case; stems: string[] }> = {
  szukać: { case: 'Genitive', stems: ['szuka'] },
  potrzebować: { case: 'Genitive', stems: ['potrzebuj', 'potrzebowa'] },
  używać: { case: 'Genitive', stems: ['używa', 'użył'] },
  słuchać: { case: 'Genitive', stems: ['słucha'] },
  unikać: { case: 'Genitive', stems: ['unika'] },
  'bać się': { case: 'Genitive', stems: ['boj', 'boi', 'bał'] },
  pilnować: { case: 'Genitive', stems: ['pilnuj', 'pilnowa'] },
  dotykać: { case: 'Genitive', stems: ['dotyka'] },
  żałować: { case: 'Genitive', stems: ['żałuj', 'żałowa'] },
  wymagać: { case: 'Genitive', stems: ['wymaga'] },
  pomagać: { case: 'Dative', stems: ['pomaga'] },
  dziękować: { case: 'Dative', stems: ['dziękuj', 'dziękowa'] },
  ufać: { case: 'Dative', stems: ['ufa'] },
  wierzyć: { case: 'Dative', stems: ['wierz'] },
  doradzać: { case: 'Dative', stems: ['doradza'] },
  przeszkadzać: { case: 'Dative', stems: ['przeszkadza'] },
  gratulować: { case: 'Dative', stems: ['gratuluj', 'gratulowa'] },
  współczuć: { case: 'Dative', stems: ['współczuj', 'współczu'] },
  zazdrościć: { case: 'Dative', stems: ['zazdroszcz', 'zazdrości'] },
  'interesować się': { case: 'Instrumental', stems: ['interesuj', 'interesowa'] },
  'zajmować się': { case: 'Instrumental', stems: ['zajmuj', 'zajmowa'] },
  kierować: { case: 'Instrumental', stems: ['kieruj', 'kierowa'] },
  władać: { case: 'Instrumental', stems: ['włada'] },
};

/** Words after which DECLENSION.md says the noun is genitive: quantities and negation. */
const GENITIVE_QUANTITIES = [
  'dużo',
  'mało',
  'trochę',
  'kilogram',
  'litr',
  'wiele',
  'wielu',
  'więcej',
  'pełno',
  'pięć',
  'sześć',
  'pół',
  'połowę',
  'szklankę',
  'butelkę',
  'kawałek',
  'łyżeczkę',
  'porcję',
  'paczkę',
  'garść',
  'miskę',
  'szczyptę',
  'kroplę',
  'worek',
  'zestaw',
];
const GENITIVE_NEGATIONS = ['nie ma', 'nie mam', 'nie mamy', 'nie widzę'];

describe('declension card cases agree with the grammar in DECLENSION.md', () => {
  test('a blank right after a preposition takes a case that preposition governs', () => {
    const problems = violationsOf(prompted, cardId, ({ card, prompt }) => {
      const allowed = PREPOSITION_CASES[prompt.before.at(-1) ?? ''];
      return allowed && !allowed.includes(card.case) && `${card.case}: ${card.front}`;
    });
    expect([...problems]).toEqual([]);
  });

  test('a blank right after a case-governing verb takes that verb’s case', () => {
    const governingCase = ({ before }: Prompt) => {
      for (const [infinitive, { case: governed, stems }] of Object.entries(GOVERNING_VERBS)) {
        const reflexive = infinitive.endsWith(' się');
        const verb = reflexive && before.at(-1) === 'się' ? before.at(-2) : before.at(-1);
        if (reflexive && before.at(-1) !== 'się') continue;
        if (verb && stems.some((stem) => verb.startsWith(stem))) return governed;
      }
    };
    const problems = violationsOf(prompted, cardId, ({ card, prompt }) => {
      const governed = governingCase(prompt);
      return governed && governed !== card.case && `${governed} expected: ${card.front}`;
    });
    expect([...problems]).toEqual([]);
  });

  test('a blank right after a quantity word or a negated "mieć"/"widzieć" is Genitive', () => {
    const problems = violationsOf(
      prompted,
      cardId,
      ({ card, prompt }) =>
        (GENITIVE_QUANTITIES.includes(prompt.before.at(-1) ?? '') ||
          GENITIVE_NEGATIONS.some((phrase) => endsWithWords(prompt.before, phrase))) &&
        card.case !== 'Genitive' &&
        `${card.case}: ${card.front}`
    );
    expect([...problems]).toEqual([]);
  });
});

describe('the grammar these checks rely on matches DECLENSION.md', () => {
  const union = (name: string) => {
    const match = new RegExp(`type ${name} = ([^;]+);`).exec(spec);
    return match?.[1].split('|').map((member) => member.trim().replace(/'/g, ''));
  };

  test('the documented Case, Gender and NumberType unions list the same values as the app', () => {
    expect(union('Case')).toEqual(CASES);
    expect(union('Gender')).toEqual(GENDERS);
    expect(union('NumberType')).toEqual(NUMBERS);
  });

  test('every row of the preposition table is allowed by the preposition check', () => {
    const rows = [...spec.matchAll(/^\| ([^|]+?) \| (\w+) \| [^|]+ \|$/gm)].filter(([, , c]) =>
      CASES.includes(c as Case)
    );
    expect(rows.length).toBeGreaterThan(10);
    const missing = rows.flatMap(([, prepositions, governed]) =>
      prepositions
        .split('/')
        .filter((p) => !PREPOSITION_CASES[p]?.includes(governed as Case))
        .map((p) => `${p} + ${governed}`)
    );
    expect(missing).toEqual([]);
  });

  test('every listed non-accusative verb is checked with the case the list gives it', () => {
    const lists = [...spec.matchAll(/^\*\*(\w+):\*\* (.+)$/gm)];
    expect(lists.map(([, governed]) => governed)).toEqual(['Genitive', 'Dative', 'Instrumental']);
    const mismatched = lists.flatMap(([, governed, verbs]) =>
      verbs
        .split(',')
        .map((verb) => verb.trim())
        .filter((verb) => GOVERNING_VERBS[verb]?.case !== governed)
    );
    expect(mismatched).toEqual([]);
  });

  test('the documented genitive triggers are all checked', () => {
    const quantities = /After quantity words \(([^)]+)\)/.exec(spec)?.[1].split(', ');
    const negations = /After negation \(([^)]+)\)/.exec(spec)?.[1].split(', ');
    expect(quantities?.length).toBeGreaterThan(0);
    expect(negations?.length).toBeGreaterThan(0);
    expect(GENITIVE_QUANTITIES).toEqual(expect.arrayContaining(quantities!));
    expect(GENITIVE_NEGATIONS).toEqual(expect.arrayContaining(negations!));
  });
});
