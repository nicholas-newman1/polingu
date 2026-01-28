import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { HeaderSection, TitleGroup, CountBadge, AddButton } from './styles';

interface CustomItemPageHeaderProps {
  title: string;
  subtitle: string;
  count: number;
  addLabel: string;
  onAdd: () => void;
}

export function CustomItemPageHeader({
  title,
  subtitle,
  count,
  addLabel,
  onAdd,
}: CustomItemPageHeaderProps) {
  return (
    <HeaderSection>
      <TitleGroup>
        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </TitleGroup>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CountBadge>{count}</CountBadge>
        <AddButton variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          {addLabel}
        </AddButton>
      </Box>
    </HeaderSection>
  );
}
