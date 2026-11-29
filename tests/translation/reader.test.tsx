/**
 * Tap-to-translate in long text (the reader and audio transcripts): paragraphs are
 * rendered with TranslatableWords inside one TranslatableText, which keeps a local
 * cache of translations, the way TextViewer and TranscriptView wire them.
 */
import { useCallback, useState } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { TranslatableText } from '../../src/components/TranslatableText';
import { TranslatableWords } from '../../src/components/lazyText/TranslatableWords';
import { resetCallables } from './support/fakeFunctions';
import { fakeTranslateServer, type FakeTranslateServer } from './support/translateServer';
import { mouseDrag, renderInApp, settle, tap } from './support/app';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

const PARAGRAPHS = ['Kot pije mleko.', 'Pies śpi pod stołem.'];

let server: FakeTranslateServer;

beforeEach(() => {
  resetCallables();
  server = fakeTranslateServer({ kot: 'cat', pies: 'dog', 'mleko. Pies': 'milk. Dog' });
});

interface ReaderProps {
  paragraphs?: string[];
  getSentenceContext?: (selectedIndices: number[]) => string | undefined;
  onWordTap?: () => void;
  /** Sees every translation handed to the page's cache. */
  onCache?: (key: string, translation: string) => void;
}

function Reader({ paragraphs = PARAGRAPHS, getSentenceContext, onWordTap, onCache }: ReaderProps) {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const handleUpdateTranslation = useCallback(
    (key: string, translation: string) => {
      onCache?.(key, translation);
      setTranslations((prev) => ({ ...prev, [key]: translation }));
    },
    [onCache]
  );
  const offsets = paragraphs.map((_, i) =>
    paragraphs.slice(0, i).reduce((total, p) => total + p.split(/\s+/).length, 0)
  );

  return (
    <TranslatableText
      getSentenceContext={getSentenceContext}
      translations={translations}
      onUpdateTranslation={handleUpdateTranslation}
      onWordTap={onWordTap}
    >
      {paragraphs.map((paragraph, i) => (
        <p key={i}>
          <TranslatableWords text={paragraph} wordOffset={offsets[i]} />
        </p>
      ))}
    </TranslatableText>
  );
}

const word = (text: string) => screen.getByText(text, { selector: '[data-word-index]' });
const tooltip = () => screen.getByRole('tooltip');
const tooltips = () => screen.queryAllByRole('tooltip');

describe('reading long text', () => {
  test('each word keeps its paragraph spacing and is numbered across the whole text', () => {
    const { container } = renderInApp(<Reader />);

    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual(PARAGRAPHS);
    expect(word('Kot')).toHaveAttribute('data-word-index', '0');
    expect(word('mleko.')).toHaveAttribute('data-word-index', '2');
    expect(word('Pies')).toHaveAttribute('data-word-index', '3');
    expect(word('stołem.')).toHaveAttribute('data-word-index', '6');
  });

  test('tapping a word translates it with its paragraph as context', async () => {
    renderInApp(<Reader />);

    tap(word('Pies'));
    await settle();

    expect(tooltip()).toHaveTextContent('dog');
    expect(server.requests()).toEqual([
      { text: 'pies', targetLang: 'EN', context: 'Pies śpi pod stołem.' },
    ]);
  });

  test('hovering a word does not translate it', async () => {
    renderInApp(<Reader />);

    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(tooltips()).toHaveLength(0);
    expect(server.requests()).toEqual([]);
  });

  test('the page is told when a word translation opens, not when it closes', async () => {
    const onWordTap = vi.fn();
    renderInApp(<Reader onWordTap={onWordTap} />);

    tap(word('Kot'));
    await settle();
    expect(onWordTap).toHaveBeenCalledTimes(1);

    tap(word('Kot'));
    await settle();
    expect(onWordTap).toHaveBeenCalledTimes(1);
  });

  test('a phrase across two paragraphs is translated with the context the page gives for those words', async () => {
    const getSentenceContext = vi.fn((indices: number[]) =>
      indices.includes(3) ? PARAGRAPHS.join(' ') : PARAGRAPHS[0]
    );
    renderInApp(<Reader getSentenceContext={getSentenceContext} />);

    mouseDrag(word('mleko.'), word('Pies'));
    await settle();

    expect(getSentenceContext).toHaveBeenCalledWith([2, 3]);
    expect(server.requests()).toEqual([
      { text: 'mleko. Pies', targetLang: 'EN', context: PARAGRAPHS.join(' ') },
    ]);
    expect(tooltip()).toHaveTextContent('milk. Dog');
  });

  test('selecting a phrase again uses the translation already fetched', async () => {
    renderInApp(<Reader />);

    mouseDrag(word('mleko.'), word('Pies'));
    await settle();
    mouseDrag(word('Kot'), word('pije'));
    await settle();
    mouseDrag(word('mleko.'), word('Pies'));
    await settle();

    expect(tooltip()).toHaveTextContent('milk. Dog');
    expect(server.texts()).toEqual(['mleko. Pies', 'Kot pije']);
  });

  // Current design: only phrase translations are handed to the page's cache. Word
  // lookups are cached by the server on the sentence or declension card they came from
  // (cacheTranslationOnDoc in functions/src/callables/translate.ts), and on flashcards
  // onUpdateTranslation is the admin's correction hook, which writes to shared content.
  // The reader passes no sentence id, so here every word tap is a fresh lookup.
  test('word lookups are not handed to the page cache, so re-tapping a word looks it up again', async () => {
    const onCache = vi.fn();
    renderInApp(<Reader onCache={onCache} />);

    tap(word('Kot'));
    await settle();
    tap(word('Kot'));
    await settle();
    tap(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('cat');
    expect(server.texts()).toEqual(['kot', 'kot']);
    expect(onCache).not.toHaveBeenCalled();

    mouseDrag(word('mleko.'), word('Pies'));
    await settle();
    expect(onCache).toHaveBeenCalledWith('mleko pies', 'milk. Dog');
  });

  test('a word in a paragraph over 1000 characters can still be translated', async () => {
    const longParagraph = `Pies ${'Kot pije mleko. '.repeat(70)}`.trim();
    expect(longParagraph.length).toBeGreaterThan(1000);
    const { showSnackbar } = renderInApp(<Reader paragraphs={[longParagraph]} />);

    tap(word('Pies'));
    await settle();

    expect(server.texts()).toEqual(['pies']);
    expect(tooltip()).toHaveTextContent('dog');
    expect(showSnackbar).not.toHaveBeenCalled();
  });
});
