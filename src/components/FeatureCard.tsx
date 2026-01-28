import type { ReactNode } from 'react';
import { Box, Typography, ButtonBase } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

type CardAlignment = 'left' | 'center';

interface FeatureCardProps {
  color: string;
  icon: ReactNode;
  title: string;
  description?: string;
  badge?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  align?: CardAlignment;
}

const CardBase = styled(ButtonBase)<{ $color: string; $align: CardAlignment }>(
  ({ theme, $color, $align }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: $align === 'center' ? 'center' : 'flex-start',
    padding: theme.spacing(3),
    borderRadius: 16,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    textAlign: $align,
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      background: $color,
    },
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: `0 12px 32px ${alpha($color, 0.2)}`,
      borderColor: alpha($color, 0.3),
    },
    '&:active': {
      transform: 'translateY(-2px)',
    },
  })
);

const IconWrapper = styled(Box)<{ $color: string }>(({ theme, $color }) => ({
  width: 56,
  height: 56,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha($color, 0.1),
  color: $color,
  marginBottom: theme.spacing(2),
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
  color: theme.palette.text.primary,
}));

const CardDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const BadgeWrapper = styled(Box)({
  position: 'absolute',
  top: 12,
  right: 12,
});

export function FeatureCard({
  color,
  icon,
  title,
  description,
  badge,
  children,
  onClick,
  align = 'left',
}: FeatureCardProps) {
  return (
    <CardBase $color={color} $align={align} onClick={onClick}>
      {badge && <BadgeWrapper>{badge}</BadgeWrapper>}
      <IconWrapper $color={color}>{icon}</IconWrapper>
      <CardTitle variant="h6">{title}</CardTitle>
      {description && <CardDescription variant="body2">{description}</CardDescription>}
      {children}
    </CardBase>
  );
}
