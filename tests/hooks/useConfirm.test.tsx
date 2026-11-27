import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useConfirm } from '../../src/hooks/useConfirm';
import type { ConfirmOptions } from '../../src/components/ConfirmDialog';

const DELETE_WORD: ConfirmOptions = {
  title: 'Delete Word',
  message: 'Are you sure you want to delete this word?',
  confirmLabel: 'Delete',
};

function Harness({
  options,
  onAnswer,
}: {
  options: ConfirmOptions;
  onAnswer: (confirmed: boolean) => void;
}) {
  const { confirm, confirmDialog } = useConfirm();
  return (
    <>
      <button onClick={() => void confirm(options).then(onAnswer)}>Ask</button>
      {confirmDialog}
    </>
  );
}

/** Renders a component using the hook; `ask` opens the dialog, `onAnswer` records answers. */
function renderConfirm(options: ConfirmOptions = DELETE_WORD) {
  const onAnswer = vi.fn<(confirmed: boolean) => void>();
  const view = render(<Harness options={options} onAnswer={onAnswer} />);
  const ask = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    return screen.getByRole('dialog', { name: options.title });
  };
  return { ...view, ask, onAnswer };
}

const dialogsClosed = () =>
  waitFor(() => expect(screen.queryAllByRole('dialog', { hidden: true })).toHaveLength(0));

describe('useConfirm', () => {
  test('shows nothing until asked', () => {
    renderConfirm();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('shows the title, message and a labelled confirm button, and resolves true on confirm', async () => {
    const { ask, onAnswer } = renderConfirm();
    const dialog = ask();
    expect(dialog).toHaveTextContent('Are you sure you want to delete this word?');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledExactlyOnceWith(true));
    await dialogsClosed();
  });

  test('resolves false on Cancel', async () => {
    const { ask, onAnswer } = renderConfirm({
      ...DELETE_WORD,
      title: 'Reset Progress',
      confirmLabel: 'Reset',
    });
    const dialog = ask();
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false));
    await dialogsClosed();
  });

  test('resolves false when dismissed with Escape', async () => {
    const { ask, onAnswer } = renderConfirm();
    fireEvent.keyDown(ask(), { key: 'Escape' });

    await waitFor(() => expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false));
    await dialogsClosed();
  });

  test('asking again answers the earlier question with false', async () => {
    const { ask, onAnswer } = renderConfirm();
    ask();
    // The open dialog hides the page's button from role queries.
    fireEvent.click(screen.getByRole('button', { name: 'Ask', hidden: true }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false));

    const dialog = screen.getByRole('dialog', { name: 'Delete Word' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(true));
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });

  test('an open question is answered false if the component unmounts', async () => {
    const { ask, onAnswer, unmount } = renderConfirm();
    ask();
    unmount();
    await waitFor(() => expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false));
  });
});
