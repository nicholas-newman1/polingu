import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DragIndicator from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { styled } from '../lib/styled';
import { getOrderedDashboardItems, type DashboardNavItem } from '../constants/navigation';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useOptimisticModalSave } from '../hooks/useOptimisticModalSave';
import { useSyncProps } from '../hooks/useSyncProps';

interface CustomizeDashboardDialogProps {
  open: boolean;
  onClose: () => void;
}

const SortableRow = styled(ListItem)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  paddingLeft: theme.spacing(1),
  touchAction: 'none',
}));

const DragHandle = styled(IconButton)({
  cursor: 'grab',
  '&:active': {
    cursor: 'grabbing',
  },
});

interface SortableItemProps {
  item: DashboardNavItem;
}

function SortableItem({ item }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.path,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
  } as const;

  const Icon = item.icon;

  return (
    <SortableRow
      ref={setNodeRef}
      style={style}
      data-qa={`customize-dashboard-item-${item.path}`}
      secondaryAction={
        <DragHandle
          aria-label={`Reorder ${item.label}`}
          edge="end"
          {...attributes}
          {...listeners}
          data-qa={`customize-dashboard-drag-handle-${item.path}`}
        >
          <DragIndicator />
        </DragHandle>
      }
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <Icon />
      </ListItemIcon>
      <ListItemText primary={item.label} secondary={item.description} />
    </SortableRow>
  );
}

export function CustomizeDashboardDialog({ open, onClose }: CustomizeDashboardDialogProps) {
  const { settings, updateSettings } = useAppSettings();
  const [items, setItems] = useState<DashboardNavItem[]>(() =>
    getOrderedDashboardItems(settings.dashboardOrder)
  );

  useSyncProps({ open, dashboardOrder: settings.dashboardOrder }, () => {
    if (open) {
      setItems(getOrderedDashboardItems(settings.dashboardOrder));
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.path === active.id);
      const newIndex = current.findIndex((item) => item.path === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const save = useOptimisticModalSave({ onSave: updateSettings, onClose });

  const handleSave = () => {
    save({ dashboardOrder: items.map((item) => item.path) });
  };

  const handleReset = () => {
    save({ dashboardOrder: undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Customize Dashboard</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag items to change their order on the dashboard and in the side menu.
        </Typography>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((item) => item.path)}
            strategy={verticalListSortingStrategy}
          >
            <Box component={List} sx={{ p: 0 }} data-qa="customize-dashboard-list">
              {items.map((item) => (
                <SortableItem key={item.path} item={item} />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color="inherit" data-qa="customize-dashboard-reset">
          Reset to default
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} data-qa="customize-dashboard-cancel">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" data-qa="customize-dashboard-save">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
