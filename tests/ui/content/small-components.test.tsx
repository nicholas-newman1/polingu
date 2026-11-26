import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { Select } from '@mui/material';
import type { ReactNode } from 'react';
import { createAppTheme } from '../../../src/lib/theme';
import { AddButton } from '../../../src/components/AddButton';
import { UploadProgressOverlay } from '../../../src/components/UploadProgressOverlay';
import { renderSelectOptions } from '../../../src/components/selectOptions';

const themed = (ui: ReactNode) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('AddButton', () => {
  test('is labelled "Add" unless told otherwise, and reports clicks', () => {
    const onClick = vi.fn();
    themed(<AddButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('can carry its own label and be disabled', () => {
    const onClick = vi.fn();
    themed(<AddButton onClick={onClick} disabled aria-label="Add sentence" />);
    const button = screen.getByRole('button', { name: 'Add sentence' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('UploadProgressOverlay', () => {
  test('shows how much has been uploaded', () => {
    themed(
      <UploadProgressOverlay
        progress={{ status: 'uploading', uploadPercent: 30 }}
        processingLabel="Processing book..."
      />
    );
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  test('shows an open-ended bar while the server processes the file', () => {
    themed(
      <UploadProgressOverlay
        progress={{ status: 'processing' }}
        processingLabel="Processing book..."
      />
    );
    expect(screen.getByText('Processing book...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  test('shows the error when an upload fails', () => {
    themed(
      <UploadProgressOverlay
        progress={{ status: 'error', error: 'Quota exceeded' }}
        processingLabel="Processing book..."
      />
    );
    expect(screen.getByText('Error: Quota exceeded')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('renderSelectOptions', () => {
  test('offers an empty choice first, then each option formatted', () => {
    themed(
      <Select value="" open onChange={() => {}}>
        {renderSelectOptions(['noun', 'verb'] as const, 'Any', (o) => o.toUpperCase())}
      </Select>
    );
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Any',
      'NOUN',
      'VERB',
    ]);
  });
});
