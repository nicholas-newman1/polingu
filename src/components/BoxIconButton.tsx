import { forwardRef } from 'react';
import { IconButton, type IconButtonProps } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

export type BoxIconButtonVariant = 'subtle' | 'outlined';
export type BoxIconButtonTone = 'default' | 'danger';

interface StyledProps {
  $variant: BoxIconButtonVariant;
  $tone: BoxIconButtonTone;
  $active: boolean;
}

const StyledIconButton = styled(IconButton)<StyledProps>(({ theme, $variant, $tone, $active }) => {
  const base = {
    borderRadius: theme.spacing(1),
    padding: theme.spacing(0.75),
    color: theme.palette.text.secondary,
  };

  if ($variant === 'outlined') {
    if ($active) {
      return {
        ...base,
        backgroundColor: theme.palette.text.primary,
        color: theme.palette.background.paper,
        border: `1px solid ${theme.palette.text.primary}`,
        '&:hover': {
          backgroundColor: theme.palette.text.secondary,
          borderColor: theme.palette.text.secondary,
        },
      };
    }
    return {
      ...base,
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      color: theme.palette.text.disabled,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
        color: theme.palette.text.secondary,
      },
    };
  }

  if ($tone === 'danger') {
    return {
      ...base,
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.disabled,
      '&:hover': {
        color: theme.palette.error.main,
        backgroundColor: alpha(theme.palette.error.main, 0.1),
      },
    };
  }

  return {
    ...base,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
      color: theme.palette.text.primary,
    },
  };
});

export interface BoxIconButtonProps extends Omit<IconButtonProps, 'color'> {
  variant?: BoxIconButtonVariant;
  tone?: BoxIconButtonTone;
  active?: boolean;
}

export const BoxIconButton = forwardRef<HTMLButtonElement, BoxIconButtonProps>(
  ({ variant = 'subtle', tone = 'default', active = false, ...props }, ref) => {
    return (
      <StyledIconButton ref={ref} $variant={variant} $tone={tone} $active={active} {...props} />
    );
  }
);

BoxIconButton.displayName = 'BoxIconButton';
