import { ThemeProvider } from '@mui/material/styles';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ConsonantsCheatSheet } from '../../src/components/BottomMenu/ConsonantsCheatSheet';
import { CONSONANT_PAIRS } from '../../src/data/consonants';
import { createAppTheme } from '../../src/lib/theme';

/**
 * The consonants cheat sheet keeps its own copy of the hard/soft table. It must not contradict
 * the driller's data (src/data/consonants.ts), which decides what counts as a right answer.
 */
function cheatSheetRows() {
  const { container } = render(
    <ThemeProvider theme={createAppTheme('light')}>
      <ConsonantsCheatSheet />
    </ThemeProvider>
  );
  const texts = [...container.querySelectorAll('p')].map((p) => p.textContent ?? '');
  const cells = texts.slice(texts.indexOf('Soft') + 1);
  const rows: { hard: string[]; soft: string[] }[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const spellings = (cell: string) => (cell === '—' ? [] : cell.split('/'));
    rows.push({ hard: spellings(cells[i]), soft: spellings(cells[i + 1]) });
  }
  return rows;
}

test('the cheat sheet lists every consonant the driller calls hard or soft, in that column', () => {
  const rows = cheatSheetRows();
  expect(rows.length).toBeGreaterThan(10);
  const hard = new Set(rows.flatMap((row) => row.hard));
  const soft = new Set(rows.flatMap((row) => row.soft));
  for (const pair of CONSONANT_PAIRS) {
    expect(soft, `soft ${pair.soft}`).toContain(pair.soft);
    expect(hard, `soft ${pair.soft}`).not.toContain(pair.soft);
    if (pair.hasHard) {
      expect(hard, `hard ${pair.hard}`).toContain(pair.hard);
      expect(soft, `hard ${pair.hard}`).not.toContain(pair.hard);
    }
  }
});

test('the cheat sheet pairs each hard consonant with the soft partner the driller uses', () => {
  const rows = cheatSheetRows();
  for (const pair of CONSONANT_PAIRS.filter((p) => p.hasHard)) {
    const row = rows.find((r) => r.hard.includes(pair.hard));
    expect(row, pair.hard).toBeDefined();
    expect(row!.soft, pair.hard).toContain(pair.soft);
  }
});
