import { Box } from '@mui/material';
import { styled } from '../lib/styled';

interface SiteLogoProps {
  size?: number | string;
}

const LogoContainer = styled(Box)({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export function SiteLogo({ size = 24 }: SiteLogoProps) {
  return (
    <LogoContainer sx={{ width: size, height: size }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
      >
        <defs>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#DC143C" />
            <stop offset="100%" stopColor="#B91C3C" />
          </linearGradient>
          <clipPath id="flagClip">
            <rect x="2" y="2" width="28" height="28" rx="6" />
          </clipPath>
        </defs>
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="6"
          fill="#FFFFFF"
        />
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="6"
          fill="none"
          stroke="#E5E5E5"
          strokeWidth="1"
        />
        <g clipPath="url(#flagClip)">
          <rect x="2" y="2" width="28" height="14" fill="#FFFFFF" />
          <rect x="2" y="16" width="28" height="14" fill="url(#redGrad)" />
        </g>
        <text
          x="16"
          y="23"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="18"
          fontWeight="700"
          fill="#1a1a1a"
          textAnchor="middle"
        >
          P
        </text>
      </svg>
    </LogoContainer>
  );
}

