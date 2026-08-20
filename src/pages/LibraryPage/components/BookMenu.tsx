import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Book } from '../../../types/reader';

interface BookMenuProps {
  anchorEl: HTMLElement | null;
  book: Book | null;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export function BookMenu({ anchorEl, book, onClose, onEdit, onDelete }: BookMenuProps) {
  return (
    <Menu anchorEl={anchorEl} open={!!anchorEl && !!book} onClose={onClose}>
      <MenuItem
        onClick={() => {
          if (book) onEdit(book);
        }}
      >
        <ListItemIcon>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Edit</ListItemText>
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (book) onDelete(book);
        }}
      >
        <ListItemIcon>
          <DeleteIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
      </MenuItem>
    </Menu>
  );
}
