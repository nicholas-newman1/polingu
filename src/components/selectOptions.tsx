import { MenuItem } from '@mui/material';

/** Returned as an array because MUI `Select` needs `MenuItem`s as direct children. */
export function renderSelectOptions<T extends string>(
  options: readonly T[],
  emptyLabel: string,
  format: (option: T) => string = (option) => option
) {
  return [
    <MenuItem key="" value="">
      <em>{emptyLabel}</em>
    </MenuItem>,
    ...options.map((option) => (
      <MenuItem key={option} value={option}>
        {format(option)}
      </MenuItem>
    )),
  ];
}
