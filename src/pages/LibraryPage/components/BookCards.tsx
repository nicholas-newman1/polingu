import { useNavigate } from 'react-router-dom';
import type { Book, ReadingProgress } from '../../../types/reader';
import { ProcessingBookCard } from './ProcessingBookCard';
import { ReadyBookCard } from './ReadyBookCard';

function getBookProgressPercent(book: Book, progress?: ReadingProgress): number {
  if (!progress) return 0;
  if (book.fileType === 'text') {
    return Math.round((progress.scrollPercent ?? 0) * 100);
  }
  if (book.pageCount) {
    return Math.round((progress.currentPage / book.pageCount) * 100);
  }
  return 0;
}

interface ProcessingBookCardsProps {
  books: Book[];
}

export function ProcessingBookCards({ books }: ProcessingBookCardsProps) {
  return books.map((book) => <ProcessingBookCard key={book.id} book={book} />);
}

interface ReadyBookCardsProps {
  books: Book[];
  progressMap: Record<string, ReadingProgress>;
  onMenuClick: (book: Book, anchorEl: HTMLElement) => void;
}

export function ReadyBookCards({ books, progressMap, onMenuClick }: ReadyBookCardsProps) {
  const navigate = useNavigate();

  return books.map((book) => (
    <ReadyBookCard
      key={book.id}
      book={book}
      progressPercent={getBookProgressPercent(book, progressMap[book.id])}
      onOpen={() => navigate(`/reader/${book.id}`)}
      onMenuClick={(anchorEl) => onMenuClick(book, anchorEl)}
    />
  ));
}
