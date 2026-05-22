import { IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { ActionCell } from './styles';

interface CustomItemActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  onReprioritize?: () => void;
  canReprioritize?: boolean;
  reprioritizeLabel?: string;
  reprioritizeTooltip?: string;
}

export function CustomItemActions({
  onEdit,
  onDelete,
  editLabel = 'edit',
  deleteLabel = 'delete',
  onReprioritize,
  canReprioritize = false,
  reprioritizeLabel = 'reprioritize',
  reprioritizeTooltip = 'Review again',
}: CustomItemActionsProps) {
  return (
    <ActionCell>
      <IconButton size="small" onClick={onEdit} aria-label={editLabel}>
        <EditIcon fontSize="small" />
      </IconButton>
      {onReprioritize && canReprioritize && (
        <Tooltip title={reprioritizeTooltip}>
          <IconButton
            size="small"
            onClick={onReprioritize}
            aria-label={reprioritizeLabel}
            sx={{ color: 'primary.main' }}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <IconButton
        size="small"
        onClick={onDelete}
        aria-label={deleteLabel}
        sx={{ color: 'error.main' }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </ActionCell>
  );
}
