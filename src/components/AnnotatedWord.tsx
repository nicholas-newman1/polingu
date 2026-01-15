import { useState, useEffect, useRef } from 'react';
import { Box, Popper, Paper, Typography, styled } from '@mui/material';
import type { WordAnnotation } from '../types/sentences';

const WordSpan = styled('span')(({ theme }) => ({
  cursor: 'pointer',
  borderRadius: 2,
  padding: '0 2px',
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const TooltipPaper = styled(Paper)({
  position: 'relative',
  backgroundColor: '#1a1a1a',
  maxWidth: 280,
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #1a1a1a',
  },
});

const PopoverContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  color: '#fff',
}));

interface AnnotatedWordProps {
  annotation: WordAnnotation;
  displayWord?: string;
  mode?: 'pl-to-en' | 'en-to-pl';
}

export function AnnotatedWord({
  annotation,
  displayWord,
  mode = 'pl-to-en',
}: AnnotatedWordProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLSpanElement | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);
  const open = isHovering || isClicked;

  useEffect(() => {
    if (!isClicked) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popperRef.current &&
        !popperRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        setIsClicked(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isClicked, anchorEl]);

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    setAnchorEl(event.currentTarget);
    setIsClicked((prev) => !prev);
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLSpanElement>) => {
    setAnchorEl(event.currentTarget);
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const wordToDisplay = displayWord ?? annotation.word;

  return (
    <>
      <WordSpan
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {wordToDisplay}
      </WordSpan>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="top"
        modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      >
        <TooltipPaper ref={popperRef} elevation={8}>
          <PopoverContent>
            {mode === 'pl-to-en' ? (
              <>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  {annotation.english}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: '#a3a3a3', display: 'block' }}
                >
                  {annotation.lemma !== annotation.word.toLowerCase() && (
                    <span style={{ fontStyle: 'italic' }}>
                      {annotation.lemma}
                    </span>
                  )}
                  {annotation.lemma !== annotation.word.toLowerCase() &&
                    annotation.grammar &&
                    ' · '}
                  {annotation.grammar}
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  {annotation.word}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: '#a3a3a3', display: 'block' }}
                >
                  {annotation.lemma !== annotation.word.toLowerCase() && (
                    <span style={{ fontStyle: 'italic' }}>
                      {annotation.lemma}
                    </span>
                  )}
                  {annotation.lemma !== annotation.word.toLowerCase() &&
                    annotation.grammar &&
                    ' · '}
                  {annotation.grammar}
                </Typography>
              </>
            )}
            {annotation.notes && (
              <Typography
                variant="caption"
                sx={{ color: '#60a5fa', display: 'block', mt: 0.5 }}
              >
                {annotation.notes}
              </Typography>
            )}
          </PopoverContent>
        </TooltipPaper>
      </Popper>
    </>
  );
}
