import { Box, CardActionArea, CardContent, LinearProgress, Typography } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { Book } from '../../../types/reader';
import { BOOK_COLORS } from '../../../types/reader';
import { BookCard, BookCover, MenuButton } from './bookCardStyles';

interface ReadyBookCardProps {
  book: Book;
  progressPercent: number;
  onOpen: () => void;
  onMenuClick: (anchorEl: HTMLElement) => void;
}

export function ReadyBookCard({ book, progressPercent, onOpen, onMenuClick }: ReadyBookCardProps) {
  return (
    <BookCard>
      <MenuButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onMenuClick(e.currentTarget);
        }}
      >
        <MoreVertIcon fontSize="small" />
      </MenuButton>
      <CardActionArea onClick={onOpen}>
        <BookCover
          $colorMain={book.color ? BOOK_COLORS[book.color].main : undefined}
          $colorLight={book.color ? BOOK_COLORS[book.color].light : undefined}
        >
          <MenuBookIcon sx={{ fontSize: 48 }} />
        </BookCover>
        <CardContent sx={{ py: 1.5 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {book.title}
          </Typography>
          {book.author && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {book.author}
            </Typography>
          )}
          {!book.author && book.fileType === 'text' && book.wordCount && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {book.wordCount.toLocaleString()} words
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{ flex: 1, height: 4, borderRadius: 2 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32 }}>
              {progressPercent}%
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </BookCard>
  );
}
