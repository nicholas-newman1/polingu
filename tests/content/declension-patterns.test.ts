import { describe, expect, test } from 'vitest';
import { CASES } from '../../src/constants';
import { adjectiveDeclensionTables } from '../../src/data/adjectiveDeclensionPatterns';
import { allTables, type DeclensionTable } from '../../src/data/declensionPatterns';

/**
 * The noun and adjective declension cheat sheets. An ending is "-x" (a suffix), "-" (no
 * ending) or "=X", meaning "same form as case X", where X is the case's initial.
 */
const CASE_BY_INITIAL = new Map(CASES.map((name) => [name[0], name]));
const REFERENCE = /^=([A-Z])$/;
const ENDING = /^(-|-[a-ząćęłńóśźż'()/]+|=[A-Z])$/;

const sheets = [
  ['noun', allTables],
  ['adjective', adjectiveDeclensionTables],
] as const;

const referenceTarget = (text: string) => CASE_BY_INITIAL.get(REFERENCE.exec(text)?.[1] ?? '');
const label = (table: DeclensionTable) => `${table.title} ${table.number}`;

test('case initials are unique, so a "=X" reference names exactly one case', () => {
  expect(CASE_BY_INITIAL.size).toBe(CASES.length);
});

describe.each(sheets)('%s declension tables', (_, tables) => {
  test('each table lists the seven cases once, in the standard order', () => {
    for (const table of tables)
      expect(
        table.rows.map((row) => row.case),
        label(table)
      ).toEqual(CASES);
  });

  test('no two tables share a title and number, so the cheat sheet renders each one', () => {
    const keys = tables.map((table) => `${table.title}-${table.number}`);
    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
  });

  test('every case has at least one ending, written as a suffix, "-" or a case reference', () => {
    for (const table of tables) {
      for (const row of table.rows) {
        expect(row.endings.length, `${label(table)} ${row.case}`).toBeGreaterThan(0);
        for (const { text } of row.endings)
          expect(text, `${label(table)} ${row.case}`).toMatch(ENDING);
      }
    }
  });

  test('a case reference points to another case whose endings are written out', () => {
    for (const table of tables) {
      for (const row of table.rows) {
        for (const { text } of row.endings.filter((ending) => REFERENCE.test(ending.text))) {
          const target = table.rows.find((other) => other.case === referenceTarget(text));
          const where = `${label(table)} ${row.case} ${text}`;
          expect(target, where).toBeDefined();
          expect(target!.case, where).not.toBe(row.case);
          expect(
            target!.endings.some((ending) => !REFERENCE.test(ending.text)),
            where
          ).toBe(true);
        }
      }
    }
  });

  test('footnotes are numbered from 1 without gaps', () => {
    for (const table of tables) {
      const numbers = Object.keys(table.footnotes).map(Number);
      expect(numbers, label(table)).toEqual(numbers.map((_, i) => i + 1));
    }
  });

  test('every footnote an ending cites exists, and every footnote is cited', () => {
    // The cheat sheet drops a cited footnote that does not exist, and never shows one that
    // no ending cites, so either mistake silently loses an explanation.
    for (const table of tables) {
      const cited = new Set(
        table.rows.flatMap((row) => row.endings.flatMap((e) => e.footnotes ?? []))
      );
      const defined = Object.keys(table.footnotes).map(Number);
      expect(
        [...cited].filter((n) => !table.footnotes[n]),
        label(table)
      ).toEqual([]);
      expect(
        defined.filter((n) => !cited.has(n)),
        label(table)
      ).toEqual([]);
      for (const n of defined) expect(table.footnotes[n].trim(), label(table)).not.toBe('');
    }
  });

  test('a case reference that cites footnotes cites one naming the referenced case', () => {
    for (const table of tables) {
      for (const row of table.rows) {
        for (const { text, footnotes = [] } of row.endings) {
          const target = referenceTarget(text);
          if (!target || footnotes.length === 0) continue;
          const notes = footnotes.map((n) => table.footnotes[n]);
          expect(
            notes.some((note) => note.includes(target)),
            `${label(table)} ${row.case} ${text}: ${notes}`
          ).toBe(true);
        }
      }
    }
  });

  test('a footnote saying cases share forms names exactly the cases its references link', () => {
    // E.g. "The Nominative, Accusative and Vocative forms are the same" must be cited by the
    // Accusative and Vocative "=N" references and name nothing else.
    for (const table of tables) {
      for (const [n, note] of Object.entries(table.footnotes)) {
        if (!/same/i.test(note)) continue;
        const named = CASES.filter((name) => note.includes(name));
        const linked = new Set<string>();
        for (const row of table.rows) {
          for (const { text, footnotes = [] } of row.endings) {
            const target = referenceTarget(text);
            if (target && footnotes.includes(Number(n))) linked.add(row.case).add(target);
          }
        }
        expect(named, `${label(table)} footnote ${n}: ${note}`).toEqual(
          CASES.filter((name) => linked.has(name))
        );
      }
    }
  });
});

describe('noun declension tables', () => {
  test('cover each gender in both numbers exactly once', () => {
    const combos = allTables.map((table) => `${table.gender} ${table.number}`).sort();
    expect(combos).toEqual(
      ['feminine', 'masculine', 'neuter'].flatMap((g) => [`${g} plural`, `${g} singular`]).sort()
    );
  });

  test('titles name the table gender', () => {
    for (const table of allTables) expect(table.title.toLowerCase()).toBe(table.gender);
  });
});

describe('adjective declension tables', () => {
  test('cover each gender in the singular, and the plural once per gender group', () => {
    const singular = adjectiveDeclensionTables.filter((table) => table.number === 'singular');
    const plural = adjectiveDeclensionTables.filter((table) => table.number === 'plural');
    expect(singular.map((table) => table.gender).sort()).toEqual([
      'feminine',
      'masculine',
      'neuter',
    ]);
    // Masculine personal, and everything else ("Feminine & Neuter").
    expect(plural.map((table) => table.title).sort()).toEqual(['Feminine & Neuter', 'Masculine']);
    for (const table of adjectiveDeclensionTables) {
      expect(table.title.toLowerCase(), label(table)).toContain(table.gender);
    }
  });

  test('soft-stem (-i) endings are the hard-stem (-y) endings with an i inserted', () => {
    // nowy → nowego, tani → taniego: the -i group adds i before the ending and drops a
    // leading y (-y → -i, -ym → -im). Footnotes tell the groups apart.
    const group = (table: DeclensionTable, footnotes: number[] = []) => {
      const notes = footnotes.map((n) => table.footnotes[n]);
      if (notes.some((note) => /ends in -i in masculine nominative/.test(note))) return 'i';
      if (notes.some((note) => /ends in -y\b/.test(note))) return 'y';
    };
    let pairs = 0;
    for (const table of adjectiveDeclensionTables) {
      for (const row of table.rows) {
        const hard = row.endings.filter((e) => group(table, e.footnotes) === 'y');
        const soft = row.endings.filter((e) => group(table, e.footnotes) === 'i');
        const where = `${label(table)} ${row.case}`;
        expect(hard.length, where).toBe(soft.length);
        if (hard.length === 0) continue;
        expect(hard, where).toHaveLength(1);
        expect(soft[0].text, where).toBe(`-i${hard[0].text.slice(1).replace(/^y/, '')}`);
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThan(10);
  });
});
