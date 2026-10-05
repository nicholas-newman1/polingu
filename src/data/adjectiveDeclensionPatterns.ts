import type { DeclensionTable } from './declensionPatterns';

const Y_GROUP_FOOTNOTE =
  'Use this ending when the adjective ends in -y in masculine nominative';
const Y_KI_GI_GROUP_FOOTNOTE =
  'Use this ending when the adjective ends in -y, -ki, or -gi in masculine nominative';
const I_GROUP_FOOTNOTE =
  'Use this ending when the adjective ends in -i in masculine nominative';

const MASC_SG_FOOTNOTES = {
  1: Y_GROUP_FOOTNOTE,
  2: I_GROUP_FOOTNOTE,
  3: 'Inanimate objects have the same Accusative and Nominative form',
  4: 'Animate objects have the same Accusative and Genitive form',
  5: 'The Locative and Instrumental forms are the same',
  6: 'The Vocative and Nominative forms are the same',
};

export const adjectiveMasculineSingular: DeclensionTable = {
  title: 'Masculine',
  gender: 'masculine',
  number: 'singular',
  footnotes: MASC_SG_FOOTNOTES,
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-y', footnotes: [1] },
        { text: '-i', footnotes: [2] },
      ],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-ego', footnotes: [1] },
        { text: '-iego', footnotes: [2] },
      ],
    },
    {
      case: 'Dative',
      endings: [
        { text: '-emu', footnotes: [1] },
        { text: '-iemu', footnotes: [2] },
      ],
    },
    {
      case: 'Accusative',
      endings: [
        { text: '=N', footnotes: [3] },
        { text: '=G', footnotes: [4] },
      ],
    },
    {
      case: 'Instrumental',
      endings: [
        { text: '-ym', footnotes: [1] },
        { text: '-im', footnotes: [2] },
      ],
    },
    { case: 'Locative', endings: [{ text: '=I', footnotes: [5] }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [6] }] },
  ],
};

export const adjectiveFeminineSingular: DeclensionTable = {
  title: 'Feminine',
  gender: 'feminine',
  number: 'singular',
  footnotes: {
    1: Y_KI_GI_GROUP_FOOTNOTE,
    2: I_GROUP_FOOTNOTE,
    3: 'Use -ej for adjectives ending in -y, -ki, or -gi in masculine nominative. Use -iej for adjectives ending in -i in masculine nominative, and for group I adjectives that take -iej instead of -ej',
    4: 'The Dative and Genitive forms are the same',
    5: 'The Instrumental and Accusative forms are the same',
    6: 'The Locative and Genitive forms are the same',
    7: 'The Vocative and Nominative forms are the same',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-a', footnotes: [1] },
        { text: '-ia', footnotes: [2] },
      ],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-ej', footnotes: [3] },
        { text: '-iej', footnotes: [3] },
      ],
    },
    { case: 'Dative', endings: [{ text: '=G', footnotes: [4] }] },
    {
      case: 'Accusative',
      endings: [
        { text: '-ą', footnotes: [1] },
        { text: '-ią', footnotes: [2] },
      ],
    },
    { case: 'Instrumental', endings: [{ text: '=A', footnotes: [5] }] },
    { case: 'Locative', endings: [{ text: '=G', footnotes: [6] }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [7] }] },
  ],
};

export const adjectiveNeuterSingular: DeclensionTable = {
  title: 'Neuter',
  gender: 'neuter',
  number: 'singular',
  footnotes: {
    1: Y_GROUP_FOOTNOTE,
    2: I_GROUP_FOOTNOTE,
    3: 'The Nominative, Accusative and Vocative forms are the same',
    4: 'The Locative and Instrumental forms are the same',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-e', footnotes: [1] },
        { text: '-ie', footnotes: [2] },
      ],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-ego', footnotes: [1] },
        { text: '-iego', footnotes: [2] },
      ],
    },
    {
      case: 'Dative',
      endings: [
        { text: '-emu', footnotes: [1] },
        { text: '-iemu', footnotes: [2] },
      ],
    },
    { case: 'Accusative', endings: [{ text: '=N', footnotes: [3] }] },
    {
      case: 'Instrumental',
      endings: [
        { text: '-ym', footnotes: [1] },
        { text: '-im', footnotes: [2] },
      ],
    },
    { case: 'Locative', endings: [{ text: '=I', footnotes: [4] }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [3] }] },
  ],
};

export const adjectiveMasculinePersonalPlural: DeclensionTable = {
  title: 'Masculine',
  gender: 'masculine',
  number: 'plural',
  footnotes: {
    1: 'Use this ending for adjectives ending with a hard consonant',
    2: "Soften the hard consonant (-'y / 'i)",
    3: Y_GROUP_FOOTNOTE,
    4: I_GROUP_FOOTNOTE,
    5: 'The Accusative and Genitive forms are the same',
    6: 'The Locative and Genitive forms are the same',
    7: 'The Vocative and Nominative forms are the same',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [{ text: '-y/i', footnotes: [1, 2] }],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-ych', footnotes: [3] },
        { text: '-ich', footnotes: [4] },
      ],
    },
    {
      case: 'Dative',
      endings: [
        { text: '-ym', footnotes: [3] },
        { text: '-im', footnotes: [4] },
      ],
    },
    { case: 'Accusative', endings: [{ text: '=G', footnotes: [5] }] },
    {
      case: 'Instrumental',
      endings: [
        { text: '-ymi', footnotes: [3] },
        { text: '-imi', footnotes: [4] },
      ],
    },
    { case: 'Locative', endings: [{ text: '=G', footnotes: [6] }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [7] }] },
  ],
};

export const adjectiveFeminineNeuterPlural: DeclensionTable = {
  title: 'Feminine & Neuter',
  gender: 'feminine',
  number: 'plural',
  footnotes: {
    1: Y_GROUP_FOOTNOTE,
    2: I_GROUP_FOOTNOTE,
    3: 'The Nominative, Accusative and Vocative forms are the same',
    4: 'The Locative and Genitive forms are the same',
  },
  rows: [
    {
      case: 'Nominative',
      endings: [
        { text: '-e', footnotes: [1] },
        { text: '-ie', footnotes: [2] },
      ],
    },
    {
      case: 'Genitive',
      endings: [
        { text: '-ych', footnotes: [1] },
        { text: '-ich', footnotes: [2] },
      ],
    },
    {
      case: 'Dative',
      endings: [
        { text: '-ym', footnotes: [1] },
        { text: '-im', footnotes: [2] },
      ],
    },
    { case: 'Accusative', endings: [{ text: '=N', footnotes: [3] }] },
    {
      case: 'Instrumental',
      endings: [
        { text: '-ymi', footnotes: [1] },
        { text: '-imi', footnotes: [2] },
      ],
    },
    { case: 'Locative', endings: [{ text: '=G', footnotes: [4] }] },
    { case: 'Vocative', endings: [{ text: '=N', footnotes: [3] }] },
  ],
};

export const adjectiveDeclensionTables: DeclensionTable[] = [
  adjectiveMasculineSingular,
  adjectiveFeminineSingular,
  adjectiveNeuterSingular,
  adjectiveMasculinePersonalPlural,
  adjectiveFeminineNeuterPlural,
];
