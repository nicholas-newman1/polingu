import { IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { styled } from '../lib/styled';

interface StyledButtonProps {
  $active: boolean;
}

const StyledIconButton = styled(IconButton)<StyledButtonProps>(
  ({ theme, $active }) => ({
    width: 40,
    height: 40,
    backgroundColor: $active
      ? theme.palette.text.primary
      : theme.palette.background.paper,
    color: $active
      ? theme.palette.background.paper
      : theme.palette.text.disabled,
    border: '1px solid',
    borderColor: $active ? theme.palette.text.primary : theme.palette.divider,
    '&:hover': {
      backgroundColor: $active
        ? theme.palette.text.secondary
        : theme.palette.background.default,
    },
  })
);

interface SettingsButtonProps {
  active: boolean;
  onClick: () => void;
}

export function SettingsButton({ active, onClick }: SettingsButtonProps) {
  return (
    <StyledIconButton onClick={onClick} size="small" $active={active}>
      <SettingsIcon fontSize="small" />
    </StyledIconButton>
  );
}

