import { Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { EmptyContainer } from './styles';

interface CustomItemEmptyStateProps {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
}

export function CustomItemEmptyState({
  title,
  description,
  addLabel,
  onAdd,
}: CustomItemEmptyStateProps) {
  return (
    <EmptyContainer>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mb: 3, maxWidth: 320 }}>
        {description}
      </Typography>
      <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>
        {addLabel}
      </Button>
    </EmptyContainer>
  );
}
