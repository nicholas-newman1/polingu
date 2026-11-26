import { describe, expect, test } from 'vitest';
import {
  ASPECT_INFO,
  CONJUGATION_PATTERNS,
  PERSON_ENDINGS,
  TENSE_INFO,
} from '../../src/data/conjugationPatterns';
import {
  ALL_ASPECTS,
  ALL_TENSES,
  ALL_VERB_CLASSES,
  PRESENT_FORM_KEYS,
  TENSE_LABELS,
  type Aspect,
  type VerbClass,
} from '../../src/types/conjugation';
import { readRepoJson, violationsOf } from './repo';

const verbIndex =
  readRepoJson<{ infinitive: string; aspect: Aspect; verbClass: VerbClass }[]>('verbIndex.json');

/** "-ić/-yć" → ["-ić", "-yć"]; "-ię/-ę" → ["-ię", "-ę"]. */
const alternatives = (text: string) => text.split('/').map((part) => part.trim());
const bare = (ending: string) => ending.replace(/^-/, '');
const presentEndings = (pattern: (typeof CONJUGATION_PATTERNS)[number]) => [
  ...pattern.presentEndings.singular,
  ...pattern.presentEndings.plural,
];

describe('conjugation cheat sheet patterns', () => {
  test('cover each regular verb class once, using only classes the app knows', () => {
    const classes = CONJUGATION_PATTERNS.flatMap((pattern) => alternatives(pattern.verbClass));
    expect([...classes].sort()).toEqual(
      ALL_VERB_CLASSES.filter((verbClass) => verbClass !== 'Irregular').sort()
    );
  });

  test('give the infinitive ending of their own class', () => {
    for (const pattern of CONJUGATION_PATTERNS) {
      expect(pattern.infinitiveEnding).toBe(pattern.verbClass);
    }
  });

  test('use an example verb of their own class, agreeing with the verb index', () => {
    const problems = violationsOf(
      CONJUGATION_PATTERNS,
      (pattern) => pattern.verbClass,
      ({ verbClass, exampleVerb }) => {
        const classes = alternatives(verbClass);
        // Longest ending first, so -ować is not mistaken for -ać.
        const ending = [...ALL_VERB_CLASSES]
          .sort((a, b) => b.length - a.length)
          .find((c) => c !== 'Irregular' && exampleVerb.endsWith(bare(c)));
        if (!ending || !classes.includes(ending)) return `${exampleVerb} ends in ${ending}`;
        const indexed = verbIndex.find((verb) => verb.infinitive === exampleVerb);
        if (indexed && !classes.includes(indexed.verbClass)) {
          return `${exampleVerb} is ${indexed.verbClass} in verbIndex.json`;
        }
      }
    );
    expect([...problems]).toEqual([]);
  });

  test('produce the textbook present tense of a verb from each class they cover', () => {
    // Present tense in PRESENT_FORM_KEYS order. The example verbs, plus uczyć for -yć.
    const reference: Record<string, [infinitive: string, forms: string[]]> = {
      '-ać': ['czytać', ['czytam', 'czytasz', 'czyta', 'czytamy', 'czytacie', 'czytają']],
      '-ić': ['robić', ['robię', 'robisz', 'robi', 'robimy', 'robicie', 'robią']],
      '-yć': ['uczyć', ['uczę', 'uczysz', 'uczy', 'uczymy', 'uczycie', 'uczą']],
      '-eć': ['umieć', ['umiem', 'umiesz', 'umie', 'umiemy', 'umiecie', 'umieją']],
      '-ować': [
        'pracować',
        ['pracuję', 'pracujesz', 'pracuje', 'pracujemy', 'pracujecie', 'pracują'],
      ],
    };
    for (const pattern of CONJUGATION_PATTERNS) {
      // "-ię/-ę" under "-ić/-yć": the n-th alternative belongs to the n-th class.
      alternatives(pattern.verbClass).forEach((verbClass, n) => {
        const [infinitive, expected] = reference[verbClass];
        const stem = infinitive.slice(0, -bare(verbClass).length);
        const forms = presentEndings(pattern).map((ending) => {
          const options = alternatives(ending);
          return stem + bare(options[n] ?? options[0]);
        });
        expect(forms, verbClass).toEqual(expected);
      });
    }
  });

  test('keep the 2nd person singular theme vowel through 3sg, 1pl and 2pl', () => {
    // Polish present tense: 2sg = theme + -sz, 3sg = theme, 1pl = theme + -my,
    // 2pl = theme + -cie, and 3pl ends in -ą. Checked for each slash alternative.
    for (const pattern of CONJUGATION_PATTERNS) {
      const [, second, third, firstPl, secondPl, thirdPl] =
        presentEndings(pattern).map(alternatives);
      second.forEach((ending, i) => {
        expect(ending, pattern.verbClass).toMatch(/sz$/);
        const theme = ending.slice(0, -2);
        expect([third[i], firstPl[i], secondPl[i]], pattern.verbClass).toEqual([
          theme,
          `${theme}my`,
          `${theme}cie`,
        ]);
      });
      for (const ending of thirdPl) expect(ending, pattern.verbClass).toMatch(/ą$/);
    }
  });

  test('give past endings -ł/-ła/-ło built on the vowel of each infinitive ending', () => {
    // The past stem is the infinitive minus -ć, plus -ł (robić → robił, myć → mył), except
    // that -eć verbs change e to a (umieć → umiał). A combined class gives one
    // masculine/feminine/neuter set per class, in class order: "-ił/-iła/-iło, -ył/-yła/-yło".
    const problems = violationsOf(
      CONJUGATION_PATTERNS,
      (pattern) => pattern.verbClass,
      ({ verbClass, pastStem }) => {
        const expected = alternatives(verbClass)
          .map((c) => (c === '-eć' ? '-ał' : `${c.slice(0, -1)}ł`))
          .map((masculine) => `${masculine}/${masculine}a/${masculine}o`)
          .join(', ');
        return pastStem !== expected && `${pastStem}, expected ${expected}`;
      }
    );
    expect([...problems]).toEqual([]);
  });
});

describe('person endings on the conjugation cheat sheet', () => {
  const { past, conditional } = PERSON_ENDINGS;

  test('present labels and pronouns name the six persons in form-key order', () => {
    const { labels, pronouns } = PERSON_ENDINGS.present;
    expect(labels).toHaveLength(PRESENT_FORM_KEYS.length);
    expect(pronouns).toHaveLength(PRESENT_FORM_KEYS.length);
    PRESENT_FORM_KEYS.forEach((key, i) => {
      expect(labels[i]).toMatch(
        new RegExp(`^${key[0]}\\D+ ${key.endsWith('sg') ? 'sing' : 'plur'}`)
      );
    });
  });

  test('past 3rd person forms are -ł, -ła, -ło and -li (masculine personal), -ły', () => {
    expect([
      past.masculine.singular[2],
      past.feminine.singular[2],
      past.neuter.singular[2],
    ]).toEqual(['-ł', '-ła', '-ło']);
    expect([past.masculine.plural[2], past.feminine.plural[2], past.neuter.plural[2]]).toEqual([
      '-li',
      '-ły',
      '-ły',
    ]);
  });

  test('past 1st and 2nd person forms add the personal suffix to the 3rd person form', () => {
    const withSuffixes = (third: string, suffixes: [string, string]) => [
      third + suffixes[0],
      third + suffixes[1],
      third,
    ];
    expect(past.masculine.singular).toEqual(withSuffixes('-ł', ['em', 'eś']));
    expect(past.feminine.singular).toEqual(withSuffixes('-ła', ['m', 'ś']));
    expect(past.masculine.plural).toEqual(withSuffixes('-li', ['śmy', 'ście']));
    expect(past.feminine.plural).toEqual(withSuffixes('-ły', ['śmy', 'ście']));
    // Neuter has no 1st or 2nd person forms.
    expect([...past.neuter.singular.slice(0, 2), ...past.neuter.plural.slice(0, 2)]).toEqual([
      '—',
      '—',
      '—',
      '—',
    ]);
  });

  test('conditional forms are the past 3rd person form + -by- + the personal ending', () => {
    for (const gender of ['masculine', 'feminine'] as const) {
      for (const [number, suffixes] of [
        ['singular', ['m', 'ś', '']],
        ['plural', ['śmy', 'ście', '']],
      ] as const) {
        const third = past[gender][number][2];
        expect(conditional[gender][number], `${gender} ${number}`).toEqual(
          suffixes.map((suffix) => `${third}by${suffix}`)
        );
      }
    }
  });
});

describe('tense and aspect notes on the conjugation cheat sheet', () => {
  test('describe every tense the app drills once, under its app label', () => {
    expect(TENSE_INFO.map((info) => info.tense)).toEqual(ALL_TENSES.map((t) => TENSE_LABELS[t]));
  });

  test('give every tense at least one example with both Polish and English', () => {
    for (const info of TENSE_INFO) {
      expect(info.examples.length, info.tense).toBeGreaterThan(0);
      for (const { polish, english } of info.examples) {
        expect(polish.trim(), info.tense).not.toBe('');
        expect(english.trim(), info.tense).not.toBe('');
      }
    }
  });

  test('past and conditional examples use an ending of the gender they are marked with', () => {
    const verbOf = (polish: string) => polish.split(/[\s.!]/)[0].toLowerCase();
    const examples = (tense: string) => TENSE_INFO.find((info) => info.tense === tense)!.examples;
    const endingsFor = (table: typeof PERSON_ENDINGS.conditional, marker?: string) =>
      (['masculine', 'feminine'] as const)
        .filter((gender) => !marker || gender[0] === marker)
        .flatMap((gender) => [...table[gender].singular, ...table[gender].plural])
        .map(bare);
    for (const [tense, table] of [
      ['Past', PERSON_ENDINGS.past],
      ['Conditional', PERSON_ENDINGS.conditional],
    ] as const) {
      for (const { polish } of examples(tense)) {
        const marker = /\((m|f)\)/.exec(polish)?.[1];
        const verb = verbOf(polish);
        // Longest matching ending decides, so "-łem" is not read as "-ł" + "em".
        const longest = endingsFor(table)
          .filter((ending) => verb.endsWith(ending))
          .sort((a, b) => b.length - a.length)[0];
        expect(longest, polish).toBeDefined();
        expect(endingsFor(table, marker), polish).toContain(longest);
      }
    }
  });

  test('imperative examples build 1pl and 2pl by adding -my and -cie to the 2sg form', () => {
    const imperative = TENSE_INFO.find((info) => info.tense === 'Imperative')!.examples;
    const verbs = imperative.map(({ polish }) => polish.replace(/!$/, '').toLowerCase());
    const second = [...verbs].sort((a, b) => a.length - b.length)[0];
    expect([...verbs].sort()).toEqual([second, `${second}cie`, `${second}my`].sort());
    const letUs = imperative.find(({ polish }) => polish.toLowerCase().startsWith(`${second}my`));
    expect(letUs?.english).toMatch(/^Let's /);
  });

  test('describe both aspects once', () => {
    expect(ASPECT_INFO.map((info) => info.aspect)).toEqual(ALL_ASPECTS);
  });

  test('both aspects list the same aspect pairs, since the cheat sheet shows only the first', () => {
    const [first, ...rest] = ASPECT_INFO;
    for (const info of rest) expect(info.examples).toEqual(first.examples);
  });

  test('aspect pair examples agree with the aspects in the verb index', () => {
    const problems = ASPECT_INFO.flatMap(({ examples }) =>
      examples.flatMap(({ imperfective, perfective }) =>
        (
          [
            [imperfective, 'Imperfective'],
            [perfective, 'Perfective'],
          ] as const
        ).flatMap(([infinitive, aspect]) => {
          const indexed = verbIndex.find((verb) => verb.infinitive === infinitive);
          return indexed && indexed.aspect !== aspect ? [`${infinitive} is ${indexed.aspect}`] : [];
        })
      )
    );
    expect(problems).toEqual([]);
    // The check must reach real data: at least one example pair is in the index.
    const indexed = new Set(verbIndex.map((verb) => verb.infinitive));
    expect(
      ASPECT_INFO[0].examples.some(({ imperfective, perfective }) =>
        [imperfective, perfective].every((infinitive) => indexed.has(infinitive))
      )
    ).toBe(true);
  });
});
