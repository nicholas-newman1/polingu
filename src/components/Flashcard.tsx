import { useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import type { Card } from '../types';

export interface RatingIntervals {
  [Rating.Again]: string;
  [Rating.Hard]: string;
  [Rating.Good]: string;
  [Rating.Easy]: string;
}

interface FlashcardProps {
  card: Card;
  practiceMode?: boolean;
  intervals?: RatingIntervals;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
}

function highlightWord(text: string, word: string) {
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index === -1) {
    return <>{text}</>;
  }
  const before = text.slice(0, index);
  const match = text.slice(index, index + word.length);
  const after = text.slice(index + word.length);
  return (
    <>
      {before}
      <span className="text-rose-400 font-bold">{match}</span>
      {after}
    </>
  );
}

export function Flashcard({
  card,
  practiceMode = false,
  intervals,
  onRate,
  onNext,
}: FlashcardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 via-white to-rose-500 rounded-3xl blur opacity-30" />
      <div className="relative bg-slate-800 border border-slate-700 rounded-3xl p-10 w-96 h-[28rem] flex flex-col">
        <p className="text-2xl text-white font-light flex-1">{card.front}</p>

        {revealed ? (
          <>
            <div className="border-t border-slate-700 my-6" />
            <p className="text-3xl text-white mb-3">
              {highlightWord(card.back, card.declined)}
            </p>
            <div className="flex gap-2 mb-3">
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                {card.case}
              </span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                {card.gender}
              </span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                {card.number}
              </span>
            </div>
            {card.hint && (
              <p className="text-sm text-slate-400 mb-4">{card.hint}</p>
            )}
            {practiceMode ? (
              <button
                onClick={onNext}
                className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl transition-colors mt-auto"
              >
                Next →
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2 mt-auto">
                <button
                  onClick={() => onRate?.(Rating.Again)}
                  className="flex flex-col items-center py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  <span className="text-sm font-semibold">Again</span>
                  <span className="text-xs opacity-80">
                    {intervals?.[Rating.Again]}
                  </span>
                </button>
                <button
                  onClick={() => onRate?.(Rating.Hard)}
                  className="flex flex-col items-center py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  <span className="text-sm font-semibold">Hard</span>
                  <span className="text-xs opacity-80">
                    {intervals?.[Rating.Hard]}
                  </span>
                </button>
                <button
                  onClick={() => onRate?.(Rating.Good)}
                  className="flex flex-col items-center py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                >
                  <span className="text-sm font-semibold">Good</span>
                  <span className="text-xs opacity-80">
                    {intervals?.[Rating.Good]}
                  </span>
                </button>
                <button
                  onClick={() => onRate?.(Rating.Easy)}
                  className="flex flex-col items-center py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                >
                  <span className="text-sm font-semibold">Easy</span>
                  <span className="text-xs opacity-80">
                    {intervals?.[Rating.Easy]}
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="mt-auto w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-colors"
          >
            Reveal Answer
          </button>
        )}
      </div>
    </div>
  );
}
