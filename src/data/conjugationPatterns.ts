export interface ConjugationPattern {
  verbClass: string;
  infinitiveEnding: string;
  exampleVerb: string;
  exampleMeaning: string;
  presentEndings: {
    singular: [string, string, string];
    plural: [string, string, string];
  };
  pastStem: string;
  notes?: string;
}

export const CONJUGATION_PATTERNS: ConjugationPattern[] = [
  {
    verbClass: '-ać',
    infinitiveEnding: '-ać',
    exampleVerb: 'czytać',
    exampleMeaning: 'to read',
    presentEndings: {
      singular: ['-am', '-asz', '-a'],
      plural: ['-amy', '-acie', '-ają'],
    },
    pastStem: '-ał/-ała/-ało',
    notes: 'Most common verb class. Remove -ać and add endings.',
  },
  {
    verbClass: '-ić/-yć',
    infinitiveEnding: '-ić/-yć',
    exampleVerb: 'robić',
    exampleMeaning: 'to do/make',
    presentEndings: {
      singular: ['-ię/-ę', '-isz/-ysz', '-i/-y'],
      plural: ['-imy/-ymy', '-icie/-ycie', '-ią/-ą'],
    },
    pastStem: '-ił/-iła/-iło',
    notes: 'Soft consonant stems. 1sg often has consonant change.',
  },
  {
    verbClass: '-eć',
    infinitiveEnding: '-eć',
    exampleVerb: 'umieć',
    exampleMeaning: 'to know how',
    presentEndings: {
      singular: ['-em', '-esz', '-e'],
      plural: ['-emy', '-ecie', '-eją'],
    },
    pastStem: '-ał/-ała/-ało',
    notes: 'Uses -em/-esz pattern. Some have -ę/-isz instead.',
  },
  {
    verbClass: '-ować',
    infinitiveEnding: '-ować',
    exampleVerb: 'pracować',
    exampleMeaning: 'to work',
    presentEndings: {
      singular: ['-uję', '-ujesz', '-uje'],
      plural: ['-ujemy', '-ujecie', '-ują'],
    },
    pastStem: '-ował/-owała/-owało',
    notes: 'Drop -ować, add -uj- + endings. Very regular pattern.',
  },
];

export interface TenseInfo {
  tense: string;
  polishName: string;
  formation: string;
  usage: string;
  examples: { polish: string; english: string }[];
}

export const TENSE_INFO: TenseInfo[] = [
  {
    tense: 'Present',
    polishName: 'Czas teraźniejszy',
    formation: 'Stem + present endings',
    usage: 'Current actions, habits, general truths. Only for imperfective verbs.',
    examples: [
      { polish: 'Czytam książkę.', english: 'I read / am reading a book.' },
      { polish: 'Ona pracuje w biurze.', english: 'She works in an office.' },
    ],
  },
  {
    tense: 'Past',
    polishName: 'Czas przeszły',
    formation: 'Stem + -ł/-ła/-ło/-li/-ły + personal endings',
    usage: 'Completed or ongoing past actions. Gender must match subject.',
    examples: [
      { polish: 'Pisałem list. (m)', english: 'I wrote / was writing a letter.' },
      { polish: 'Napisała list. (f)', english: 'She wrote / has written a letter.' },
    ],
  },
  {
    tense: 'Future',
    polishName: 'Czas przyszły',
    formation: 'Perfective: present forms. Imperfective: będę + infinitive/participle',
    usage: 'Future actions. Perfective = completed, Imperfective = ongoing.',
    examples: [
      { polish: 'Napiszę list.', english: 'I will write a letter. (perf)' },
      { polish: 'Będę pisać.', english: 'I will be writing. (imperf)' },
    ],
  },
  {
    tense: 'Imperative',
    polishName: 'Tryb rozkazujący',
    formation: 'Present stem + imperative endings',
    usage: 'Commands, requests, suggestions.',
    examples: [
      { polish: 'Pisz!', english: 'Write! (singular)' },
      { polish: 'Piszmy!', english: "Let's write!" },
      { polish: 'Piszcie!', english: 'Write! (plural)' },
    ],
  },
  {
    tense: 'Conditional',
    polishName: 'Tryb warunkowy',
    formation: 'Past form + -by- + personal endings',
    usage: 'Hypothetical situations, polite requests, wishes.',
    examples: [
      { polish: 'Pisałbym list.', english: 'I would write a letter.' },
      { polish: 'Chciałabym herbatę.', english: 'I would like tea.' },
    ],
  },
];

export interface AspectInfo {
  aspect: string;
  description: string;
  characteristics: string[];
  examples: { imperfective: string; perfective: string; meaning: string }[];
}

export const ASPECT_INFO: AspectInfo[] = [
  {
    aspect: 'Imperfective',
    description: 'Actions viewed as ongoing, habitual, or without focus on completion',
    characteristics: [
      'Has present tense forms',
      'Focus on the process, not the result',
      'Used for repeated/habitual actions',
      'Compound future (będę + inf/part)',
    ],
    examples: [
      { imperfective: 'pisać', perfective: 'napisać', meaning: 'to write' },
      { imperfective: 'czytać', perfective: 'przeczytać', meaning: 'to read' },
      { imperfective: 'jeść', perfective: 'zjeść', meaning: 'to eat' },
    ],
  },
  {
    aspect: 'Perfective',
    description: 'Actions viewed as completed, single events with clear results',
    characteristics: [
      'No present tense (present forms = future meaning)',
      'Focus on completion and result',
      'Used for single, completed actions',
      'Simple future (same as present forms)',
    ],
    examples: [
      { imperfective: 'pisać', perfective: 'napisać', meaning: 'to write' },
      { imperfective: 'czytać', perfective: 'przeczytać', meaning: 'to read' },
      { imperfective: 'jeść', perfective: 'zjeść', meaning: 'to eat' },
    ],
  },
];

export const PERSON_ENDINGS = {
  present: {
    labels: ['1st sing.', '2nd sing.', '3rd sing.', '1st plur.', '2nd plur.', '3rd plur.'],
    pronouns: ['ja', 'ty', 'on/ona/ono', 'my', 'wy', 'oni/one'],
  },
  past: {
    masculine: {
      singular: ['-łem', '-łeś', '-ł'],
      plural: ['-liśmy', '-liście', '-li'],
    },
    feminine: {
      singular: ['-łam', '-łaś', '-ła'],
      plural: ['-łyśmy', '-łyście', '-ły'],
    },
    neuter: {
      singular: ['—', '—', '-ło'],
      plural: ['—', '—', '-ły'],
    },
  },
  conditional: {
    masculine: {
      singular: ['-łbym', '-łbyś', '-łby'],
      plural: ['-libyśmy', '-libyście', '-liby'],
    },
    feminine: {
      singular: ['-łabym', '-łabyś', '-łaby'],
      plural: ['-łybyśmy', '-łybyście', '-łyby'],
    },
  },
};
