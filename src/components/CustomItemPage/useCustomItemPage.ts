import { useState, type Dispatch, type SetStateAction } from 'react';
import type { CollectionStorage } from '../../lib/storage/createCustomCollectionStorage';
import type { CustomItemBase } from '../../types/customItems';
import capitalize from '../../lib/utils/capitalize';
import { useCustomItemWrites } from '../../hooks/useCustomItemWrites';
import { useConfirm } from '../../hooks/useConfirm';
import { useSaveError } from '../../hooks/useSaveError';

interface CustomItemPageOptions<T extends CustomItemBase> {
  /** The learner's items, from the review context. */
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  loading: boolean;
  storage: CollectionStorage<T>;
  /** What one item is called, e.g. "word". */
  noun: string;
}

export type CustomItemPageController<T extends CustomItemBase> = ReturnType<
  typeof useCustomItemPage<T>
>;

/** The add/edit dialog and the saving behind a "My …" page. */
export function useCustomItemPage<T extends CustomItemBase>({
  items,
  setItems,
  loading,
  storage,
  noun,
}: CustomItemPageOptions<T>) {
  const showSaveError = useSaveError();
  const { confirm, confirmDialog } = useConfirm();
  const { add, update, remove } = useCustomItemWrites(storage, setItems);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  /** Deletes without asking first, for a dialog that has already asked. */
  const deleteItem = (id: string) => void remove(id).catch(showSaveError);

  return {
    items,
    loading,
    noun,
    /** The item being edited, or null while adding one. */
    editing,
    modalOpen,
    confirmDialog,
    openAdd: () => setModalOpen(true),
    openEdit: (item: T) => {
      setEditing(item);
      setModalOpen(true);
    },
    closeModal: () => {
      setModalOpen(false);
      setEditing(null);
    },
    /** The dialog reports a failed save, so these return the write. */
    add,
    update,
    deleteItem,
    confirmDelete: async (id: string) => {
      const confirmed = await confirm({
        title: `Delete ${capitalize(noun)}`,
        message: `Are you sure you want to delete this ${noun}?`,
        confirmLabel: 'Delete',
      });
      if (confirmed) deleteItem(id);
    },
    setAudioUrl: (id: string, audioUrl: string) =>
      setItems((current) => current.map((item) => (item.id === id ? { ...item, audioUrl } : item))),
  };
}
