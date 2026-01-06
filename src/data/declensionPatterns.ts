export interface DeclensionEnding {
  text: string;
  footnotes?: number[];
}

export interface DeclensionRow {
  case: string;
  endings: DeclensionEnding[];
}

export interface DeclensionTable {
  title: string;
  gender: 'masculine' | 'feminine' | 'neuter';
  number: 'singular' | 'plural';
  rows: DeclensionRow[];
  footnotes: Record<number, string>;
}

export const masculineSingular: DeclensionTable = {
  title: 'Masculine',
  gender: 'masculine',
  number: 'singular',
  footnotes: {
    1: 'Use this ending for inanimate objects, although there are many exceptions which use the -a ending',
    2: 'Use this ending for animate objects',
    3: 'Inanimate objects have the same Accusative and Nominative form',
    4: 'Animate objects have the same Accusative and Genitive form',
    5: 'Use this ending for nouns whose stems end with a hard consonant, except k, g and ch/h',
    6: 'Use this ending for nouns whose stems end with a soft consonant or k, g, ch/h',
    7: 'The Locative and Vocative forms are the same',
    8: 'If the stem ends with k or g, then add additional -i- between the stem and the ending',
    9: 'Some nouns take the -u ending, but the vast majority take the -owi ending',
  },
  rows: [
    { case: 'Nominative', endings: [{ text: '-' }] },
    {
      case: 'Genitive',
      endings: [
        { text: '-u', footnotes: [1] },
        { text: '-a', footnotes: [2] },
      ],
    },
    {
      case: 'Dative',
      endings: [{ text: '-owi' }, { text: '-u', footnotes: [9] }],
    },
    {
      case: 'Accusative',
      endings: [
        { text: '=N', footnotes: [3] },
        { text: '=G', footnotes: [4] },
      ],
    },
    { case: 'Instrumental', endings: [{ text: '-(i)em', footnotes: [8] }] },
    {
      case: 'Locative',
      endings: [
        { text: "-'e", footnotes: [5] },
        { text: '-u', footnotes: [6] },
      ],
    },
    { case: 'Vocative', endings: [{ text: '=L', footnotes: [7] }] },
  ],
};

export const masculinePlural: DeclensionTable = {
  title: 'Masculine',
  gender: 'masculine',
  number: 'plural',
  footnotes: {
    1: 'Use this ending for nouns ending with a hard consonant',
    2: "If the noun is a personal noun soften the hard consonant (-'y / 'i)",
    3: 'Some nouns describing titles or relations take -owie ending',
    4: 'Nouns ending with -anin take -anie ending',
    5: 'Use this ending for nouns ending with a soft consonant',
    6: 'Use this ending for nouns ending with a hard consonant or c, dz, j',
    7: 'Use this ending for nouns ending with a soft consonant, except c, dz and j',
    8: 'If the noun is not personal, use the Nominative Case form',
    9: 'If the noun is personal, use the Genitive Case form',
    10: 'The Vocative and Nominative forms are the same',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-y/i', footnotes: [1, 2] },
        { text: '-owie', footnotes: [3] },
        { text: '-anie', footnotes: [4] },
        { text: '-e', footnotes: [5] },
      ],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-ów', footnotes: [6] },
        { text: '-y/i', footnotes: [7] },
      ],
    },
    { case: 'Dative', endings: [{ text: '-om' }] },
    {
      case: 'Accusative',
      endings: [
        { text: '=N', footnotes: [8] },
        { text: '=G', footnotes: [9] },
      ],
    },
    { case: 'Instrumental', endings: [{ text: '-ami' }] },
    { case: 'Locative', endings: [{ text: '-ach' }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [10] }] },
  ],
};

export const feminineSingular: DeclensionTable = {
  title: 'Feminine',
  gender: 'feminine',
  number: 'singular',
  footnotes: {
    1: 'It is the basic dictionary form of the noun, so no need to choose an ending',
    2: 'Use for nouns ending with a hard consonant + -a in Nominative',
    3: 'Use for nouns ending with a soft consonant + -a or a consonant in Nominative',
    4: 'Use for nouns ending with -a in Nominative',
    5: 'Use for nouns ending with a consonant in Nominative',
    6: 'Both the Dative and Locative case have the same forms and rules of applying endings',
    7: 'There are some feminine nouns that end with -i, i.e. gospodyni, pani',
    8: 'Some masculine nouns take the -a ending. To decline them use feminine endings in singular number, and masculine endings in plural number.',
    9: 'Use for nouns ending with a consonant followed by -a excluding personal affectionate names with a soft consonant.',
    10: 'Use for personal affectionate names that end with a soft consonant followed by -a',
    11: 'Use for nouns ending with -i',
    12: 'Use for nouns ending with a consonant',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-a', footnotes: [1, 7, 8] },
        { text: '-', footnotes: [1] },
      ],
    },
    { case: 'Genitive', endings: [{ text: '-y/i' }] },
    {
      case: 'Dative',
      endings: [
        { text: "-'e", footnotes: [2] },
        { text: '-y/i', footnotes: [3] },
      ],
    },
    {
      case: 'Accusative',
      endings: [
        { text: '-ę', footnotes: [4] },
        { text: '-', footnotes: [5] },
      ],
    },
    { case: 'Instrumental', endings: [{ text: '-ą' }] },
    { case: 'Locative', endings: [{ text: '=D', footnotes: [6] }] },
    {
      case: 'Vocative',
      endings: [
        { text: '-o', footnotes: [9] },
        { text: '-u', footnotes: [10] },
        { text: '-i', footnotes: [11] },
        { text: '-y/i', footnotes: [12] },
      ],
    },
  ],
};

export const femininePlural: DeclensionTable = {
  title: 'Feminine',
  gender: 'feminine',
  number: 'plural',
  footnotes: {
    1: 'Use this ending for nouns whose stem ends with a hard consonant or -ść',
    2: 'Use this ending for nouns whose stem ends with a soft consonant except -ść',
    3: 'Use this ending for nouns ending in a vowel',
    4: 'Use this ending for nouns ending in a consonant',
    5: 'The Nominative, Accusative and Vocative case all have the same forms',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-y/i', footnotes: [1] },
        { text: '-e', footnotes: [2] },
      ],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-', footnotes: [3] },
        { text: '-y/i', footnotes: [4] },
      ],
    },
    { case: 'Dative', endings: [{ text: '-om' }] },
    { case: 'Accusative', endings: [{ text: '=N', footnotes: [5] }] },
    { case: 'Instrumental', endings: [{ text: '-ami' }] },
    { case: 'Locative', endings: [{ text: '-ach' }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [5] }] },
  ],
};

export const neuterSingular: DeclensionTable = {
  title: 'Neuter',
  gender: 'neuter',
  number: 'singular',
  footnotes: {
    1: 'Use this ending if the stem ends with a hard consonant, except k, g and ch/h',
    2: 'Use this ending if the stem ends with a soft consonant or k, g, ch/h',
    3: 'The Nominative, Accusative and Vocative case all have the same forms',
    4: 'If the stem ends with k or g, then add additional -i- between the stem and the ending',
    5: 'There are some neuter nouns ending in -ę or -um. They have irregular declension',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [{ text: '-o', footnotes: [5] }, { text: '-e' }],
    },
    { case: 'Genitive', endings: [{ text: '-a' }] },
    { case: 'Dative', endings: [{ text: '-u' }] },
    { case: 'Accusative', endings: [{ text: '=N', footnotes: [3] }] },
    { case: 'Instrumental', endings: [{ text: '-(i)em', footnotes: [4] }] },
    {
      case: 'Locative',
      endings: [
        { text: "-'e", footnotes: [1] },
        { text: '-u', footnotes: [2] },
      ],
    },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [3] }] },
  ],
};

export const neuterPlural: DeclensionTable = {
  title: 'Neuter',
  gender: 'neuter',
  number: 'plural',
  footnotes: {
    1: 'Some soft stem nouns (with a collective or naming areas meaning) take the -y/i ending here',
    2: 'A few nouns (mostly those ending with -um in Nominative singular) take the -ów ending here',
  },
  rows: [
    { case: 'Nominative', endings: [{ text: '-a' }] },
    { case: 'Genitive', endings: [{ text: '-', footnotes: [1, 2] }] },
    { case: 'Dative', endings: [{ text: '-om' }] },
    { case: 'Accusative', endings: [{ text: '=N' }] },
    { case: 'Instrumental', endings: [{ text: '-ami' }] },
    { case: 'Locative', endings: [{ text: '-ach' }] },
    { case: 'Vocative', endings: [{ text: '=N' }] },
  ],
};

export const allTables: DeclensionTable[] = [
  masculineSingular,
  masculinePlural,
  feminineSingular,
  femininePlural,
  neuterSingular,
  neuterPlural,
];
