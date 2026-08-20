import { CardContent, CircularProgress, Typography } from '@mui/material';
import type { Book } from '../../../types/reader';
import { BookCard, BookCover } from './bookCardStyles';

interface ProcessingBookCardProps {
  book: Book;
}

export function ProcessingBookCard({ book }: ProcessingBookCardProps) {
  return (
    <BookCard>
      <BookCover>
        <CircularProgress size={32} sx={{ color: 'inherit' }} />
      </BookCover>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="body2" noWrap>
          Processing...
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {book.fileName}
        </Typography>
      </CardContent>
    </BookCard>
  );
}
