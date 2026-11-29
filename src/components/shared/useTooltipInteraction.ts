import { useState, useEffect, useCallback, useRef } from 'react';

export function useTooltipInteraction() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
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

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setIsClicked((prev) => !prev);
  }, []);

  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  const close = useCallback(() => {
    setIsClicked(false);
    setIsHovering(false);
  }, []);

  return {
    anchorEl,
    popperRef,
    open,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    close,
  };
}
