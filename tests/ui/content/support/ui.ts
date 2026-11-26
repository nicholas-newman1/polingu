/**
 * Small interaction helpers in the user's terms: type into a field, pick from a
 * dropdown, press a button once it is enabled, read a table column.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';

export function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

/** Clicks `button` as soon as it is enabled (form validation settles asynchronously). */
export async function press(button: HTMLElement) {
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

/** Lets pending promises and IndexedDB work finish. */
export async function settle(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** The open dialog with this title. */
export async function findDialog(title: string | RegExp) {
  return screen.findByRole('dialog', { name: title });
}

/**
 * The dialog titled `title`, checked once a dialog that had started closing would have left
 * the page. A closing dialog stays in the page, still matched by its title, for the length
 * of its exit transition, so checking straight away would pass even if it had closed.
 */
export async function expectDialogToStayOpen(title: string | RegExp) {
  await settle(400);
  return screen.getByRole('dialog', { name: title });
}

/**
 * Waits until every dialog has finished closing and left the page (a closing
 * dialog can change its title as its form resets, so it is not matched by name).
 */
export async function waitForDialogsToClose() {
  await waitFor(() => expect(screen.queryAllByRole('dialog', { hidden: true })).toHaveLength(0));
}

/**
 * The dropdown whose floating label reads `label`. MUI selects are not linked to
 * their label for screen readers here, so they are found through the label text.
 */
export function selectFor(label: string, container: HTMLElement = document.body) {
  const labelEl = within(container).getByText(label, { selector: 'label' });
  const control = labelEl.closest('.MuiFormControl-root') as HTMLElement | null;
  if (!control) throw new Error(`No form control around label ${label}`);
  return within(control).getByRole('combobox');
}

/** Opens the `label` dropdown, picks `option`, and waits for the menu to close. */
export async function choose(label: string, option: string | RegExp, container?: HTMLElement) {
  fireEvent.mouseDown(selectFor(label, container));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getByRole('option', { name: option }));
  await waitForMenuToClose();
}

/**
 * Waits until an open dropdown or menu has finished closing. While one is open (or
 * still fading out) it hides the rest of the page, dialogs included, from queries.
 */
export async function waitForMenuToClose() {
  await waitFor(() => expect(document.querySelector('.MuiPopover-root')).toBeNull());
}

/** The text of each body row's cell under the column headed `header`. */
export function columnValues(header: string): string[] {
  const table = screen.getByRole('table');
  const headers = within(table).getAllByRole('columnheader');
  const index = headers.findIndex((h) => h.textContent?.trim() === header);
  if (index === -1) throw new Error(`No column ${header}`);
  const rows = within(table).getAllByRole('row').slice(1);
  return rows
    .map((row) => within(row).queryAllByRole('cell')[index]?.textContent ?? '')
    .filter((text) => text !== undefined);
}

/** The table row showing `text` (found even while an open dialog hides the table). */
export function rowWith(text: string) {
  const cell = within(screen.getByRole('table', { hidden: true })).getByText(text);
  const row = cell.closest('tr');
  if (!row) throw new Error(`${text} is not in a table row`);
  return row as HTMLElement;
}

/** The snackbar (alert) showing `message`. */
export async function findSnackbar(message: string | RegExp) {
  const text = await screen.findByText(message, { selector: '.MuiAlert-message' });
  return text.closest('[role="alert"]') as HTMLElement;
}

export function querySnackbar(message: string | RegExp) {
  return screen.queryByText(message, { selector: '.MuiAlert-message' });
}
